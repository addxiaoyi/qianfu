'use strict';

const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = 'https://mc-u.top';
const SSH_TARGET = 'root@121.196.161.249';
const REMOTE_ROOT = '/www/wwwroot/qianfu-app/current';
const REMOTE_FIXTURE = '/tmp/qianfu-prod-closure-fixture.mjs';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));

function expect(condition, message, details) {
  if (!condition) {
    const suffix = details ? `: ${JSON.stringify(details)}` : '';
    throw new Error(`${message}${suffix}`);
  }
}

function run(command, args, input) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', fail);
    child.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf8').trim();
      const err = Buffer.concat(stderr).toString('utf8').trim();
      if (code !== 0) return fail(new Error(err || `${command} exited with ${code}`));
      done([out, err].filter(Boolean).join('\n'));
    });
    child.stdin.end(input ?? '');
  });
}

async function fixture(input) {
  const output = await run('ssh', [
    '-o', 'BatchMode=yes',
    SSH_TARGET,
    `cd ${REMOTE_ROOT} && node ${REMOTE_FIXTURE}`,
  ], JSON.stringify(input));
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const start = lines[index].indexOf('{');
    const end = lines[index].lastIndexOf('}');
    const candidate = start >= 0 && end > start
      ? lines[index].slice(start, end + 1)
      : lines[index];
    try {
      return JSON.parse(candidate);
    } catch {
      // Local SSH wrappers may print environment readiness lines before JSON.
    }
  }
  throw new Error('Remote fixture did not return JSON');
}

async function restartApi() {
  await run('ssh', [
    '-o', 'BatchMode=yes',
    SSH_TARGET,
    "pm2 restart qianfu-api --update-env >/dev/null && timeout 45 bash -c \"until curl -fsS -A healthcheck -H 'Host: mc-u.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3001/api/ready >/dev/null; do sleep 2; done\"",
  ]);
}

function bodyData(response) {
  return response.body?.data ?? response.body;
}

function entity(response, key) {
  const data = bodyData(response);
  return data?.[key] ?? data;
}

async function call(page, method, path, body, headers = {}) {
  return page.evaluate(async ({ method, path, body, headers, write }) => {
    const requestHeaders = { Accept: 'application/json', ...headers };
    if (write) {
      const tokenResponse = await fetch('/api/v1/csrf-token', { credentials: 'include' });
      const tokenBody = await tokenResponse.json().catch(() => null);
      const token = tokenBody?.data?.csrfToken ?? tokenBody?.csrfToken;
      if (!tokenResponse.ok || !token) {
        return { status: tokenResponse.status, body: tokenBody, stage: 'csrf' };
      }
      requestHeaders['x-csrf-token'] = token;
      requestHeaders['content-type'] = 'application/json';
    }
    const response = await fetch(path, {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
    return { status: response.status, body: parsed };
  }, { method, path, body, headers, write: WRITE_METHODS.has(method) });
}

function expectStatus(response, allowed, step) {
  expect(allowed.includes(response.status), `${step} returned ${response.status}`, response.body);
}

async function login(browser, account, expectedRole) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('input[autocomplete="username"], input[name="identifier"]').first().fill(account.email);
  await page.locator('input[autocomplete="current-password"], input[name="password"]').first().fill(account.password);
  const agreement = page.locator('form button[type="button"]').first();
  if (await agreement.count()) await agreement.click();
  const loginResponse = page.waitForResponse(
    (response) => response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await page.locator('form button[type="submit"]').first().click();
  const response = await loginResponse;
  expect(response.status() === 200, `Login failed for ${expectedRole}`, { status: response.status() });
  const profile = await call(page, 'GET', '/api/v1/profile');
  expectStatus(profile, [200], `${expectedRole} profile`);
  const user = entity(profile, 'user');
  expect(user?.role === expectedRole, `${expectedRole} role mismatch`, user);
  return { context, page, user };
}

async function main(input) {
  const marker = input.marker;
  const report = {
    marker,
    startedAt: new Date().toISOString(),
    deployment: 'qianfu-20260718-2002',
    marketplace: {},
    promotion: {},
    cleanup: null,
  };
  let browser;
  const contexts = [];

  try {
    const seeded = await fixture({ action: 'seed', marker, passwords: {
      owner: input.owner.password,
      seller: input.seller.password,
      buyer: input.buyer.password,
    } });
    input.owner.email = seeded.owner.email;
    input.seller.email = seeded.seller.email;
    input.buyer.email = seeded.buyer.email;

    browser = await chromium.launch({
      headless: true,
      args: ['--proxy-server=direct://', '--proxy-bypass-list=*'],
    });
    const owner = await login(browser, input.owner, 'OWNER');
    const seller = await login(browser, input.seller, 'NORMAL');
    const buyer = await login(browser, input.buyer, 'NORMAL');
    contexts.push(owner.context, seller.context, buyer.context);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    contexts.push(anonContext);
    await anonPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const created = await call(seller.page, 'POST', '/api/v1/qianfu/marketplace/products', {
      title: `${marker} production product`,
      category: 'plugin',
      description: 'Production closure fixture for moderation and delivery verification.',
      price: 199,
      author: marker,
      coverUrl: 'https://mc-u.top/logo.png',
      downloadUrl: `https://mc-u.top/uploads/${marker}-package.zip`,
    });
    expectStatus(created, [200, 201], 'Create marketplace product');
    const product = entity(created, 'product');
    expect(product?.listingStatus === 'PENDING_REVIEW' && product?.isPublished === false, 'New product moderation state is invalid', product);

    const hiddenList = await call(anonPage, 'GET', '/api/v1/qianfu/marketplace/products');
    expectStatus(hiddenList, [200], 'Anonymous product list before approval');
    expect(!JSON.stringify(hiddenList.body).includes(product.id), 'Pending product leaked into public list');

    const edited = await call(seller.page, 'PATCH', `/api/v1/qianfu/marketplace/products/${product.id}`, {
      description: 'Edited production closure fixture awaiting a fresh moderation decision.',
    });
    expectStatus(edited, [200], 'Edit marketplace product');
    const editedProduct = entity(edited, 'product');
    expect(editedProduct?.listingStatus === 'PENDING_REVIEW' && editedProduct?.isPublished === false, 'Edited product escaped moderation', editedProduct);

    const approved = await call(owner.page, 'POST', `/api/v1/qianfu/marketplace/products/${product.id}/review`, {
      status: 'APPROVED',
      notes: 'Production closure approved',
    });
    expectStatus(approved, [200], 'Approve marketplace product');

    const published = await call(seller.page, 'POST', `/api/v1/qianfu/marketplace/products/${product.id}/publish`, {});
    expectStatus(published, [200], 'Publish marketplace product');
    const visibleList = await call(anonPage, 'GET', '/api/v1/qianfu/marketplace/products');
    expectStatus(visibleList, [200], 'Anonymous product list after approval');
    expect(JSON.stringify(visibleList.body).includes(product.id), 'Approved product is absent from public list');

    const favorite = await call(buyer.page, 'POST', `/api/v1/qianfu/marketplace/products/${product.id}/favorite`, {});
    expectStatus(favorite, [200], 'Favorite marketplace product');
    expect(entity(favorite, 'favorite') === true, 'Favorite state was not stored', favorite.body);

    const orderResponse = await call(buyer.page, 'POST', '/api/v1/qianfu/marketplace/orders', {
      productId: product.id,
      quantity: 1,
    }, { 'Idempotency-Key': `${marker}:marketplace-order` });
    expectStatus(orderResponse, [200, 201], 'Create marketplace order');
    const order = entity(orderResponse, 'order');
    expect(order?.paymentStatus === 'PENDING', 'Order did not start pending payment', order);

    await fixture({ action: 'mark-paid', marker, orderId: order.id });
    await restartApi();

    const dispute = await call(buyer.page, 'POST', `/api/v1/qianfu/marketplace/orders/${order.id}/dispute`, {
      reason: 'NOT_DELIVERED',
      description: 'Production closure fixture verifies that an open dispute blocks delivery.',
    });
    expectStatus(dispute, [200], 'Open marketplace dispute');

    const blockedFulfillment = await call(seller.page, 'POST', `/api/v1/qianfu/marketplace/orders/${order.id}/fulfill`, {});
    expectStatus(blockedFulfillment, [409], 'Block fulfillment during dispute');

    const resolution = await call(owner.page, 'POST', `/api/v1/qianfu/marketplace/orders/${order.id}/dispute/resolve`, {
      status: 'RESOLVED',
      resolution: 'Production closure review completed; delivery may continue.',
    });
    expectStatus(resolution, [200], 'Resolve marketplace dispute');

    const fulfillment = await call(seller.page, 'POST', `/api/v1/qianfu/marketplace/orders/${order.id}/fulfill`, {});
    expectStatus(fulfillment, [200], 'Fulfill marketplace order');
    const orderDetail = await call(buyer.page, 'GET', `/api/v1/qianfu/marketplace/orders/${order.id}`);
    expectStatus(orderDetail, [200], 'Read marketplace delivery');
    expect(entity(orderDetail, 'order')?.deliveryUrl?.includes(marker), 'Buyer cannot read delivery information', orderDetail.body);

    const review = await call(buyer.page, 'POST', `/api/v1/qianfu/marketplace/products/${product.id}/reviews`, {
      rating: 5,
      content: 'Production closure review fixture.',
    });
    expectStatus(review, [200, 201], 'Review paid marketplace product');

    const productReport = await call(buyer.page, 'POST', '/api/v1/reports', {
      target_type: 'PRODUCT',
      target_id: product.id,
      reason: 'Production compliance verification',
      description: 'Fixture report used to verify the product reporting workflow.',
    }, { 'Idempotency-Key': `${marker}:product-report` });
    expectStatus(productReport, [200, 201], 'Report marketplace product');
    const orderReport = await call(buyer.page, 'POST', '/api/v1/reports', {
      target_type: 'ORDER',
      target_id: order.id,
      reason: 'Production order verification',
      description: 'Fixture report used to verify participant-scoped order reporting.',
    }, { 'Idempotency-Key': `${marker}:order-report` });
    expectStatus(orderReport, [200, 201], 'Report marketplace order');

    report.marketplace = {
      productModeration: 'PENDING_REVIEW -> APPROVED -> published',
      anonymousVisibility: 'hidden-before-approval/visible-after-approval',
      order: 'PENDING -> PAID fixture (payment API not called)',
      dispute: 'OPEN -> fulfillment blocked 409 -> RESOLVED',
      delivery: 'DELIVERED and buyer-visible',
      review: 'created for paid order',
      reports: ['PRODUCT', 'ORDER'],
    };

    const taskResponse = await call(owner.page, 'POST', '/api/v1/promo/tasks', {
      title: `${marker} promotion task`,
      description: 'Production promotion closure fixture.',
      platform: 'bilibili',
      targetType: 'video',
      targetId: `${marker}_video`,
      targetUrl: `https://www.bilibili.com/video/${marker}`,
      rewardAmount: 88,
      rewardType: 'BALANCE',
      ruleConfig: { actions: { like: true }, condition: 'all_required' },
      claimLimitPerUser: 1,
      totalLimit: 5,
      dailyLimit: 5,
      needAudit: true,
      autoVerify: false,
      status: 'DRAFT',
    });
    expectStatus(taskResponse, [200, 201], 'OWNER creates promotion task');
    const task = entity(taskResponse, 'task');
    expect(task?.id, 'Promotion task response is missing an ID', taskResponse.body);

    const taskPublish = await call(owner.page, 'POST', `/api/v1/promo/tasks/${task.id}/publish`, {});
    expectStatus(taskPublish, [200], 'OWNER publishes promotion task');
    const binding = await call(buyer.page, 'POST', '/api/v1/promo/bindings', {
      platform: 'bilibili',
      platformUserId: `${marker}_platform_user`,
      platformUsername: `${marker}_buyer`,
    });
    expectStatus(binding, [200, 201], 'Bind promotion platform identity');

    const beforeReward = await fixture({ action: 'inspect', marker });
    const claimResponse = await call(buyer.page, 'POST', '/api/v1/promo/claims', {
      taskId: task.id,
      proofData: { note: 'Production closure proof submitted for manual review.' },
    }, { 'Idempotency-Key': `${marker}:promotion-claim` });
    expectStatus(claimResponse, [200, 201], 'Claim promotion reward');
    const claim = entity(claimResponse, 'claim');
    expect(claim?.id, 'Promotion claim response is missing an ID', claimResponse.body);

    const approval = await call(owner.page, 'POST', `/api/v1/promo/claims/${claim.id}/approve`, {
      remark: 'Production closure approval',
    });
    expectStatus(approval, [200], 'OWNER approves promotion claim');
    const afterApproval = await fixture({ action: 'inspect', marker });
    expect(afterApproval.walletBalance - beforeReward.walletBalance === 88, 'Promotion reward balance is incorrect', { beforeReward, afterApproval });
    expect(afterApproval.promoTransactions === 1, 'Promotion reward transaction count is incorrect', afterApproval);

    const replay = await call(owner.page, 'POST', `/api/v1/promo/claims/${claim.id}/approve`, {
      remark: 'Production closure duplicate approval probe',
    });
    expectStatus(replay, [200, 409], 'Duplicate promotion approval');
    const afterReplay = await fixture({ action: 'inspect', marker });
    expect(afterReplay.walletBalance === afterApproval.walletBalance, 'Duplicate approval changed wallet balance', { afterApproval, afterReplay });
    expect(afterReplay.promoTransactions === 1, 'Duplicate approval created another reward transaction', afterReplay);

    report.promotion = {
      ownerAuthorization: 'create/publish succeeded',
      binding: 'ACTIVE manual binding created',
      claim: 'PENDING -> REWARDED',
      rewardAmount: 88,
      duplicateApprovalStatus: replay.status,
      idempotency: 'wallet unchanged and exactly one reward transaction',
    };
    report.ok = true;
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    report.cleanup = await fixture({ action: 'cleanup', marker }).catch((error) => ({ error: error.message }));
    await restartApi().catch((error) => {
      report.cleanupRestartError = error.message;
    });
    report.completedAt = new Date().toISOString();
    const clean = report.cleanup
      && !report.cleanup.error
      && Object.values(report.cleanup).every((count) => count === 0);
    report.cleanupVerified = clean;
    if (!clean && report.ok) throw new Error(`Production fixture cleanup failed: ${JSON.stringify(report.cleanup)}`);
    await mkdir(resolve(process.cwd(), 'output', 'prod-closure'), { recursive: true });
    await writeFile(
      resolve(process.cwd(), 'output', 'prod-closure', `${marker}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
    process.stdout.write(JSON.stringify(report));
  }
}

process.stdin.on('end', async () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(/^qfqa_[a-z0-9]{8,32}$/.test(input.marker), 'Invalid smoke marker');
    for (const role of ['owner', 'seller', 'buyer']) {
      expect(String(input[role]?.password ?? '').length >= 20, `${role} password is too short`);
    }
    await main(input);
  } catch (error) {
    process.stderr.write(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
});

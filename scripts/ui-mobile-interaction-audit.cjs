const path = require('node:path');
const fs = require('node:fs');
const { chromium, devices } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve(process.cwd(), 'output', 'ui-audit-2026-05-21');
const LOCAL_AUTH_TOKEN_KEY = 'qf_local_auth_token';
const USER_LOGIN = {
  identifier: process.env.QA_LOGIN_IDENTIFIER || process.env.QA_LOGIN_USER || 'qa_user',
  password: process.env.QA_LOGIN_PASSWORD || 'QaTest123!',
};

function hashPath(route) {
  if (route === '/') return `${BASE_URL}/#/`;
  return `${BASE_URL}/#${route}`;
}

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function waitStable(page, ms = 900) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
  await page.waitForTimeout(ms);
}

async function readToken(page) {
  return page.evaluate(
    (tokenKey) =>
      window.sessionStorage.getItem(tokenKey) ||
      window.localStorage.getItem(tokenKey),
    LOCAL_AUTH_TOKEN_KEY,
  );
}

async function login(page) {
  await page.goto(hashPath('/login'), { waitUntil: 'domcontentloaded' });
  await waitStable(page, 1200);

  const idInput = page.locator('input[autocomplete="username"], input[name="identifier"], input[type="text"]').first();
  const pwInput = page.locator('input[autocomplete="current-password"], input[name="password"], input[type="password"]').first();
  await idInput.fill(USER_LOGIN.identifier);
  await pwInput.fill(USER_LOGIN.password);
  const agreeBtn = page.getByRole('button', { name: /同意|agree/i }).first();
  if (await agreeBtn.count()) await agreeBtn.click();

  await Promise.allSettled([
    page.waitForResponse((resp) => resp.url().includes('/api/v1/auth/login') && resp.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  await waitStable(page, 1600);
  const token = await readToken(page);
  if (!token) throw new Error('mobile login token missing');
}

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();

  const checks = [];

  try {
    await login(page);

    // 1) 新建工单页输入框：点击与输入后不得跳转登录或刷新到其他路由
    await page.goto(hashPath('/tickets/new'), { waitUntil: 'domcontentloaded' });
    await waitStable(page);
    const beforeTicketUrl = page.url();

    const titleInput = page.locator('input[placeholder*="简要描述"], input[placeholder*="问题"]').first();
    const descInput = page.locator('textarea[placeholder*="详细"], textarea').first();
    await titleInput.click();
    await titleInput.fill('移动端输入稳定性验证');
    await descInput.click();
    await descInput.fill('验证点击输入框不会触发页面刷新或回跳登录。');
    await waitStable(page, 700);

    const afterTicketUrl = page.url();
    const ticketToken = await readToken(page);
    const ticketOk = Boolean(ticketToken) && !afterTicketUrl.includes('#/login') && afterTicketUrl === beforeTicketUrl;
    const ticketShot = path.join(OUT_DIR, 'shots', 'mobile', 'interaction', 'tickets-new-input.png');
    await ensureDir(path.dirname(ticketShot));
    await page.screenshot({ path: ticketShot, fullPage: true });
    checks.push({
      step: 'mobile-ticket-input',
      ok: ticketOk,
      beforeUrl: beforeTicketUrl,
      afterUrl: afterTicketUrl,
      tokenAlive: Boolean(ticketToken),
      screenshot: ticketShot,
    });

    // 2) 编辑资料页输入框：填写用户名邮箱后不回跳登录
    await page.goto(hashPath('/me/edit'), { waitUntil: 'domcontentloaded' });
    await waitStable(page, 1200);
    const beforeProfileUrl = page.url();

    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    await usernameInput.click();
    await usernameInput.fill('qa_user');
    if (await emailInput.count()) {
      await emailInput.click();
      await emailInput.fill('qa_user@local.test');
    }
    await waitStable(page, 700);

    const afterProfileUrl = page.url();
    const profileToken = await readToken(page);
    const profileOk = Boolean(profileToken) && !afterProfileUrl.includes('#/login') && afterProfileUrl === beforeProfileUrl;
    const profileShot = path.join(OUT_DIR, 'shots', 'mobile', 'interaction', 'profile-edit-input.png');
    await page.screenshot({ path: profileShot, fullPage: true });
    checks.push({
      step: 'mobile-profile-input',
      ok: profileOk,
      beforeUrl: beforeProfileUrl,
      afterUrl: afterProfileUrl,
      tokenAlive: Boolean(profileToken),
      screenshot: profileShot,
    });

    // 3) 消息页搜索输入
    await page.goto(hashPath('/messages'), { waitUntil: 'domcontentloaded' });
    await waitStable(page);
    const beforeMsgUrl = page.url();
    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    if (await searchInput.count()) {
      await searchInput.click();
      await searchInput.fill('工单');
      await waitStable(page, 500);
    }
    const afterMsgUrl = page.url();
    const msgToken = await readToken(page);
    const msgOk = Boolean(msgToken) && !afterMsgUrl.includes('#/login') && afterMsgUrl === beforeMsgUrl;
    const msgShot = path.join(OUT_DIR, 'shots', 'mobile', 'interaction', 'messages-search-input.png');
    await page.screenshot({ path: msgShot, fullPage: true });
    checks.push({
      step: 'mobile-messages-input',
      ok: msgOk,
      beforeUrl: beforeMsgUrl,
      afterUrl: afterMsgUrl,
      tokenAlive: Boolean(msgToken),
      screenshot: msgShot,
    });

    // 4) 发布服务器页输入
    await page.goto(hashPath('/editor'), { waitUntil: 'domcontentloaded' });
    await waitStable(page, 1500);
    const beforeEditorUrl = page.url();
    const editorInputs = page.locator('input[type="text"], input:not([type])');
    const inputCount = await editorInputs.count();
    if (inputCount >= 3) {
      await editorInputs.nth(0).click();
      await editorInputs.nth(0).fill('移动端发布页输入稳定性测试服');
      await editorInputs.nth(1).click();
      await editorInputs.nth(1).fill('1.20.1');
      await editorInputs.nth(2).click();
      await editorInputs.nth(2).fill('play.example.com');
      await waitStable(page, 700);
    }
    const afterEditorUrl = page.url();
    const editorToken = await readToken(page);
    const editorOk = Boolean(editorToken) && !afterEditorUrl.includes('#/login') && afterEditorUrl === beforeEditorUrl;
    const editorShot = path.join(OUT_DIR, 'shots', 'mobile', 'interaction', 'editor-input.png');
    await page.screenshot({ path: editorShot, fullPage: true });
    checks.push({
      step: 'mobile-editor-input',
      ok: editorOk,
      beforeUrl: beforeEditorUrl,
      afterUrl: afterEditorUrl,
      tokenAlive: Boolean(editorToken),
      screenshot: editorShot,
    });
  } finally {
    await context.close();
    await browser.close();
  }

  const failed = checks.filter((c) => !c.ok);
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: checks.length,
    failed: failed.length,
    failedChecks: failed,
    checks,
  };

  const outFile = path.join(OUT_DIR, 'mobile-interaction-report.json');
  await fs.promises.writeFile(outFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ outFile, total: report.total, failed: report.failed, failedChecks: report.failedChecks }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

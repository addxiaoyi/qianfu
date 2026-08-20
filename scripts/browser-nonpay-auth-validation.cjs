const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const BASE_URL = (process.env.SMOKE_WEB_BASE_URL || 'https://mc-u.top').replace(/\/+$/, '');
const API_BASE_URL = (process.env.SMOKE_BROWSER_API_BASE_URL || BASE_URL).replace(/\/+$/, '');
const LOGIN_IDENTIFIER = process.env.SMOKE_LOGIN_IDENTIFIER || '';
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || '';
const ADMIN_IDENTIFIER = process.env.SMOKE_ADMIN_IDENTIFIER || LOGIN_IDENTIFIER;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || LOGIN_PASSWORD;
const OUT_DIR = path.resolve(process.cwd(), process.env.SMOKE_AUTH_NONPAY_OUT_DIR || 'output/prod-auth-nonpay-verify');
const ADMIN_REQUIRED = /^1|true|yes$/i.test(process.env.QA_ADMIN_REQUIRED || '');
const USE_SYSTEM_PROXY = /^1|true|yes$/i.test(process.env.SMOKE_BROWSER_USE_SYSTEM_PROXY || '');
const HOST_RESOLVER_RULES = process.env.SMOKE_BROWSER_HOST_RESOLVER_RULES || '';
const CONNECT_HOST = process.env.SMOKE_BROWSER_CONNECT_HOST || '';
const BROWSER_EXECUTABLE_PATH = process.env.SMOKE_BROWSER_EXECUTABLE_PATH || '';
const NAV_TIMEOUT_MS = Number(process.env.SMOKE_BROWSER_NAV_TIMEOUT_MS || 30000);
const FETCH_TIMEOUT_MS = Number(process.env.SMOKE_BROWSER_FETCH_TIMEOUT_MS || NAV_TIMEOUT_MS);
const CONNECT_TIMEOUT_MS = Number(process.env.SMOKE_BROWSER_CONNECT_TIMEOUT_MS || 8000);
const SKIP_REACHABILITY_PREFLIGHT = /^1|true|yes$/i.test(process.env.SMOKE_BROWSER_SKIP_REACHABILITY_PREFLIGHT || '');
const CHROMIUM_DIRECT_PROXY_ARGS = ['--proxy-server=direct://', '--proxy-bypass-list=*'];
if (HOST_RESOLVER_RULES) {
  CHROMIUM_DIRECT_PROXY_ARGS.push(`--host-resolver-rules=${HOST_RESOLVER_RULES}`);
}

if (!LOGIN_IDENTIFIER || !LOGIN_PASSWORD) {
  console.error('Missing SMOKE_LOGIN_IDENTIFIER or SMOKE_LOGIN_PASSWORD');
  process.exit(1);
}

const USER_DESKTOP_ROUTES = [
  { path: '/dashboard', label: 'dashboard', texts: ['快捷概览', '等级', 'Dashboard', '个人中心'] },
  { path: '/dashboard/profile', label: 'dashboard profile', texts: ['钱包余额', '账号状态', 'Profile', '用户ID'] },
  { path: '/me', label: 'profile', texts: ['钱包余额', '账号状态', 'Profile', '用户ID'] },
  { path: '/me/edit', label: 'profile edit', texts: ['账号资料', '基础资料', '密码与安全', 'Identity_Parameter_Sync'] },
  { path: '/settings', label: 'settings', texts: ['账户偏好', '界面语言', '主题颜色', '账户与支持'] },
  { path: '/me/settings', label: 'mobile settings route', texts: ['设置', '界面语言', '主题颜色', '账户与支持'] },
  { path: '/dashboard/servers', label: 'my servers', texts: ['我的服务器', '发布新服务器', '服务器列表', 'My Servers'] },
  { path: '/tickets', label: 'tickets', texts: ['TICKET_QUEUE', '工单', 'Ticket', 'OPEN'] },
  { path: '/editor', label: 'server editor', texts: ['发布服务器', '宣传图封面', '提交审核', 'Publish Server', 'Cover Image'] },
  { path: '/rules', label: 'rules', texts: ['等级与经验规则', '每日签到', 'XP Gain', 'Unlockables'] },
];

const USER_MOBILE_ROUTES = [
  { path: '/dashboard', label: 'mobile dashboard', texts: ['个人中心', '我的服务器', '未结工单', '账户设置'] },
  { path: '/me', label: 'mobile profile', texts: ['我的服务器', '工单记录', '个人资料', '账号'] },
  { path: '/me/edit', label: 'mobile profile edit', texts: ['账号资料', '基础资料', '密码与安全', 'Identity_Parameter_Sync'] },
  { path: '/tickets', label: 'mobile tickets', texts: ['工单', '全部', '新建', 'Ticket'] },
  { path: '/editor', label: 'mobile editor', texts: ['发布服务器', '服务器名称', '提交审核', 'Publish Server'] },
  { path: '/rules', label: 'mobile rules', texts: ['等级与经验规则', '每日签到', 'XP Gain', 'Unlockables'] },
];

const ADMIN_DESKTOP_ROUTES = [
  { path: '/admin', label: 'admin dashboard', texts: ['管理总览', '真实统计', '审计事件'] },
  { path: '/admin-users', label: 'admin users', texts: ['用户目录', '用户管理 / 实时数据', '用户信息'] },
  { path: '/admin-review', label: 'admin review', texts: ['服务器审核', '待审核', '审核'] },
  { path: '/admin-tickets', label: 'admin tickets', texts: ['Nexus.', '后台工单管理', '工单'] },
  { path: '/admin-reports', label: 'admin reports', texts: ['举报管理', '举报处理 / 实时数据', '举报'] },
  { path: '/admin-audit', label: 'admin audit', texts: ['审计。', '审计状态', '审计'] },
  { path: '/admin-audit-stats', label: 'admin audit stats', texts: ['审计洞察', '审计摘要', '审计统计'] },
  { path: '/admin-moderation', label: 'admin moderation', texts: ['Guard.', '内容审核', '审核日志'] },
  { path: '/admin-port5555', label: 'admin port security', texts: ['端口', '5555', '安全态势'] },
  { path: '/admin-settings', label: 'admin settings', texts: ['配置总控', 'System Core', 'Operations'] },
  { path: '/admin-mail', label: 'admin mail', texts: ['邮件配置', '发信总览', '发送探针'] },
  { path: '/admin-announcements', label: 'admin announcements', texts: ['新闻管理', '系统公告', '公告'] },
  { path: '/promotion/tasks', label: 'promo tasks', texts: ['任务列表', '推广任务 / 规则配置', '任务列表已启用', '新建任务'] },
  { path: '/promotion/claims', label: 'promo claims', texts: ['推广投稿 / 审核与结算', '审核结算面板已就绪', '投稿审核'] },
];

const PAYMENT_PATH_PATTERNS = [
  /\/payment(?:\/|$)/i,
  /\/admin-qianfu(?:\/|$)/i,
  /\/api\/v1\/(?:payment|wallet)(?:\/|$)/i,
  /\/api\/v1\/payment-/i,
  /\/api\/v1\/qianfu\/payment/i,
];

function ensureOutputDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicUrl(routePath) {
  return `${BASE_URL}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
}

function getBaseEndpoint() {
  const url = new URL(BASE_URL);
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  return { host: CONNECT_HOST || url.hostname, port };
}

function testTcpConnect(host, port, timeoutMs = CONNECT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function writeReport(report) {
  ensureOutputDir();
  const reportPath = path.join(OUT_DIR, `auth-nonpay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}

function isPaymentScoped(url) {
  return PAYMENT_PATH_PATTERNS.some((pattern) => pattern.test(url));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`fetch timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isIgnorableResponse(response) {
  const url = response.url();
  if (isPaymentScoped(url)) return true;
  if (/\/favicon(?:\.ico|\.svg)?$/i.test(url)) return true;
  return false;
}

function normalizeRole(value) {
  return String(value || '').trim().toUpperCase();
}

function getProfileFromEnvelope(payload) {
  const data = payload?.data ?? payload;
  return data?.user ?? data ?? null;
}

async function getBodyText(page) {
  return page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
}

async function waitForAppSettled(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => undefined);
  await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 20, undefined, { timeout: 12000 }).catch(() => undefined);
  await page.waitForFunction(
    () => !/INITIALIZING_SESSION|加载中|Loading session/i.test(document.body?.innerText || ''),
    undefined,
    { timeout: 12000 },
  ).catch(() => undefined);
  await sleep(500);
}

async function gotoWithRetry(page, url) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: 'commit', timeout: NAV_TIMEOUT_MS });
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(1000);
      }
    }
  }
  throw lastError;
}

async function readProfile(page) {
  return page.evaluate(async () => {
    const resp = await fetch('/api/v1/profile', {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    const body = await resp.json().catch(() => null);
    const data = body?.data ?? body;
    return {
      status: resp.status,
      ok: resp.ok,
      role: data?.role ?? data?.user?.role ?? '',
      emailVerified: data?.email_verified ?? data?.user?.email_verified ?? null,
      username: data?.username ?? data?.user?.username ?? '',
    };
  });
}

async function assertAuthenticated(page, requireAdmin) {
  const profile = await readProfile(page);
  if (!profile.ok) {
    throw new Error(`profile check failed: HTTP ${profile.status}`);
  }
  if (requireAdmin && normalizeRole(profile.role) !== 'ADMIN') {
    throw new Error(`admin role required, got ${profile.role || 'unknown'}`);
  }
  return profile;
}

async function login(page, identifier, password, requireAdmin = false) {
  await gotoWithRetry(page, publicUrl('/login'));
  await waitForAppSettled(page);

  const already = await readProfile(page).catch(() => null);
  if (already?.ok && (!requireAdmin || normalizeRole(already.role) === 'ADMIN')) {
    return already;
  }

  await page.locator('input[autocomplete="username"], input[name="identifier"]').first().fill(identifier, { timeout: 10000 });
  await page.locator('input[autocomplete="current-password"], input[name="password"]').first().fill(password, { timeout: 10000 });

  const agreeToggle = page.locator('form button[type="button"]').first();
  if (await agreeToggle.count()) {
    await agreeToggle.click();
  }

  const submit = page.locator('form button[type="submit"]').first();
  await submit.click();
  await Promise.race([
    page.waitForResponse((resp) => resp.url().includes('/api/v1/auth/login') && resp.request().method() === 'POST', { timeout: 15000 }),
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 }),
  ]).catch(() => undefined);
  await waitForAppSettled(page);

  let profile = await readProfile(page).catch(() => null);
  if (!profile?.ok) {
    await page.evaluate(
      async ({ identifierValue, passwordValue }) => {
        const csrfResponse = await fetch('/api/v1/csrf-token', {
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        const csrfPayload = await csrfResponse.json().catch(() => null);
        const csrfToken = csrfPayload?.data?.csrfToken || csrfPayload?.csrfToken || '';
        await fetch('/api/v1/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify({ identifier: identifierValue, password: passwordValue }),
        });
      },
      { identifierValue: identifier, passwordValue: password },
    );
    await sleep(800);
    profile = await readProfile(page).catch(() => null);
  }

  if (!profile?.ok) {
    throw new Error(`login failed for ${identifier}: ${JSON.stringify({ status: profile?.status || null })}`);
  }
  if (requireAdmin && normalizeRole(profile.role) !== 'ADMIN') {
    throw new Error(`admin role required, got ${profile.role || 'unknown'}`);
  }
  return profile;
}

async function expectAnyText(page, route) {
  const body = await getBodyText(page);
  if (/INITIALIZING_SESSION/i.test(body)) {
    throw new Error('route is stuck on INITIALIZING_SESSION');
  }
  if (/请登录|登录入口|Sign in/i.test(body) && /\/login(?:$|[?#])/.test(page.url())) {
    throw new Error(`route redirected to login: ${page.url()}`);
  }

  const matched = route.texts.find((text) => body.includes(text));
  if (!matched) {
    throw new Error(`missing expected text for ${route.label}: ${route.texts.join(' | ')}`);
  }
  return matched;
}

async function captureFailure(page, contextName, route, error) {
  ensureOutputDir();
  const safeName = `${contextName}-${route.label}`.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const htmlPath = path.join(OUT_DIR, `${safeName}.html`);
  const screenshotPath = path.join(OUT_DIR, `${safeName}.png`);
  fs.writeFileSync(htmlPath, await page.content().catch(() => ''), 'utf8');
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  return {
    message: error instanceof Error ? error.message : String(error),
    html: htmlPath,
    screenshot: screenshotPath,
  };
}

async function validateRoute(contextName, page, route) {
  if (isPaymentScoped(route.path)) {
    throw new Error(`payment-scoped route is not allowed in non-payment validation: ${route.path}`);
  }

  const networkErrors = [];
  const runtimeErrors = [];
  const onResponse = (response) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (!['document', 'fetch', 'xhr', 'script', 'stylesheet'].includes(resourceType)) return;
    if (isIgnorableResponse(response)) return;
    const status = response.status();
    if (status >= 400) {
      networkErrors.push({
        status,
        method: request.method(),
        url: response.url().replace(BASE_URL, ''),
      });
    }
  };

  const onPageError = (error) => {
    runtimeErrors.push({ type: 'pageerror', message: error.message || String(error) });
  };
  const onRequestFailed = (request) => {
    if (isPaymentScoped(request.url())) return;
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    runtimeErrors.push({
      type: 'requestfailed',
      message: `${request.method()} ${request.url().replace(BASE_URL, '')}: ${request.failure()?.errorText || 'failed'}`,
    });
  };
  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    runtimeErrors.push({ type: 'console', message: message.text() });
  };

  page.on('response', onResponse);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('console', onConsole);
  const result = {
    context: contextName,
    path: route.path,
    label: route.label,
    ok: false,
    finalUrl: '',
    matchedText: '',
    networkErrors: [],
    runtimeErrors: [],
  };

  try {
    await gotoWithRetry(page, publicUrl(route.path));
    await waitForAppSettled(page);
    await assertAuthenticated(page, route.admin === true);
    result.finalUrl = page.url();
    result.matchedText = await expectAnyText(page, route);
    result.networkErrors = networkErrors;
    result.runtimeErrors = runtimeErrors;
    const hardErrors = networkErrors.filter((item) => item.status >= 500 || item.status === 404);
    if (hardErrors.length > 0) {
      throw new Error(`route had API/document hard errors: ${JSON.stringify(hardErrors)}`);
    }
    if (runtimeErrors.length > 0) {
      throw new Error(`route had browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
    }
    result.ok = true;
    return result;
  } catch (error) {
    result.finalUrl = page.url();
    result.networkErrors = networkErrors;
    result.runtimeErrors = runtimeErrors;
    result.error = await captureFailure(page, contextName, route, error);
    return result;
  } finally {
    page.off('response', onResponse);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
    page.off('console', onConsole);
  }
}

async function validateRoutes(browser, contextName, contextOptions, routes, credentials, requireAdmin = false) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const results = [];
  let profile = null;

  try {
    profile = await login(page, credentials.identifier, credentials.password, requireAdmin);
    for (const route of routes) {
      results.push(await validateRoute(contextName, page, { ...route, admin: requireAdmin }));
    }
  } catch (error) {
    results.push({
      context: contextName,
      path: '(login)',
      label: `${contextName} login`,
      ok: false,
      finalUrl: page.url(),
      error: await captureFailure(page, contextName, { label: 'login', path: '/login' }, error),
    });
  } finally {
    await context.close();
  }

  return { profile, results };
}

function firstCookie(headers) {
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';')[0]).filter(Boolean).join('; ');
}

async function loginProfileViaApi(identifier, password) {
  const csrfResp = await fetchWithTimeout(`${API_BASE_URL}/api/v1/csrf-token`, {
    headers: { accept: 'application/json' },
  });
  const csrfPayload = await csrfResp.json().catch(() => null);
  const csrfToken = csrfPayload?.data?.csrfToken || csrfPayload?.csrfToken || '';
  const cookie = firstCookie(csrfResp.headers);
  if (!csrfResp.ok || !csrfToken) {
    return { status: csrfResp.status, ok: false, hasToken: false, role: '', emailVerified: null, username: '' };
  }

  const resp = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-csrf-token': csrfToken,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ identifier, password }),
  });
  const payload = await resp.json().catch(() => null);
  const data = payload?.data ?? payload;
  const token = data?.token || payload?.token || '';
  let profile = getProfileFromEnvelope(payload);

  if (token) {
    const profileResp = await fetchWithTimeout(`${API_BASE_URL}/api/v1/profile`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        ...(cookie ? { cookie } : {}),
      },
    });
    const profilePayload = await profileResp.json().catch(() => null);
    profile = getProfileFromEnvelope(profilePayload) || profile;
  }

  return {
    status: resp.status,
    ok: resp.ok,
    hasToken: Boolean(token),
    role: profile?.role || '',
    emailVerified: profile?.email_verified ?? null,
    username: profile?.username || '',
  };
}

async function main() {
  ensureOutputDir();
  const startedAt = new Date().toISOString();
  const endpoint = getBaseEndpoint();

  if (!SKIP_REACHABILITY_PREFLIGHT) {
    const reachable = await testTcpConnect(endpoint.host, endpoint.port);
    if (!reachable) {
      const report = {
        startedAt,
        finishedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        kind: 'reachability_preflight',
        ok: false,
        host: endpoint.host,
        port: endpoint.port,
        browser: {
          proxyMode: USE_SYSTEM_PROXY ? 'system' : 'direct',
          navTimeoutMs: NAV_TIMEOUT_MS,
          fetchTimeoutMs: FETCH_TIMEOUT_MS,
          connectTimeoutMs: CONNECT_TIMEOUT_MS,
          reachabilityPreflight: 'failed',
        },
        plannedRoutes: 0,
        passedRoutes: 0,
        failedRoutes: 1,
        skipped: [],
        results: [{
          context: 'preflight',
          path: '(tcp)',
          label: 'reachability preflight',
          ok: false,
          finalUrl: '',
          error: { message: `TCP connection failed: ${endpoint.host}:${endpoint.port} after ${CONNECT_TIMEOUT_MS}ms` },
        }],
      };
      const reportPath = writeReport(report);
      console.log(`[browser:auth-nonpay] report=${reportPath}`);
      console.log(`[browser:auth-nonpay] proxy_mode=${report.browser.proxyMode}`);
      console.log(`[browser:auth-nonpay] nav_timeout_ms=${report.browser.navTimeoutMs}`);
      console.log(`[browser:auth-nonpay] fetch_timeout_ms=${report.browser.fetchTimeoutMs}`);
      console.log(`[browser:auth-nonpay] connect_timeout_ms=${report.browser.connectTimeoutMs}`);
      console.log(`[browser:auth-nonpay] planned_routes=${report.plannedRoutes}`);
      console.log(`[browser:auth-nonpay] passed_routes=${report.passedRoutes}`);
      console.log(`[browser:auth-nonpay] failed_routes=${report.failedRoutes}`);
      console.error('[browser:auth-nonpay] FAIL');
      console.error(`- preflight (tcp): ${report.results[0].error.message}`);
      process.exit(1);
    }
  }

  const launchOptions = {
    headless: true,
    args: USE_SYSTEM_PROXY ? [] : CHROMIUM_DIRECT_PROXY_ARGS,
    ...(BROWSER_EXECUTABLE_PATH ? { executablePath: BROWSER_EXECUTABLE_PATH } : {}),
  };
  const browser = await chromium.launch(launchOptions);
  const allResults = [];
  const skipped = [];

  const userCredentials = { identifier: LOGIN_IDENTIFIER, password: LOGIN_PASSWORD };
  const adminCredentials = { identifier: ADMIN_IDENTIFIER, password: ADMIN_PASSWORD };
  const adminApiProfile = await loginProfileViaApi(ADMIN_IDENTIFIER, ADMIN_PASSWORD).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }));

  try {
    const desktop = await validateRoutes(
      browser,
      'desktop-user',
      { viewport: { width: 1440, height: 960 } },
      USER_DESKTOP_ROUTES,
      userCredentials,
      false,
    );
    allResults.push(...desktop.results);

    const mobile = await validateRoutes(
      browser,
      'mobile-user',
      { ...devices['iPhone 13'] },
      USER_MOBILE_ROUTES,
      userCredentials,
      false,
    );
    allResults.push(...mobile.results);

    if (adminApiProfile.ok && normalizeRole(adminApiProfile.role) === 'ADMIN') {
      const admin = await validateRoutes(
        browser,
        'desktop-admin',
        { viewport: { width: 1440, height: 960 } },
        ADMIN_DESKTOP_ROUTES,
        adminCredentials,
        true,
      );
      allResults.push(...admin.results);
    } else {
      const reason = adminApiProfile.ok
        ? `admin credentials are not ADMIN (role=${adminApiProfile.role || 'unknown'})`
        : `admin login probe failed (${adminApiProfile.error || adminApiProfile.status || 'unknown'})`;
      skipped.push({ scope: 'desktop-admin', reason });
      if (ADMIN_REQUIRED) {
        allResults.push({
          context: 'desktop-admin',
          path: '(admin routes)',
          label: 'admin routes',
          ok: false,
          finalUrl: '',
          error: { message: reason },
        });
      }
    }
  } finally {
    await browser.close();
  }

  const failed = allResults.filter((item) => !item.ok);
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    browser: {
      proxyMode: USE_SYSTEM_PROXY ? 'system' : 'direct',
      navTimeoutMs: NAV_TIMEOUT_MS,
      fetchTimeoutMs: FETCH_TIMEOUT_MS,
    },
    plannedRoutes: allResults.length,
    passedRoutes: allResults.length - failed.length,
    failedRoutes: failed.length,
    skipped,
    login: {
      username: adminApiProfile.username || null,
      role: adminApiProfile.role || null,
      emailVerified: adminApiProfile.emailVerified ?? null,
      adminProbeOk: Boolean(adminApiProfile.ok && normalizeRole(adminApiProfile.role) === 'ADMIN'),
    },
    results: allResults,
  };

  const reportPath = writeReport(report);

  console.log(`[browser:auth-nonpay] report=${reportPath}`);
  console.log(`[browser:auth-nonpay] proxy_mode=${report.browser.proxyMode}`);
  console.log(`[browser:auth-nonpay] nav_timeout_ms=${report.browser.navTimeoutMs}`);
  console.log(`[browser:auth-nonpay] fetch_timeout_ms=${report.browser.fetchTimeoutMs}`);
  console.log(`[browser:auth-nonpay] planned_routes=${report.plannedRoutes}`);
  console.log(`[browser:auth-nonpay] passed_routes=${report.passedRoutes}`);
  console.log(`[browser:auth-nonpay] failed_routes=${report.failedRoutes}`);
  if (skipped.length > 0) {
    console.log(`[browser:auth-nonpay] skipped=${JSON.stringify(skipped)}`);
  }

  if (failed.length > 0) {
    console.error('[browser:auth-nonpay] FAIL');
    for (const item of failed) {
      console.error(`- ${item.context} ${item.path}: ${item.error?.message || 'unknown error'}`);
    }
    process.exit(1);
  }

  console.log('[browser:auth-nonpay] PASS');
}

main().catch((error) => {
  console.error('[browser:auth-nonpay] FAIL', error);
  process.exit(1);
});

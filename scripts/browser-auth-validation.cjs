const BASE_URL = (process.env.SMOKE_WEB_BASE_URL || 'https://mc-u.top').replace(/\/+$/, '');
const LOCAL_AUTH_TOKEN_KEY = 'qf_local_auth_token';
const LOGIN_IDENTIFIER = process.env.SMOKE_LOGIN_IDENTIFIER || '';
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || '';
const ADMIN_IDENTIFIER = process.env.SMOKE_ADMIN_IDENTIFIER || LOGIN_IDENTIFIER;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || LOGIN_PASSWORD;

if (!LOGIN_IDENTIFIER || !LOGIN_PASSWORD) {
  console.error('Missing SMOKE_LOGIN_IDENTIFIER or SMOKE_LOGIN_PASSWORD');
  process.exit(1);
}

const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

async function expectVisible(page, selectors, label) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      return;
    }
  }
  throw new Error(`Missing visible target: ${label}`);
}

async function expectTextAny(page, texts, label) {
  for (const text of texts) {
    const locator = page.getByText(text, { exact: false });
    if (await locator.count()) {
      await locator.first().waitFor({ state: 'visible', timeout: 10000 });
      return text;
    }
  }
  throw new Error(`Missing visible text: ${label}`);
}

async function readAuthState(page) {
  return page.evaluate(
    async ({ tokenKey }) => {
      const token =
        window.sessionStorage.getItem(tokenKey) ||
        window.localStorage.getItem(tokenKey);
      if (!token) {
        return { hasToken: false, profileOk: false, role: '' };
      }
      try {
        const resp = await fetch('/api/v1/profile', {
          method: 'GET',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!resp.ok) {
          return { hasToken: true, profileOk: false, role: '', status: resp.status };
        }
        const json = await resp.json().catch(() => null);
        const role = String(json?.data?.role ?? json?.role ?? '').toUpperCase();
        return { hasToken: true, profileOk: true, role, status: resp.status };
      } catch (error) {
        return { hasToken: true, profileOk: false, role: '', error: String(error) };
      }
    },
    { tokenKey: LOCAL_AUTH_TOKEN_KEY },
  );
}

async function ensureLoggedIn(page, expectAdmin = false) {
  const state = await readAuthState(page);
  if (!state.hasToken || !state.profileOk) return false;
  if (expectAdmin && state.role !== 'ADMIN') return false;
  return true;
}

async function login(page, identifier, password) {
  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  if (await ensureLoggedIn(page, false)) {
    return;
  }
  if (!/\/(#\/)?login/.test(page.url())) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    if (await ensureLoggedIn(page, false)) {
      return;
    }
  }
  await expectVisible(page, ['input[autocomplete="username"]', 'input[name="identifier"]'], 'login identifier');
  await page.locator('input[autocomplete="username"], input[name="identifier"]').first().fill(identifier);
  await page.locator('input[autocomplete="current-password"], input[name="password"]').first().fill(password);

  const agreeButton = page.getByRole('button').filter({ hasText: /同意|agree/i }).first();
  if (await agreeButton.count()) {
    await agreeButton.click();
  }

  const submit = page.locator('form button[type="submit"]').first();
  await submit.waitFor({ state: 'visible', timeout: 10000 });
  await submit.click();
  await Promise.allSettled([
    page.waitForResponse((resp) => resp.url().includes('/api/v1/auth/login') && resp.request().method() === 'POST', { timeout: 15000 }),
    page.waitForURL((url) => !url.href.includes('/#/login'), { timeout: 15000 }),
  ]);

  let ok = await ensureLoggedIn(page, false);
  if (!ok) {
    await page.evaluate(
      async ({ identifierValue, passwordValue, tokenKey }) => {
        const resp = await fetch('/api/v1/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: identifierValue, password: passwordValue }),
        });
        const json = await resp.json().catch(() => null);
        const token = json?.data?.token || json?.token || null;
        if (token) {
          window.sessionStorage.setItem(tokenKey, token);
        }
      },
      { identifierValue: identifier, passwordValue: password, tokenKey: LOCAL_AUTH_TOKEN_KEY },
    );
    await page.waitForTimeout(1000);
    ok = await ensureLoggedIn(page, false);
  }

  if (!ok) {
    const state = await readAuthState(page);
    throw new Error(`login failed for ${identifier}: ${JSON.stringify(state)}`);
  }
}

async function validateUserFlow(browserName, page) {
  await login(page, LOGIN_IDENTIFIER, LOGIN_PASSWORD);

  await page.goto(`${BASE_URL}/#/editor`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  try {
    await expectTextAny(page, ['发布套餐', '宣传图封面', '提交审核', 'Publish Server', 'Cover Image'], 'real server editor');
  } catch (error) {
    const debugDir = path.resolve(process.cwd(), 'logs');
    fs.mkdirSync(debugDir, { recursive: true });
    const htmlPath = path.join(debugDir, `browser-auth-${browserName}-editor.html`);
    const shotPath = path.join(debugDir, `browser-auth-${browserName}-editor.png`);
    fs.writeFileSync(htmlPath, await page.content(), 'utf8');
    await page.screenshot({ path: shotPath, fullPage: true });
    throw new Error(`${browserName}: real server editor missing @ ${page.url()} html=${htmlPath} screenshot=${shotPath} :: ${error.message}`);
  }
  const editorHtml = await page.content();
  if (/Hero_Matrix|Identity Matrix|BROADCAST_NEW_NODE/.test(editorHtml)) {
    throw new Error(`${browserName}: editor still contains demo text`);
  }

  await page.goto(`${BASE_URL}/#/rules`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const rulesUrl = page.url();
  if (rulesUrl.includes('/team')) {
    throw new Error(`${browserName}: rules redirected to team`);
  }
  await expectTextAny(page, ['等级', '签到', '经验', 'Level'], 'rules content');
}

async function validateAdminFlow(browserName, page) {
  await login(page, ADMIN_IDENTIFIER, ADMIN_PASSWORD);

  await page.goto(`${BASE_URL}/#/admin-qianfu`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await expectTextAny(page, ['支付配置', '支付项目', '运行状态'], 'admin payment config');
  const adminHtml = await page.content();
  if (/Simulate Success/i.test(adminHtml)) {
    throw new Error(`${browserName}: simulate success still visible`);
  }

  await page.goto(`${BASE_URL}/promotion/tasks`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  if (page.url().includes('/login')) {
    await page.goto(`${BASE_URL}/#/promotion/tasks`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
  }
  try {
    await expectTextAny(
      page,
      ['任务列表', '新建任务', '推广任务 / 规则配置', '任务列表已启用', '当前没有推广任务'],
      'promo tasks',
    );
  } catch (error) {
    const debugDir = path.resolve(process.cwd(), 'logs');
    fs.mkdirSync(debugDir, { recursive: true });
    const htmlPath = path.join(debugDir, `browser-auth-${browserName}-promo.html`);
    const shotPath = path.join(debugDir, `browser-auth-${browserName}-promo.png`);
    fs.writeFileSync(htmlPath, await page.content(), 'utf8');
    await page.screenshot({ path: shotPath, fullPage: true });
    throw new Error(`${browserName}: promo tasks missing @ ${page.url()} html=${htmlPath} screenshot=${shotPath} :: ${error.message}`);
  }
  const promoHtml = await page.content();
  if (/CREATE_SAMPLE_TASK/i.test(promoHtml)) {
    throw new Error(`${browserName}: sample task trigger still visible`);
  }
}

async function main() {
  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopContext = await desktopBrowser.newContext({ viewport: { width: 1440, height: 960 } });
  const desktopPage = await desktopContext.newPage();
  const adminContext = await desktopBrowser.newContext({ viewport: { width: 1440, height: 960 } });
  const adminPage = await adminContext.newPage();

  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({
    ...devices['iPhone 13'],
  });
  const mobilePage = await mobileContext.newPage();

  try {
    await validateUserFlow('desktop', desktopPage);
    await validateUserFlow('mobile', mobilePage);
    await validateAdminFlow('desktop-admin', adminPage);
    console.log('[browser:auth-validation] PASS');
  } finally {
    await desktopContext.close();
    await adminContext.close();
    await desktopBrowser.close();
    await mobileContext.close();
    await mobileBrowser.close();
  }
}

main().catch((error) => {
  console.error('[browser:auth-validation] FAIL', error);
  process.exit(1);
});

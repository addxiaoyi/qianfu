const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'https://mc-u.top';
const OUT_DIR = path.resolve(process.cwd(), 'output', 'ui-audit-2026-05-21');

function hashPath(route) {
  if (route === '/') return `${BASE_URL}/#/`;
  return `${BASE_URL}/#${route}`;
}

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function waitStable(page, ms = 800) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await page.waitForTimeout(ms);
}

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();

  const checks = [];

  try {
    // Public login form input interaction
    await page.goto(hashPath('/login'), { waitUntil: 'domcontentloaded' });
    await waitStable(page, 1200);
    const beforeLoginUrl = page.url();
    const idInput = page.locator('input[autocomplete="username"], input[name="identifier"], input[type="text"]').first();
    const pwInput = page.locator('input[autocomplete="current-password"], input[name="password"], input[type="password"]').first();

    await idInput.click();
    await idInput.fill('public_check_user');
    await pwInput.click();
    await pwInput.fill('public_check_pass');
    await waitStable(page, 600);

    const afterLoginUrl = page.url();
    const loginOk = afterLoginUrl === beforeLoginUrl && !afterLoginUrl.includes('#/mobile');
    const loginShot = path.join(OUT_DIR, 'shots', 'mobile', 'public-input', 'login-input.png');
    await ensureDir(path.dirname(loginShot));
    await page.screenshot({ path: loginShot, fullPage: true });
    checks.push({
      step: 'mobile-login-input-public',
      ok: loginOk,
      beforeUrl: beforeLoginUrl,
      afterUrl: afterLoginUrl,
      screenshot: loginShot,
    });

    // Public forgot-password form input interaction
    await page.goto(hashPath('/forgot-password'), { waitUntil: 'domcontentloaded' });
    await waitStable(page, 1200);
    const beforeForgotUrl = page.url();
    const emailInput = page.locator('input[type="email"], input[autocomplete="email"], input[placeholder*="mail"], input[placeholder*="邮箱"]').first();
    await emailInput.click();
    await emailInput.fill('public_check@local.test');
    await waitStable(page, 600);
    const afterForgotUrl = page.url();
    const forgotOk = afterForgotUrl === beforeForgotUrl && !afterForgotUrl.includes('#/mobile');
    const forgotShot = path.join(OUT_DIR, 'shots', 'mobile', 'public-input', 'forgot-input.png');
    await page.screenshot({ path: forgotShot, fullPage: true });
    checks.push({
      step: 'mobile-forgot-input-public',
      ok: forgotOk,
      beforeUrl: beforeForgotUrl,
      afterUrl: afterForgotUrl,
      screenshot: forgotShot,
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

  const outFile = path.join(OUT_DIR, 'mobile-public-input-report.json');
  await fs.promises.writeFile(outFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ outFile, total: report.total, failed: report.failed, failedChecks: report.failedChecks }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});


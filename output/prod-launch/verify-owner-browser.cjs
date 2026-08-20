'use strict';

const { chromium } = require('playwright');

const baseUrl = 'https://mc-u.top';
const identifier = process.env.QA_OWNER_EMAIL;
const password = process.env.QA_OWNER_PASSWORD;

if (!identifier || !password) {
  throw new Error('Missing OWNER fixture credentials');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openPage(page, path) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await sleep(800);
      return;
    } catch (error) {
      lastError = error;
      await sleep(1_500);
    }
  }
  throw lastError;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--proxy-server=direct://', '--proxy-bypass-list=*'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  const badResponses = [];
  const consoleErrors = [];

  page.on('response', (response) => {
    const request = response.request();
    if (!['document', 'fetch', 'xhr'].includes(request.resourceType())) return;
    if (response.status() < 400) return;
    badResponses.push({
      status: response.status(),
      method: request.method(),
      path: new URL(response.url()).pathname,
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await openPage(page, '/login');
    await page.locator('input[autocomplete="username"], input[name="identifier"]').first().fill(identifier);
    await page.locator('input[autocomplete="current-password"], input[name="password"]').first().fill(password);

    const agreement = page.locator('form button[type="button"]').first();
    if (await agreement.count()) await agreement.click();

    await page.locator('form button[type="submit"]').first().click();
    await page.waitForResponse(
      (response) => response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sleep(1_000);

    const profile = await page.evaluate(async () => {
      const response = await fetch('/api/v1/profile', { credentials: 'include' });
      const payload = await response.json().catch(() => null);
      const user = payload?.data?.user ?? payload?.data ?? payload?.user ?? payload;
      return { status: response.status, role: user?.role ?? null };
    });

    await openPage(page, '/admin');
    const adminPath = new URL(page.url()).pathname;
    await openPage(page, '/promotion/tasks');
    const promoPath = new URL(page.url()).pathname;

    const stats = await page.evaluate(async () => {
      const response = await fetch('/api/v1/admin/stats', { credentials: 'include' });
      const body = await response.json().catch(() => null);
      return { status: response.status, code: body?.error?.code ?? null };
    });
    await sleep(1_000);

    const forbidden = badResponses.filter((item) => item.status === 403);
    const serverErrors = badResponses.filter((item) => item.status >= 500);
    const ok = profile.status === 200
      && profile.role === 'OWNER'
      && adminPath === '/admin'
      && promoPath === '/promotion/tasks'
      && stats.status === 200
      && forbidden.length === 0
      && serverErrors.length === 0;

    process.stdout.write(JSON.stringify({
      ok,
      profile,
      adminPath,
      promoPath,
      stats,
      badResponses,
      consoleErrors,
    }));
    if (!ok) process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
});

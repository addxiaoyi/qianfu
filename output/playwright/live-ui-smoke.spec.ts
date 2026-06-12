import { expect, test } from '@playwright/test';

const baseUrl = process.env.SMOKE_WEB_BASE_URL || 'https://mc-u.top';
const loginIdentifier = process.env.SMOKE_LOGIN_IDENTIFIER || 'dev_local';
const loginPassword = process.env.SMOKE_LOGIN_PASSWORD || 'dev123456';
const registerDomain = process.env.SMOKE_REGISTER_EMAIL_DOMAIN || '0st.top';

test.describe('live UI smoke', () => {
  test('login reaches dashboard and mobile routes fit viewport', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text());
      }
    });

    await page.goto(`${baseUrl}/#/login`, { waitUntil: 'networkidle' });
    await page.locator('main input[name="identifier"]').fill(loginIdentifier);
    await page.locator('main input[name="password"]').fill(loginPassword);
    await page.locator('main form button[type="button"]').click();
    await page.locator('main form button[type="submit"]').click();
    await page.waitForURL(/#\/dashboard/, { timeout: 20_000 });
    await expect(page.locator('body')).toContainText(/Dashboard|控制台|每日|等级/);
    await page.screenshot({ path: 'output/playwright/live-dashboard-after-login.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/#/mobile`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: 'output/playwright/live-mobile-home.png', fullPage: true });

    expect(pageErrors.filter((item) => !item.includes('favicon'))).toEqual([]);
  });

  test('register UI submits and lands on verification page', async ({ page }) => {
    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const email = `ui_${suffix}@${registerDomain}`;
    const username = `ui_${suffix}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28);
    const password = `Sm0ke_${Math.random().toString(16).slice(2, 10)}_A1`;

    await page.goto(`${baseUrl}/#/register`, { waitUntil: 'networkidle' });
    await page.locator('main input[name="username"]').fill(username);
    await page.locator('main input[name="email"]').fill(email);
    await page.locator('main input[name="password"]').fill(password);
    await page.locator('main input[name="confirmPassword"]').fill(password);
    await page.locator('main form button[type="button"]').click();
    await page.locator('main form button[type="submit"]').click();
    await page.waitForURL(new RegExp(`#\\/verify-code\\?email=${encodeURIComponent(email)}`), {
      timeout: 25_000,
    });
    await expect(page.locator('body')).toContainText(/验证码|Verify|邮箱/);
    await page.screenshot({ path: 'output/playwright/live-register-verify.png', fullPage: true });
  });
});

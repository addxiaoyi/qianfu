const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve(process.cwd(), 'output', 'ui-audit-2026-05-21');
const LOCAL_AUTH_TOKEN_KEY = 'qf_local_auth_token';
const USER_LOGIN = {
  identifier: process.env.QA_LOGIN_IDENTIFIER || process.env.QA_LOGIN_USER || '',
  password: process.env.QA_LOGIN_PASSWORD || '',
};
const ADMIN_LOGIN = {
  identifier: process.env.QA_ADMIN_IDENTIFIER || process.env.QA_ADMIN_USER || '',
  password: process.env.QA_ADMIN_PASSWORD || '',
};
const USER_REQUIRED = process.env.QA_USER_REQUIRED === 'true';
const ADMIN_REQUIRED = process.env.QA_ADMIN_REQUIRED === 'true';
const HAS_EXPLICIT_USER_LOGIN = Boolean(USER_LOGIN.identifier && USER_LOGIN.password);
const HAS_EXPLICIT_ADMIN_LOGIN = Boolean(process.env.QA_ADMIN_IDENTIFIER || process.env.QA_ADMIN_USER)
  && Boolean(process.env.QA_ADMIN_PASSWORD);

const desktopPublicRoutes = [
  '/', '/servers', '/search', '/news', '/rules', '/resources', '/team', '/promotion', '/terms', '/privacy', '/login', '/register', '/forgot-password'
];

const desktopUserRoutes = [
  '/dashboard', '/tickets', '/tickets/new', '/me', '/me/edit', '/me/favorites', '/me/tags', '/messages', '/me/notifications', '/editor', '/marketplace/shop', '/marketplace/manage', '/marketplace/favorites', '/promotion/tasks', '/promotion/claims'
];

const desktopAdminRoutes = [
  '/admin', '/admin-users', '/admin-review', '/admin-tickets', '/admin-reports', '/admin-audit', '/admin-audit-stats', '/admin-moderation', '/admin-port5555', '/admin-settings', '/admin-mail', '/admin-announcements', '/admin-promo/tasks', '/admin-promo/claims'
];

const mobileRoutes = [
  '/mobile', '/servers', '/search', '/news', '/team', '/tickets', '/tickets/new', '/me', '/me/edit', '/me/favorites', '/me/tags', '/me/settings', '/me/notifications', '/marketplace/favorites', '/messages', '/editor', '/dashboard'
];

const mobilePublicRoutes = ['/mobile', '/servers', '/search', '/news', '/team'];

function hashPath(route) {
  const base = BASE_URL.replace(/\/$/, '');
  if (process.env.QA_USE_HASH_ROUTES === 'true') return route === '/' ? `${base}/#/` : `${base}/#${route}`;
  return route === '/' ? `${base}/` : `${base}${route}`;
}

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function waitPageStable(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function snapshot(page) {
  const errs = await page.locator('text=/TypeError|ReferenceError|Unhandled|An unexpected error occurred|Cannot read/i').count();
  const body = await page.locator('body').innerText();
  const textLen = body.trim().length;
  const title = await page.title();
  return { errs, textLen, title, bodyStart: body.slice(0, 220), body };
}

async function readAuthState(page) {
  return await page.evaluate(async ({ tokenKey }) => {
    const token =
      window.sessionStorage.getItem(tokenKey) ||
      window.localStorage.getItem(tokenKey);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch('/api/v1/profile', {
        method: 'GET',
        credentials: 'include',
        headers,
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
  }, { tokenKey: LOCAL_AUTH_TOKEN_KEY });
}

async function ensureLoggedIn(page, expectAdmin = false) {
  const state = await readAuthState(page);
  if (!state.profileOk) return false;
  if (expectAdmin && !['ADMIN', 'SUPER_ADMIN'].includes(state.role)) return false;
  return true;
}

async function login(page, creds, expectAdmin = false) {
  await page.goto(hashPath('/login'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const loginForm = page.locator('form').first();
  const idInput = loginForm.locator('input[autocomplete="username"], input[name="identifier"], input[type="text"]').first();
  const pwInput = loginForm.locator('input[autocomplete="current-password"], input[name="password"], input[type="password"]').first();

  if (await idInput.count()) {
    await idInput.fill(creds.identifier);
    await pwInput.fill(creds.password);
    const agreeBtn = page.getByRole('button', { name: /同意|agree/i }).first();
    if (await agreeBtn.count()) await agreeBtn.click();
    const submitButton = loginForm.locator('button[type="submit"]').first();
    await Promise.allSettled([
      page.waitForResponse((resp) => resp.url().includes('/api/v1/auth/login') && resp.request().method() === 'POST', { timeout: 15000 }),
      submitButton.click(),
    ]);
    await page.waitForTimeout(1800);
  }

  let ok = await ensureLoggedIn(page, expectAdmin);
  if (!ok) {
    // Fallback: direct API login for audit robustness when UI selectors or layout shift.
    await page.evaluate(
      async ({ identifier, password, tokenKey }) => {
        const resp = await fetch('/api/v1/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const json = await resp.json().catch(() => null);
        const token = json?.data?.token || json?.token || null;
        if (token) {
          window.sessionStorage.setItem(tokenKey, token);
        }
      },
      { identifier: creds.identifier, password: creds.password, tokenKey: LOCAL_AUTH_TOKEN_KEY },
    );
    await page.waitForTimeout(800);
    ok = await ensureLoggedIn(page, expectAdmin);
  }

  if (!ok) {
    const state = await readAuthState(page);
    throw new Error(`login failed for ${creds.identifier}: ${JSON.stringify(state)}`);
  }
}

function isProtectedRoute(route) {
  const protectedPrefixes = ['/dashboard', '/tickets', '/me', '/messages', '/editor', '/marketplace/manage', '/marketplace/favorites', '/admin', '/promotion/tasks', '/promotion/claims'];
  return protectedPrefixes.some((p) => route === p || route.startsWith(`${p}/`));
}

async function runSection(page, routes, section, tag, options = { loggedIn: false }) {
  const results = [];
  const shotDir = path.join(OUT_DIR, 'shots', tag, section);
  await ensureDir(shotDir);

  for (const route of routes) {
    const url = hashPath(route);
    let ok = true;
    let note = '';
    let redirectedToLogin = false;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitPageStable(page);
      const info = await snapshot(page);
      const currentUrl = page.url();

      if ((currentUrl.includes('#/login') || new URL(currentUrl).pathname === '/login') && route !== '/login') {
        redirectedToLogin = true;
      }

      if (info.errs > 0) {
        ok = false;
        note = `error-text:${info.errs}`;
      }
      if (info.textLen < 40) {
        ok = false;
        note = `${note}|low-text`;
      }

      if (options.loggedIn && isProtectedRoute(route) && redirectedToLogin) {
        ok = false;
        note = `${note}|unexpected-login-redirect`;
      }

      const safeName = route.replace(/[\/:*?"<>|]/g, '_').replace(/^_+/, '') || 'root';
      const shotPath = path.join(shotDir, `${safeName}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });

      results.push({ section, route, url: currentUrl, ok, note, redirectedToLogin, title: info.title, textLen: info.textLen, screenshot: shotPath });
    } catch (e) {
      ok = false;
      note = String(e && e.message ? e.message : e);
      results.push({ section, route, url, ok, note, redirectedToLogin, title: '', textLen: 0, screenshot: '' });
    }
  }
  return results;
}

(async () => {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });

  const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const deskPage = await deskCtx.newPage();
  if (USER_REQUIRED && !HAS_EXPLICIT_USER_LOGIN) {
    throw new Error('QA_USER_REQUIRED=true but QA_LOGIN_IDENTIFIER/QA_LOGIN_USER and QA_LOGIN_PASSWORD were not provided');
  }
  if (ADMIN_REQUIRED && !HAS_EXPLICIT_ADMIN_LOGIN) {
    throw new Error('QA_ADMIN_REQUIRED=true but QA_ADMIN_IDENTIFIER/QA_ADMIN_USER and QA_ADMIN_PASSWORD were not provided');
  }
  const adminCtx = HAS_EXPLICIT_ADMIN_LOGIN
    ? await browser.newContext({ viewport: { width: 1440, height: 960 } })
    : null;
  const adminPage = adminCtx ? await adminCtx.newPage() : null;
  const mobileCtx = await browser.newContext({ ...devices['iPhone 13'] });
  const mobilePage = await mobileCtx.newPage();

  const results = [];
  results.push(...await runSection(deskPage, desktopPublicRoutes, 'desktop-public', 'desktop'));

  const skippedSections = [];
  if (HAS_EXPLICIT_USER_LOGIN) {
    await login(deskPage, USER_LOGIN, false);
    results.push(...await runSection(deskPage, desktopUserRoutes, 'desktop-user', 'desktop', { loggedIn: true }));
  } else {
    results.push(...await runSection(deskPage, desktopUserRoutes.filter(isProtectedRoute), 'desktop-auth-boundary', 'desktop'));
    skippedSections.push({
      section: 'desktop-user',
      reason: 'QA_LOGIN_IDENTIFIER/QA_LOGIN_USER and QA_LOGIN_PASSWORD were not provided',
      routes: desktopUserRoutes,
    });
  }
  if (adminPage) {
    await login(adminPage, ADMIN_LOGIN, true);
    results.push(...await runSection(adminPage, desktopAdminRoutes, 'desktop-admin', 'desktop', { loggedIn: true }));
  } else {
    skippedSections.push({
      section: 'desktop-admin',
      reason: 'QA_ADMIN_IDENTIFIER/QA_ADMIN_USER and QA_ADMIN_PASSWORD were not provided',
      routes: desktopAdminRoutes,
    });
  }

  if (HAS_EXPLICIT_USER_LOGIN) {
    await login(mobilePage, USER_LOGIN, false);
    results.push(...await runSection(mobilePage, mobileRoutes, 'mobile-user', 'mobile', { loggedIn: true }));
  } else {
    results.push(...await runSection(mobilePage, mobilePublicRoutes, 'mobile-public', 'mobile'));
    results.push(...await runSection(mobilePage, mobileRoutes.filter(isProtectedRoute), 'mobile-auth-boundary', 'mobile'));
    skippedSections.push({
      section: 'mobile-user',
      reason: 'QA_LOGIN_IDENTIFIER/QA_LOGIN_USER and QA_LOGIN_PASSWORD were not provided',
      routes: mobileRoutes,
    });
  }

  await deskCtx.close();
  if (adminCtx) await adminCtx.close();
  await mobileCtx.close();
  await browser.close();

  const failed = results.filter(r => !r.ok);
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: results.length,
    failed: failed.length,
    failedRoutes: failed.map(f => ({ section: f.section, route: f.route, note: f.note, url: f.url })),
    skippedSections,
    results
  };

  const outFile = path.join(OUT_DIR, 'report.json');
  await fs.promises.writeFile(outFile, JSON.stringify(summary, null, 2), 'utf8');

  console.log(JSON.stringify({ outFile, total: summary.total, failed: summary.failed, failedRoutes: summary.failedRoutes }, null, 2));
})();

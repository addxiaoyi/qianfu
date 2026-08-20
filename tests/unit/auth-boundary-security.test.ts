import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isDevAuthBypassEnabled } from '../../server/services/devAuth';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const adminConfigSource = read('server/core/controller/AdminConfigController.ts');
const githubControllerSource = read('server/controllers/githubAuthController.ts');
const oauthCallbackSource = read('qianfu-liandeng/src/pages/auth/OAuthCallback.tsx');
const originalNodeEnv = process.env.NODE_ENV;
const originalDevAuthEnabled = process.env.DEV_AUTH_ENABLED;
const originalDevAuthUsername = process.env.DEV_AUTH_USERNAME;
const originalDevAuthPassword = process.env.DEV_AUTH_PASSWORD;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalDevAuthEnabled === undefined) {
    delete process.env.DEV_AUTH_ENABLED;
  } else {
    process.env.DEV_AUTH_ENABLED = originalDevAuthEnabled;
  }

  if (originalDevAuthUsername === undefined) {
    delete process.env.DEV_AUTH_USERNAME;
  } else {
    process.env.DEV_AUTH_USERNAME = originalDevAuthUsername;
  }

  if (originalDevAuthPassword === undefined) {
    delete process.env.DEV_AUTH_PASSWORD;
  } else {
    process.env.DEV_AUTH_PASSWORD = originalDevAuthPassword;
  }
});

describe('authentication boundary hardening', () => {
  it('never enables the development authentication bypass outside development', () => {
    process.env.DEV_AUTH_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    expect(isDevAuthBypassEnabled()).toBe(false);

    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_USERNAME = 'local-admin';
    process.env.DEV_AUTH_PASSWORD = 'local-only-Strong-Password-42!';
    expect(isDevAuthBypassEnabled()).toBe(true);
  });

  it('uses the HttpOnly session cookie instead of redirecting an OAuth JWT', () => {
    expect(githubControllerSource).toContain('return res.redirect(buildFrontendCallbackUrl({}));');
    expect(githubControllerSource).not.toContain('token,\n      email: profile.email');
    expect(oauthCallbackSource).not.toContain('setLocalAuthToken');
    expect(oauthCallbackSource).not.toContain('OAuth callback token missing');
  });

  it('protects and redacts the legacy QianFu configuration route', () => {
    const guardIndex = adminConfigSource.indexOf('router.use(authenticate, adminOnly);');
    const getIndex = adminConfigSource.indexOf("router.get('/config/qianfu'");

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeLessThan(getIndex);
    expect(adminConfigSource).toContain("router.post('/config/qianfu', csrfProtection,");
    expect(adminConfigSource).toContain('secretKeyConfigured: Boolean(adminConfig.qianfu.secretKey)');
    expect(adminConfigSource).not.toContain('data: adminConfig.qianfu');
  });
});

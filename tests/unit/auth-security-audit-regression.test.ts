import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getDevAuthPassword,
  getDevAuthUsername,
  isDevAuthBypassEnabled,
} from '../../server/services/devAuth';
import { changePasswordSchema } from '../../server/utils/validation';

const AUTH_SOURCE_FILES = [
  'server/controllers/authController.ts',
  'server/controllers/authCodeController.ts',
  'server/controllers/registerController.ts',
] as const;

const ENV_KEYS = [
  'NODE_ENV',
  'DEV_AUTH_ENABLED',
  'DEV_AUTH_USERNAME',
  'DEV_AUTH_PASSWORD',
] as const;

const originalEnv = new Map(
  ENV_KEYS.map((key) => [key, process.env[key]] as const),
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('auth audit security regressions', () => {
  it('fails closed when dev auth is enabled without explicit credentials', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_ENABLED = 'true';
    delete process.env.DEV_AUTH_USERNAME;
    delete process.env.DEV_AUTH_PASSWORD;

    expect(() => isDevAuthBypassEnabled()).toThrow('DEV_AUTH_USERNAME is required');
  });

  it('rejects weak dev auth passwords and accepts explicit strong credentials', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_ENABLED = 'true';
    process.env.DEV_AUTH_USERNAME = 'local-admin';
    process.env.DEV_AUTH_PASSWORD = 'too-short';

    expect(() => getDevAuthPassword()).toThrow('at least 12 characters');

    process.env.DEV_AUTH_PASSWORD = 'local-only-Strong-Password-42!';
    expect(isDevAuthBypassEnabled()).toBe(true);
    expect(getDevAuthUsername()).toBe('local-admin');
    expect(getDevAuthPassword()).toBe('local-only-Strong-Password-42!');
  });

  it('requires a strong new password that differs from the current password', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'Current-Password-42!',
      newPassword: 'weakpass',
    }).success).toBe(false);

    expect(changePasswordSchema.safeParse({
      currentPassword: 'Current-Password-42!',
      newPassword: 'Current-Password-42!',
    }).success).toBe(false);

    expect(changePasswordSchema.safeParse({
      currentPassword: 'Current-Password-42!',
      newPassword: 'Replacement-Password-84!',
      confirmPassword: 'Replacement-Password-84!',
    }).success).toBe(true);
  });

  it('uses cryptographically secure six-digit codes across auth flows', () => {
    for (const path of AUTH_SOURCE_FILES) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).toContain('crypto.randomInt(100000, 1000000)');
      expect(source).not.toContain('Math.random() * 900000');
    }
  });

  it('uses Redis atomic counters for login-code lockout without resetting login metrics', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/controllers/authCodeController.ts'), 'utf8');
    expect(source).toContain('redisService.incr(key, LOCKOUT_DURATION_SECONDS)');
    expect(source).toContain('await redisService.del(loginCodeAttemptKey(userId))');
    expect(source).toContain('await assertLoginCodeNotLocked(user.id)');
    expect(source).toContain('login_count: { increment: 1 }');
    expect(source).not.toContain('const nextCount = (user.login_count || 0) + 1');
    expect(source).not.toContain('data: { login_count: 0, login_lockout_at: null }');
  });

  it('does not retain predictable dev auth credential literals', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/services/devAuth.ts'), 'utf8');
    expect(source).not.toContain("'devadmin'");
    expect(source).not.toContain("'devpass123'");
  });
});

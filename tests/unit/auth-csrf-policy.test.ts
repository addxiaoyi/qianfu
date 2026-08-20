import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const csrf = readFileSync(resolve(process.cwd(), 'server/middleware/csrf.ts'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'server/routes/auth.ts'), 'utf8');
const loginPage = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/Login.tsx'), 'utf8');
const registerPage = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/Register.tsx'), 'utf8');
const smoke = readFileSync(resolve(process.cwd(), 'scripts/smoke-auth-register-mail.ts'), 'utf8');

describe('authentication CSRF policy', () => {
  it('does not bypass all authentication POST requests', () => {
    expect(csrf).not.toContain("requestPath === '/auth' || requestPath.startsWith('/auth/')");
    expect(csrf).not.toContain("fullPath.startsWith('/api/v1/auth/')");
  });

  it('allows configured bypass paths only outside production', () => {
    expect(csrf).toContain("process.env.NODE_ENV !== 'production' && bypassCSRF.some");
  });

  it.each([
    "router.post('/auth/login', csrfProtection,",
    "router.post('/logout', authenticate, csrfProtection,",
    "router.post('/change-password', authenticate, csrfProtection,",
    "router.delete('/sessions/:sessionId', authenticate, csrfProtection,",
  ])('protects state-changing route %s', (declaration) => {
    expect(routes).toContain(declaration);
  });

  it.each([
    "router.post('/auth/send-code', csrfProtection, authLimiter, validateBody(authCodeRequestSchema),",
    "router.post('/auth/verify-code', csrfProtection, authLimiter, validateBody(authCodeVerifySchema),",
    "router.post('/auth/register', csrfProtection, authLimiter, validateBody(registerSchema),",
    "router.post('/auth/login', csrfProtection, authBruteForceLimiter, authLimiter, validateBody(loginSchema),",
    "router.post('/auth/forgot-password', csrfProtection, authLimiter, validateBody(forgotPasswordSchema),",
    "router.post('/auth/reset-password', csrfProtection, authBruteForceLimiter, authLimiter, validateBody(resetPasswordCodeSchema),",
    "router.post('/auth/password-reset', csrfProtection, authBruteForceLimiter, authLimiter, validateBody(resetPasswordTokenSchema),",
  ])('validates authentication request body for %s', (declaration) => {
    expect(routes).toContain(declaration);
  });

  it('lets the API client acquire CSRF for login and registration', () => {
    expect(loginPage).not.toContain("{ skipCsrf: true }");
    expect(registerPage).not.toContain("{ skipCsrf: true }");
  });

  it('returns the complete CSRF token required for request verification', () => {
    expect(routes).toContain(
      "sendSuccess(res, { csrfToken: token }, 'Success', 200, undefined, { mask: false });",
    );
    expect(routes).not.toContain('sendSuccess(res, { csrfToken: token });');
  });

  it('acquires a CSRF token before the first password login smoke request', () => {
    expect(smoke.indexOf("requestJson('/api/v1/csrf-token'"))
      .toBeLessThan(smoke.indexOf("requestJson('/api/v1/auth/login'"));
  });
});

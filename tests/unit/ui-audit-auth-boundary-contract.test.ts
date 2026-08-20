import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const audit = readFileSync(resolve(process.cwd(), 'scripts/ui-full-audit.cjs'), 'utf8');

describe('full UI audit authentication boundaries', () => {
  it('never falls back to hard-coded QA passwords', () => {
    expect(audit).not.toContain('QaTest123!');
    expect(audit).not.toContain('QaAdmin123!');
    expect(audit).toContain('HAS_EXPLICIT_USER_LOGIN');
    expect(audit).toContain('HAS_EXPLICIT_ADMIN_LOGIN');
  });

  it('supports secure cookie sessions and current history routes', () => {
    expect(audit).toContain("credentials: 'include'");
    expect(audit).toContain("process.env.QA_USE_HASH_ROUTES === 'true'");
    expect(audit).toContain("'/me/favorites'");
    expect(audit).toContain("'/me/tags'");
    expect(audit).toContain("'/marketplace/favorites'");
    expect(audit).toContain("'/admin-announcements'");
  });

  it('audits login redirects without mutating production users when credentials are absent', () => {
    expect(audit).toContain("desktopUserRoutes.filter(isProtectedRoute)");
    expect(audit).toContain("mobileRoutes.filter(isProtectedRoute)");
    expect(audit).toContain("section: 'desktop-user'");
    expect(audit).toContain("section: 'mobile-user'");
  });

  it('always audits public mobile pages without requiring a QA account', () => {
    expect(audit).toContain('const mobilePublicRoutes =');
    expect(audit).toContain("runSection(mobilePage, mobilePublicRoutes, 'mobile-public'");
  });
});

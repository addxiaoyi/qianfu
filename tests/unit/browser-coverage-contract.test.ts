import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const publicAudit = readFileSync(resolve(root, 'scripts/public-live-browser-audit.cjs'), 'utf8');
const authAudit = readFileSync(resolve(root, 'scripts/browser-nonpay-auth-validation.cjs'), 'utf8');
const seoHead = readFileSync(resolve(root, 'qianfu-liandeng/src/components/ui/SeoHead.tsx'), 'utf8');

describe('browser coverage contract', () => {
  it('covers public recovery and compliance routes in the live audit', () => {
    for (const route of [
      '/login/oauth',
      '/reset-password',
      '/verify-code',
      '/terms',
      '/privacy',
      '/compliance',
      '/dashboard/billing',
    ]) {
      expect(publicAudit).toContain(`url: \`${'${BASE_URL}'}${route}`);
    }
  });

  it('covers authenticated account, server, and admin news routes', () => {
    for (const route of ['/settings', '/me/settings', '/dashboard/servers']) {
      expect(authAudit).toContain(`path: '${route}'`);
    }
    expect(authAudit).toContain("path: '/admin-announcements'");
  });

  it('gives the OAuth selection page a stable login title', () => {
    expect(seoHead).toContain("'/login/oauth': {");
    expect(seoHead).toContain("title: '第三方登录 - 千服联灯'");
  });
});

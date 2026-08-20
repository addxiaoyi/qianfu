import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('free domain DNS feature contracts', () => {
  it('keeps provider credential values out of admin responses and UI state', () => {
    const controller = read('server/controllers/freeDomainDnsController.ts');
    const page = read('qianfu-liandeng/src/pages/admin/AdminFreeDomains.tsx');
    expect(controller).toContain('maskDnsProviderConfig');
    expect(controller).toContain('credentialConfigured');
    expect(page).toContain('credentialConfigured');
    expect(page).toContain('type="password"');
    expect(page).not.toContain('stored-token');
    expect(page).not.toContain('stored-secret');
    expect(controller).not.toContain('getConfig(');
  });

  it('exposes the user publish controls and async DNS status copy', () => {
    const page = read('qianfu-liandeng/src/pages/ServerEditor.tsx');
    expect(page).toContain('freeDomainEnabled');
    expect(page).toContain('免费域名后缀');
    expect(page).toContain('完整域名预览');
    expect(page).toContain('审核通过后自动配置 DNS');
  });

  it('provides an admin create flow before editing provider credentials', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminFreeDomains.tsx');
    expect(page).toContain("api.post('/admin/free-domain-suffixes'");
    expect(page).toContain('新增域名后缀');
    expect(page).toContain('setPolicyDrafts');
    expect(page).not.toContain('item.prefix_pattern =');
    expect(page).not.toContain('item.ttl =');
    expect(page).not.toContain('item.quota_per_user =');
  });

  it('uses a custom provider menu instead of a native select', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminFreeDomains.tsx');
    expect(page).toContain('role="listbox"');
    expect(page).toContain('aria-expanded={open}');
    expect(page).toContain('DNS 服务商');
    expect(page).not.toContain('<select');
  });

  it('keeps Cloudflare OAuth state short-lived and credentials server-side', () => {
    const controller = read('server/controllers/freeDomainDnsController.ts');
    const provider = read('server/services/freeDomainDnsProvider.ts');
    const page = read('qianfu-liandeng/src/pages/admin/AdminFreeDomains.tsx');
    expect(controller).toContain('OAUTH_TTL_SECONDS = 600');
    expect(controller).toContain('saveCloudflareOauthToken(pending.suffixId');
    expect(controller).toContain('CLOUDFLARE_OAUTH_CLIENT_SECRET');
    expect(provider).toContain('setConfig(cloudflareOauthKey(suffixId), token, true');
    expect(page).toContain('连接 Cloudflare');
    expect(page).toContain('oauthConfigured');
    expect(page).not.toContain('client_secret');
  });

  it('scopes the DNS admin permission guard to admin routes', () => {
    const routes = read('server/routes/freeDomainDns.ts');

    expect(routes).toContain("router.use('/admin', authenticate, adminLimiter, hasPermission(['manage_content']))");
    expect(routes).not.toContain("router.use(authenticate, adminLimiter, hasPermission(['manage_content']))");
  });
});

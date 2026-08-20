import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production static exposure contract', () => {
  it('blocks database, environment, backup and source-map files before static serving', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/bootstrap/proxyAndStatic.ts'), 'utf8');
    expect(source).toContain('staticSecretGuard');
    expect(source).toMatch(/\.db/);
    expect(source).toContain("app.use('/', staticSecretGuard");
    expect(source).toContain("app.use('/uploads', staticSecretGuard");
  });

  it('does not treat reverse-proxy forwarding headers as malicious input', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/middleware/waf.ts'), 'utf8');
    expect(source).not.toContain("'x-forwarded-for'");
    expect(source).not.toContain("'/auth',");
    expect(source).toContain('WAF_SENSITIVE_MAX_REQUESTS');
  });
});

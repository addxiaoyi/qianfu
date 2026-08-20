import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'server/core/controller/QianFuController.ts'), 'utf8');

describe('marketplace appeal route contract', () => {
  it('protects user submission with auth, verified email, rate limiting, and CSRF', () => {
    expect(source).toMatch(/router\.post\(['"]\/marketplace\/appeals['"],\s*authenticate,\s*requireVerifiedEmail,\s*marketplaceShopWriteLimiter,\s*csrfProtection/);
  });

  it('protects appeal review with administrator authorization and CSRF', () => {
    expect(source).toMatch(/router\.post\(['"]\/marketplace\/appeals\/:id\/review['"],\s*authenticate,\s*requireVerifiedEmail,\s*adminOnly,\s*adminLimiter,\s*csrfProtection/);
  });
});

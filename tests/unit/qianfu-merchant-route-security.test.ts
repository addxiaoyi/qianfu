import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'server/core/controller/QianFuController.ts'),
  'utf8',
);

describe('QianFu merchant proxy route security', () => {
  it('does not expose retired merchant payment or balance routes', () => {
    for (const route of [
      "router.get('/payment/query/:orderId'",
      "router.get('/account/balance'",
      "router.post('/payment/create'",
      "router.post('/payment/close/:orderId'",
    ]) {
      expect(source).not.toContain(route);
    }
  });

  it('keeps the remaining reconciliation routes behind administrator auth', () => {
    for (const route of [
      '/reconciliation/daily',
      '/reconciliation/summary',
      '/reconciliation/exceptions',
    ]) {
      expect(source).toContain(`router.get('${route}', authenticate, adminOnly, adminLimiter,`);
    }
  });
});

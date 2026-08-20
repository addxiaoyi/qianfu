import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'server/core/controller/QianFuController.ts'),
  'utf8',
);

describe('marketplace persistence safety', () => {
  it('never rebuilds marketplace state by deleting whole tables', () => {
    expect(source).not.toContain('persistMarketplace');
    expect(source).not.toContain('marketplaceProduct.deleteMany');
    expect(source).not.toContain('marketplaceOrder.deleteMany');
  });

  it('uses Prisma directly instead of process-local marketplace snapshots', () => {
    expect(source).not.toMatch(/\blet\s+marketplaceProducts\b/);
    expect(source).not.toMatch(/\blet\s+marketplaceOrders\b/);
    expect(source).not.toContain('loadMarketplace');
    expect(source).not.toContain('marketplaceProducts');
    expect(source).not.toContain('marketplaceOrders');
    expect(source).toContain('prisma.marketplaceProduct.findMany');
    expect(source).toContain('prisma.marketplaceOrder.findMany');
  });
});

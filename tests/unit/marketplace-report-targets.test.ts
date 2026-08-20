import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const controller = readFileSync(resolve(root, 'server/controllers/reportController.ts'), 'utf8');
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
const adminPage = readFileSync(resolve(root, 'qianfu-liandeng/src/pages/admin/AdminReports.tsx'), 'utf8');

describe('marketplace report targets', () => {
  it('stores string marketplace references without weakening legacy numeric targets', () => {
    expect(schema).toContain('target_ref');
    expect(schema).toContain('@@index([target_type, target_ref])');
  });

  it('accepts only explicit report target types', () => {
    expect(controller).toContain("'PRODUCT', 'ORDER', 'MARKETPLACE_REVIEW', 'SELLER'");
    expect(controller).toContain('target_id: z.union');
  });

  it('verifies every marketplace target and scopes order reports to participants', () => {
    expect(controller).toContain("target_type === 'PRODUCT'");
    expect(controller).toContain('prisma.marketplaceProduct.findUnique');
    expect(controller).toContain("target_type === 'ORDER'");
    expect(controller).toContain('prisma.marketplaceOrder.findUnique');
    expect(controller).toContain('order.buyer_id === user.id');
    expect(controller).toContain('order.product.creator_id === user.id');
    expect(controller).toContain("target_type === 'MARKETPLACE_REVIEW'");
    expect(controller).toContain('prisma.marketplaceReview.findUnique');
  });

  it('shows string references in the admin report queue', () => {
    expect(adminPage).toContain('target_ref');
    expect(adminPage).toContain('report.target_ref || report.target_id');
  });
});

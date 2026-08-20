import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const controller = readFileSync(resolve(root, 'server/core/controller/QianFuController.ts'), 'utf8');
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');

describe('marketplace seller moderation', () => {
  it('stores a durable seller status and moderation reason', () => {
    expect(schema).toContain('marketplace_seller_status');
    expect(schema).toContain('marketplace_seller_notes');
    expect(schema).toContain('@@index([marketplace_seller_status])');
  });

  it('requires an active seller for every listing mutation', () => {
    expect(controller.match(/requireActiveMarketplaceSeller\(req\.user\.id\)/g)).toHaveLength(3);
  });

  it('lets only admins suspend a seller and atomically removes their listings', () => {
    const start = controller.indexOf("router.post('/marketplace/sellers/:id/review'");
    const end = controller.indexOf("router.post('/marketplace/products/:id/favorite'", start);
    const route = controller.slice(start, end);

    expect(route).toContain('authenticate, requireVerifiedEmail, adminOnly, csrfProtection');
    expect(route).toContain('marketplaceReviewSellerSchema');
    expect(route).toContain('prisma.$transaction');
    expect(route).toContain('tx.user.update');
    expect(route).toContain('tx.marketplaceProduct.updateMany');
    expect(route).toContain("listing_status: 'SUSPENDED'");
    expect(route).toContain('tx.auditLog.create');
  });
});

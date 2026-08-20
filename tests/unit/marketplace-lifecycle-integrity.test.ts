import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const controller = readFileSync(resolve(root, 'server/core/controller/QianFuController.ts'), 'utf8');
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
const migrations = readdirSync(resolve(root, 'prisma/migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => readFileSync(resolve(root, 'prisma/migrations', entry.name, 'migration.sql'), 'utf8'))
  .join('\n');

const routeSource = (start: string, end: string) => {
  const startAt = controller.indexOf(start);
  const endAt = controller.indexOf(end, startAt);
  return controller.slice(startAt, endAt);
};

describe('marketplace listing lifecycle integrity', () => {
  it('soft-unpublishes products without deleting the order record', () => {
    const unpublishRoute = routeSource(
      "router.post('/marketplace/products/:id/unpublish'",
      "router.post('/marketplace/products/:id/favorite'",
    );

    expect(schema).toMatch(/is_published\s+Boolean\s+@default\(true\)/);
    expect(schema).toContain('@@index([is_published])');
    expect(unpublishRoute).toContain('data: { is_published: false');
    expect(unpublishRoute).not.toContain('marketplaceProduct.delete');
    expect(unpublishRoute).toContain("prisma.marketplaceProduct.findUnique({ where: { id: getRouteParam(req.params.id) } })");
    expect(unpublishRoute).toContain('product.creator_id !== req.user.id');
    expect(unpublishRoute).not.toContain('marketplaceProducts');
  });

  it('allows the owner to publish an existing listing again', () => {
    const publishRoute = routeSource(
      "router.post('/marketplace/products/:id/publish'",
      "router.post('/marketplace/products/:id/favorite'",
    );

    expect(publishRoute).toContain('authenticate, requireVerifiedEmail, csrfProtection');
    expect(publishRoute).toContain("product.listing_status !== 'APPROVED'");
    expect(publishRoute).toContain('data: { is_published: true');
    expect(publishRoute).not.toContain('marketplaceProducts');
  });

  it('enforces one review per purchaser in the database and maps a duplicate to a conflict', () => {
    const reviewRoute = routeSource(
      "router.post('/marketplace/products/:id/reviews'",
      "router.get('/marketplace/shops/:ownerId/config'",
    );

    expect(schema).toContain('@@unique([product_id, user_id])');
    expect(migrations).toContain('MarketplaceReview_product_id_user_id_key');
    expect(reviewRoute).toContain('prisma.$transaction');
    expect(reviewRoute).toContain('isUniqueConstraintError(error)');
  });

  it('returns database-committed product records without process-local authority', () => {
    const createRoute = routeSource(
      "router.post('/marketplace/products',",
      "router.post('/marketplace/orders'",
    );
    const updateRoute = routeSource(
      "router.patch('/marketplace/products/:id'",
      "router.post('/marketplace/products/:id/unpublish'",
    );

    expect(createRoute).toContain('const created = await prisma.$transaction');
    expect(createRoute).toContain('await tx.marketplaceProduct.create');
    expect(createRoute).toContain('await tx.marketplaceProductVersion.create');
    expect(createRoute).toContain('mapMarketplaceProductRecord(created)');
    expect(updateRoute).toContain('const updatedRecord = await prisma.$transaction');
    expect(updateRoute).toContain('await tx.marketplaceProduct.update');
    expect(updateRoute).toContain('await tx.marketplaceProductVersion.create');
    expect(updateRoute).toContain('mapMarketplaceProductRecord(updatedRecord)');
    expect(createRoute).not.toContain('marketplaceProducts');
    expect(updateRoute).not.toContain('marketplaceProducts');
  });

  it('filters unapproved and unpublished products from public catalog responses', () => {
    const listRoute = routeSource(
      "router.get('/marketplace/products',",
      "router.get('/marketplace/creators/:creatorId/products'",
    );

    expect(listRoute).toContain('is_published: true');
    expect(listRoute).toContain("listing_status: 'APPROVED'");
    expect(listRoute).toContain("creator: { marketplace_seller_status: 'ACTIVE' }");
  });
});

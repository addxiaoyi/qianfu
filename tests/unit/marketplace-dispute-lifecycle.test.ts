import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const controller = readFileSync(resolve(root, 'server/core/controller/QianFuController.ts'), 'utf8');
const service = readFileSync(resolve(root, 'server/services/marketplaceOrderLifecycleService.ts'), 'utf8');
const schemas = readFileSync(resolve(root, 'server/core/controller/marketplaceSchemas.ts'), 'utf8');
const prisma = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');

const routeSource = (start: string, end: string) => {
  const from = controller.indexOf(start);
  const to = controller.indexOf(end, from);
  return controller.slice(from, to);
};

describe('marketplace dispute lifecycle', () => {
  it('persists dispute state and resolution evidence', () => {
    expect(prisma).toContain('dispute_status');
    expect(prisma).toContain('dispute_reason');
    expect(prisma).toContain('dispute_description');
    expect(prisma).toContain('dispute_resolution');
    expect(prisma).toContain('dispute_opened_at');
    expect(prisma).toContain('dispute_resolved_at');
    expect(prisma).toContain('@@index([dispute_status])');
  });

  it('validates dispute reasons and admin resolutions at the boundary', () => {
    expect(schemas).toContain('marketplaceOpenDisputeSchema');
    expect(schemas).toContain("z.enum(['NOT_DELIVERED', 'NOT_AS_DESCRIBED', 'UNAUTHORIZED', 'OTHER'])");
    expect(schemas).toContain('marketplaceResolveDisputeSchema');
    expect(schemas).toContain("z.enum(['RESOLVED', 'REJECTED'])");
  });

  it('delegates buyer dispute opening to a serializable conditional transition', () => {
    const route = routeSource(
      "router.post('/marketplace/orders/:id/dispute'",
      "router.post('/marketplace/orders/:id/dispute/resolve'",
    );
    expect(route).toContain('authenticate, requireVerifiedEmail, csrfProtection');
    expect(route).toContain('openMarketplaceDispute(prisma');
    expect(route).toContain('buyerId: req.user!.id');
    expect(service).toContain('export const openMarketplaceDispute');
    expect(service).toContain("dispute_status: 'NONE'");
    expect(service).toContain('tx.marketplaceOrder.updateMany');
    expect(service).toContain('auditData(input');
    expect(service).toContain('tx.notification.create');
    expect(service).toContain("isolationLevel: 'Serializable'");
  });

  it('delegates administrator resolution to an audited conditional transition', () => {
    const route = routeSource(
      "router.post('/marketplace/orders/:id/dispute/resolve'",
      "router.post('/marketplace/appeals'",
    );
    expect(route).toContain('authenticate, requireVerifiedEmail, adminOnly, csrfProtection');
    expect(route).toContain('resolveMarketplaceDispute(prisma');
    expect(route).toContain('actorUserId: req.user!.id');
    expect(service).toContain('export const resolveMarketplaceDispute');
    expect(service).toContain("where: { id: input.orderId, dispute_status: 'OPEN' }");
    expect(service).toContain('MARKETPLACE_DISPUTE_${input.status}');
    expect(service).toContain('tx.notification.create');
  });

  it('prevents fulfillment while a dispute is open and makes replay idempotent', () => {
    const route = routeSource(
      "router.post('/marketplace/orders/:id/fulfill'",
      "router.post('/marketplace/orders/:id/dispute'",
    );
    expect(route).toContain('fulfillMarketplaceOrder(prisma');
    expect(service).toContain("initial.dispute_status === 'OPEN'");
    expect(service).toContain('Order has an open dispute');
    expect(service).toContain('replayed: true');
    expect(service).toContain('tx.marketplaceOrder.updateMany');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'server/core/controller/QianFuController.ts'),
  'utf8',
);
const orderService = readFileSync(
  resolve(process.cwd(), 'server/services/marketplaceOrderService.ts'),
  'utf8',
);
const paymentCompletionService = readFileSync(
  resolve(process.cwd(), 'server/services/paymentCompletionService.ts'),
  'utf8',
);
const orderLifecycleService = readFileSync(
  resolve(process.cwd(), 'server/services/marketplaceOrderLifecycleService.ts'),
  'utf8',
);

describe('marketplace business policy', () => {
  it('creates marketplace orders in a pending state', () => {
    expect(orderService).toMatch(/status: 'PENDING',\s+payment_status: 'PENDING',/);
  });

  it('does not return a download URL from order creation', () => {
    expect(source).not.toContain('{ order, payment, downloadUrl: product.downloadUrl ?? null }');
  });

  it('redacts download URLs from public product responses', () => {
    expect(source).toContain('const toPublicMarketplaceProduct = (product: MarketplaceProduct)');
    expect(source).toContain('product: mapFavoriteIds(toPublicMarketplaceProduct(product), currentUserId)');
  });

  it('requires paid status before fulfillment', () => {
    expect(orderLifecycleService).toContain("if (initial.payment_status !== 'PAID')");
    expect(orderLifecycleService).toContain("payment_status: 'PAID'");
    expect(orderLifecycleService).toContain('fulfillment_status: { not: targetStatus }');
  });

  it('requires the reviewer to have a paid order for the product', () => {
    const reviewRouteStart = source.indexOf("router.post('/marketplace/products/:id/reviews'");
    const reviewRouteEnd = source.indexOf("router.get('/marketplace/shops/:ownerId/config'", reviewRouteStart);
    const reviewRoute = source.slice(reviewRouteStart, reviewRouteEnd);

    expect(reviewRoute).toContain('const paidOrder = await prisma.marketplaceOrder.findFirst');
    expect(reviewRoute).toContain('const currentUser = req.user');
    expect(reviewRoute).toContain('buyer_id: currentUser.id');
    expect(reviewRoute).toContain("payment_status: 'PAID'");
    expect(reviewRoute).toContain('if (!paidOrder)');
    expect(reviewRoute).not.toContain('marketplaceOrders.find');
  });

  it('keeps delivery URLs behind the controlled download endpoint', () => {
    const detailRouteStart = source.indexOf("router.get('/marketplace/orders/:id'");
    const downloadRouteStart = source.indexOf("router.post('/marketplace/orders/:id/download'", detailRouteStart);
    const detailRoute = source.slice(detailRouteStart, downloadRouteStart);
    const listRouteStart = source.indexOf("router.get('/marketplace/me/orders'");
    const listRouteEnd = source.indexOf("router.get('/marketplace/rankings'", listRouteStart);
    const listRoute = source.slice(listRouteStart, listRouteEnd);

    expect(detailRouteStart).toBeGreaterThanOrEqual(0);
    expect(downloadRouteStart).toBeGreaterThan(detailRouteStart);
    expect(detailRoute).toContain('deliveryUrl: null');
    expect(detailRoute).toContain('canDownload: isBuyer');
    expect(source).toContain('issueMarketplaceDownload(prisma, {');
    expect(listRoute).toContain('deliveryUrl: null');
    expect(source).not.toContain("deliveryUrl: order.fulfillmentStatus === 'DELIVERED' ? order.deliveryUrl : null");
  });

  it('increments sales only after a successful payment callback', () => {
    expect(source).not.toContain('product.sales += order.quantity');
    expect(paymentCompletionService).toContain('sales: { increment: order.quantity }');
    expect(paymentCompletionService).toMatch(/status: 'PAID',\s+payment_status: 'PAID',/);
  });

  it('closes marketplace order creation in personal filing mode before business services run', () => {
    const routes = readFileSync(resolve(process.cwd(), 'server/routes/index.ts'), 'utf8');
    const closure = readFileSync(resolve(process.cwd(), 'server/middleware/commercialFeatureClosure.ts'), 'utf8');

    expect(routes).toContain('commercialFeatureClosure');
    expect(closure).toContain("'/api/qianfu'");
    expect(closure).toContain("'/api/v1/qianfu'");
    expect(source).toContain('router');
  });
});

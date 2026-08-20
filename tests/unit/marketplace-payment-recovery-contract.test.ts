import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const paymentController = readFileSync(resolve(root, 'server/controllers/paymentController.ts'), 'utf8');
const marketplaceController = readFileSync(resolve(root, 'server/core/controller/QianFuController.ts'), 'utf8');
const orderDetail = readFileSync(resolve(root, 'qianfu-liandeng/src/pages/MarketplaceOrderDetail.tsx'), 'utf8');
const successPage = readFileSync(resolve(root, 'qianfu-liandeng/src/pages/PaymentSuccess.tsx'), 'utf8');
const productDetail = readFileSync(resolve(root, 'qianfu-liandeng/src/pages/MarketplaceDetail.tsx'), 'utf8');

describe('marketplace payment recovery contract', () => {
  it('returns the marketplace order associated with an authenticated payment status request', () => {
    expect(paymentController).toContain("payment.plan_id === 'marketplace'");
    expect(paymentController).toContain('marketplaceOrderId: marketplaceOrder?.id ?? null');
    expect(paymentController).toContain('where: { payment_id: payment.id, buyer_id: userId }');
  });

  it('grants pay permission only for the buyer and an unpaid pending order', () => {
    expect(marketplaceController).toContain('canPay: isBuyer');
    expect(marketplaceController).toContain("order.status === 'PENDING'");
    expect(marketplaceController).toContain("order.paymentStatus === 'FAILED'");
  });

  it('lets a buyer resume payment without creating another marketplace order', () => {
    expect(orderDetail).toContain("planId: 'marketplace'");
    expect(orderDetail).toContain('marketplaceOrderId: id');
    expect(orderDetail).toContain("'/payment/create'");
    expect(orderDetail).not.toContain("'/qianfu/marketplace/orders',");
  });

  it('keeps the retired payment success page closed', () => {
    expect(successPage).toContain("from './CommercialFeatureDisabled'");
    expect(successPage).toContain('<CommercialFeatureDisabled />');
    expect(successPage).not.toContain('/payment/status/');
  });

  it('shares the same trusted redirect policy between product purchase and payment recovery', () => {
    expect(productDetail).toContain("from '@/utils/paymentRedirect'");
    expect(orderDetail).toContain("from '@/utils/paymentRedirect'");
  });
});

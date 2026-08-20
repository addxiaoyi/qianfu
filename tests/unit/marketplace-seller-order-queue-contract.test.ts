import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const controller = readFileSync(resolve(root, 'server/core/controller/QianFuController.ts'), 'utf8');
const manage = readFileSync(resolve(root, 'qianfu-liandeng/src/pages/MarketplaceManage.tsx'), 'utf8');
const detail = readFileSync(resolve(root, 'qianfu-liandeng/src/pages/MarketplaceOrderDetail.tsx'), 'utf8');

describe('marketplace seller order queue contract', () => {
  it('returns server-authoritative buyer and seller roles with fulfillment permission', () => {
    expect(controller).toContain('roles: { isBuyer, isSeller }');
    expect(controller).toContain('canFulfill: isSeller');
    expect(controller).toContain("order.paymentStatus === 'PAID'");
    expect(controller).toContain("order.disputeStatus !== 'OPEN'");
  });

  it('loads seller orders and exposes operational status filters', () => {
    expect(manage).toContain("'/qianfu/marketplace/me/orders'");
    expect(manage).toContain("'PENDING_PAYMENT'");
    expect(manage).toContain("'NEEDS_FULFILLMENT'");
    expect(manage).toContain("'DELIVERED'");
    expect(manage).toContain("'DISPUTE'");
  });

  it('fulfills an eligible order from both seller surfaces and refreshes authoritative state', () => {
    expect(manage).toContain('/qianfu/marketplace/orders/${orderId}/fulfill');
    expect(detail).toContain('/qianfu/marketplace/orders/${id}/fulfill');
    expect(manage).toContain('await load();');
    expect(detail).toContain('await loadOrder();');
    expect(detail).toContain('permissions.canFulfill');
  });

  it('keeps all marketplace money display in integer-fen conversion helpers', () => {
    expect(manage).toContain('formatCnyFromFen(order.totalPrice)');
    expect(detail).toContain('formatCnyFromFen(order.totalPrice)');
  });
});

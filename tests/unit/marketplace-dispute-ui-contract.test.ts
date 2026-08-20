import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'qianfu-liandeng/src/pages/MarketplaceOrderDetail.tsx'), 'utf8');
const controller = readFileSync(resolve(root, 'server/core/controller/QianFuController.ts'), 'utf8');

describe('marketplace dispute UI contract', () => {
  it('returns server-authoritative dispute permissions', () => {
    expect(controller).toContain('canFulfill:');
    expect(controller).toContain('canOpenDispute:');
    expect(controller).toContain('canResolveDispute:');
    expect(controller).toContain("order.disputeStatus === 'NONE'");
    expect(controller).toContain("order.disputeStatus === 'OPEN'");
  });

  it('lets an eligible buyer open a dispute from the order page', () => {
    expect(page).toContain('permissions?: { canPay: boolean; canFulfill: boolean; canDownload: boolean; canOpenDispute: boolean; canResolveDispute: boolean }');
    expect(page).toContain('/qianfu/marketplace/orders/${id}/dispute');
    expect(page).toContain('NOT_DELIVERED');
    expect(page).toContain('发起争议');
  });

  it('keeps dispute resolution and payment recovery behind independent server permissions', () => {
    expect(page).toContain('/qianfu/marketplace/orders/${id}/dispute/resolve');
    expect(page).toContain('permissions.canResolveDispute');
    expect(page).toContain('permissions.canPay');
    expect(page).toContain("'/payment/create'");
    expect(page).not.toContain("'/qianfu/marketplace/orders',");
    expect(page).toContain('处理争议');
  });
});

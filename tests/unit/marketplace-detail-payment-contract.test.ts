import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/MarketplaceDetail.tsx'),
  'utf8',
);
const orderPageSource = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/MarketplaceOrderDetail.tsx'),
  'utf8',
);
const redirectSource = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/utils/paymentRedirect.ts'),
  'utf8',
);

describe('marketplace detail payment contract', () => {
  it('creates an idempotent order before initiating marketplace payment', () => {
    expect(pageSource).toContain("api.post<MarketplaceOrderResponse>('/qianfu/marketplace/orders'");
    expect(pageSource).toContain("headers: { 'Idempotency-Key': orderKey }");
    expect(pageSource).toContain('policyAcceptance: { accepted: true }');
    expect(pageSource).toContain('checked={policyAccepted}');
    expect(pageSource).toContain('disabled={purchaseBusy || !policyAccepted}');
    expect(pageSource).toContain("api.post<MarketplacePaymentResponse>('/payment/create'");
    expect(pageSource).toContain("planId: 'marketplace'");
    expect(pageSource).toContain('marketplaceOrderId: order.id');
    expect(pageSource).toContain("headers: { 'Idempotency-Key': paymentKey }");
    expect(pageSource).toContain('createPaymentIdempotencyKey');
  });

  it('downloads only through the audited order download endpoint', () => {
    expect(orderPageSource).toContain('permissions.canDownload');
    expect(orderPageSource).toContain("api.post<MarketplaceDownloadResponse>(`/qianfu/marketplace/orders/${id}/download`, {})");
    expect(orderPageSource).toContain('window.location.assign(safeUrl);');
    expect(orderPageSource).not.toContain('const safeDeliveryUrl = order.deliveryUrl');
    expect(orderPageSource).not.toContain('href={safeDeliveryUrl}');
  });

  it('does not declare success until the payment is complete or redirects through the shared trust policy', () => {
    expect(pageSource).toContain("from '@/utils/paymentRedirect'");
    expect(pageSource).toContain("if (payment.status === 'COMPLETED')");
    expect(pageSource).toContain('isTrustedPaymentUrl(payment.paymentUrl)');
    expect(pageSource).toContain('window.location.assign(payment.paymentUrl);');
    expect(pageSource).not.toContain("setMessage(result.downloadUrl ? `购买成功");
    expect(pageSource).not.toContain('buyerName: buyerName');
    expect(pageSource).not.toContain('直接下载');

    expect(redirectSource).toContain('VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS');
    expect(redirectSource).toContain("if (parsed.protocol !== 'https:') return false;");
    expect(redirectSource).toContain('if (parsed.origin === window.location.origin) return true;');
    expect(redirectSource).toContain('allowedPaymentHosts.includes(host)');
    expect(redirectSource).toContain('allowedPaymentHosts.includes(hostname)');
  });
});

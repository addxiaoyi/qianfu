import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = readFileSync(resolve(root, 'scripts/smoke-marketplace-closure.ts'), 'utf8');
const packageJson = readFileSync(resolve(root, 'package.json'), 'utf8');

describe('marketplace closure smoke script contract', () => {
  it('defaults to loopback and requires explicit mutation authorization', () => {
    expect(source).toContain('dotenv.config()');
    expect(source).toContain("'http://127.0.0.1:3000'");
    expect(source).toContain("SMOKE_MARKETPLACE_ALLOW_MUTATION === '1'");
    expect(source).toContain('SMOKE_ADMIN_PASSWORD is required unless SMOKE_MARKETPLACE_CREATE_ADMIN=1');
    expect(source).toContain('DATABASE_URL is required');
  });

  it('allows disposable administrators only on explicitly authorized loopback smoke runs', () => {
    expect(source).toContain("SMOKE_MARKETPLACE_CREATE_ADMIN === '1'");
    expect(source).toContain("SMOKE_MARKETPLACE_CREATE_USERS_DIRECT === '1'");
    expect(source).toContain('const CREATE_DISPOSABLE_USERS =');
    expect(source).toContain('if (CREATE_DISPOSABLE_USERS)');
    expect(source).toContain('Disposable smoke administrators are allowed only for loopback targets');
    expect(source).toContain('await bcrypt.hash(password, 12)');
    expect(source).toContain('created.userIds.push(disposableAdmin.id)');
    expect(source).toContain('if (CREATE_DISPOSABLE_ADMIN)');
    expect(source).toContain("role: 'NORMAL'");
    expect(source).toContain('email_verified: true');
    expect(source).toContain("createVerifiedUser(prisma, adminSession, adminAuth, 'seller')");
  });

  it('blocks production and arbitrary remote hosts unless separately authorized', () => {
    expect(source).toContain("hostname === 'mc-u.top'");
    expect(source).toContain("SMOKE_MARKETPLACE_ALLOW_PRODUCTION === '1'");
    expect(source).toContain("SMOKE_MARKETPLACE_ALLOW_REMOTE === '1'");
  });

  it('covers the seller, buyer, payment, review and dispute path', () => {
    expect(source).toContain("/api/v1/qianfu/marketplace/products'");
    expect(source).toContain("/api/v1/qianfu/marketplace/orders'");
    expect(source).toContain('/api/v1/payment/admin/complete-order');
    expect(source).toContain('/api/v1/payment/status/${created.paymentId}');
    expect(source).toContain("'buyer-can-pay-pending-order'");
    expect(source).toContain("'pending-payment-links-marketplace-order'");
    expect(source).toContain("'completed-payment-links-marketplace-order'");
    expect(source).toContain("paidOrderResponse?.permissions?.canPay === false");
    expect(source).toContain('/fulfill');
    expect(source).toContain('/reviews');
    expect(source).toContain('/dispute/resolve');
    expect(source).toContain("'Idempotency-Key'");
    expect(source).toContain('taxIncluded: true');
    expect(source).toContain('additionalFees: 0');
    expect(source).toContain("productVersion: '1.0.0'");
    expect(source).toContain("assetMime: 'application/zip'");
    expect(source).toContain('policyAcceptance: { accepted: true }');
  });

  it('always attempts foreign-key ordered cleanup and fails when cleanup fails', () => {
    expect(source).toContain('finally {');
    expect(source).toContain('marketplaceFulfillmentLog.deleteMany');
    expect(source).toContain('marketplaceOrder.deleteMany');
    expect(source).toContain('payment.deleteMany');
    expect(source).toContain('marketplaceProduct.deleteMany');
    expect(source).toContain('getMarketplaceTableAvailability');
    expect(source).toContain('delegateTableAvailable');
    expect(source).toContain('marketplaceProductVersion.deleteMany');
    expect(source).toContain('marketplaceOrderEvidence.deleteMany');
    expect(source).toContain('marketplaceDeliveryEvidence.deleteMany');
    expect(source).toContain('user.deleteMany');
    expect(source).toContain('readCleanupResidualCounts');
    expect(source).toContain('Cleanup left residual records');
    expect(source).toContain('notification.count');
    expect(source).toContain('auditLog.count');
    expect(source).toContain("add(checks, 'cleanup', false");
  });

  it('is exposed through an explicit local smoke command', () => {
    expect(packageJson).toContain('"smoke:marketplace:local": "tsx scripts/smoke-marketplace-closure.ts"');
  });
});

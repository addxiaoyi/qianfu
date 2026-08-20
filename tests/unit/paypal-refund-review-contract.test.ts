import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PayPal refund review contract', () => {
  it('persists PayPal payments and webhook events in every deployment schema', () => {
    for (const schema of [
      'prisma/schema.prisma',
      'prisma/schema.postgresql.prisma',
      'prisma/schema.mysql.prisma',
    ]) {
      const source = read(schema);
      expect(source).toContain('model PaypalPaymentRecord');
      expect(source).toContain('model PaypalWebhookEvent');
      expect(source).toContain('upstream_order_id');
      expect(source).toContain('capture_id');
    }
  });

  it('routes denied and refunded webhooks into an auditable review flow', () => {
    const controller = read('server/controllers/paymentController.ts');

    expect(controller).toContain("'PAYMENT.CAPTURE.DENIED'");
    expect(controller).toContain("'PAYMENT.CAPTURE.REFUNDED'");
    expect(controller).toContain('paypalWebhookEvent');
    expect(controller).toContain('REFUND_REVIEW_REQUIRED');
    expect(controller).toContain('reviewPaypalRefund');
    expect(controller).toContain('generateTransactionSignature');
    expect(controller).not.toContain('paypalWebhook acknowledged non-completion event');
  });
});

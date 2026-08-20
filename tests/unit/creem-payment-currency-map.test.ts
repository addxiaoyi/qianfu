import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  processCreemWebhook,
  resolveCreemCheckoutTerms,
  resolveCreemWalletReversal,
} from '../../server/services/creemPaymentService';
import prisma from '../../server/db';
import { redisService } from '../../server/services/redisService';

describe('Creem cross-currency recharge mapping', () => {
  it('maps a CNY wallet recharge to its fixed USD Creem product', () => {
    const terms = resolveCreemCheckoutTerms(
      {
        projectKey: 'qianfu',
        apiKey: 'test-key',
        webhookSecret: 'test-secret',
        mode: 'test',
        returnUrl: 'https://mc-u.top/api/v1/payment/creem/return',
        productMap: {
          'custom:1000:CNY': {
            productId: 'prod_usd_2',
            checkoutAmount: 200,
            checkoutCurrency: 'USD',
            walletCreditAmount: 1000,
            walletCreditCurrency: 'CNY',
          },
        },
      },
      { plan_id: 'custom', amount: 1000, currency: 'CNY' },
    );

    expect(terms).toEqual({
      productId: 'prod_usd_2',
      checkoutAmount: 200,
      checkoutCurrency: 'USD',
      walletCreditAmount: 1000,
      walletCreditCurrency: 'CNY',
    });
  });

  it('keeps legacy single-product configuration on the payment currency', () => {
    const terms = resolveCreemCheckoutTerms(
      {
        projectKey: 'qianfu',
        apiKey: 'test-key',
        webhookSecret: 'test-secret',
        mode: 'test',
        returnUrl: 'https://mc-u.top/api/v1/payment/creem/return',
        productId: 'prod_legacy',
      },
      { plan_id: 'custom', amount: 1000, currency: 'CNY' },
    );

    expect(terms).toEqual({
      productId: 'prod_legacy',
      checkoutAmount: 1000,
      checkoutCurrency: 'CNY',
      walletCreditAmount: 1000,
      walletCreditCurrency: 'CNY',
    });
  });

  it('converts a partial USD refund into the proportional CNY wallet reversal', () => {
    expect(resolveCreemWalletReversal({
      refundAmount: 100,
      expectedCheckoutAmount: 200,
      walletCreditAmount: 1400,
      reversedCheckoutAmount: 0,
      reversedWalletCreditAmount: 0,
    })).toEqual({
      checkoutAmount: 100,
      walletCreditAmount: 700,
    });
  });

  it('completes the internal CNY payment when Creem reports a USD checkout', async () => {
    const rawBody = Buffer.from(JSON.stringify({
      id: 'evt_checkout_1',
      eventType: 'checkout.completed',
      object: {
        id: 'checkout_1',
        request_id: 'pay_1',
        mode: 'test',
        status: 'paid',
        metadata: { projectKey: 'qianfu', userId: '42' },
        product: { id: 'prod_usd_2', price: 200, currency: 'USD' },
        order: { amount_paid: 200, currency: 'USD', status: 'paid' },
      },
    }));
    const record = {
      payment_id: 'pay_1',
      user_id: 42,
      project_key: 'qianfu',
      mode: 'test',
      product_id: 'prod_usd_2',
      product_kind: 'one_time',
      expected_amount: 200,
      expected_currency: 'USD',
      checkout_id: 'checkout_1',
      order_id: null,
      transaction_id: null,
      customer_id: null,
      customer_email: 'user@example.com',
      subscription_id: null,
      status: 'PENDING',
      access_status: 'PENDING',
      metadata: JSON.stringify({
        walletCreditAmount: '1000',
        walletCreditCurrency: 'CNY',
      }),
    };
    const completePayment = vi.fn(async (
      _paymentId: string,
      expectedAmountFen: number,
    ) => {
      expect(expectedAmountFen).toBe(1000);
      return { status: 'COMPLETED' };
    });

    const findRecord = vi.spyOn(prisma.creemPaymentRecord, 'findUnique').mockResolvedValue(record as never);
    const findEvent = vi.spyOn(prisma.creemWebhookEvent, 'findUnique').mockResolvedValue(null);
    const upsertEvent = vi.spyOn(prisma.creemWebhookEvent, 'upsert').mockResolvedValue({} as never);
    const updateEvent = vi.spyOn(prisma.creemWebhookEvent, 'update').mockResolvedValue({} as never);
    const findPayment = vi.spyOn(prisma.payment, 'findUnique').mockResolvedValue({
      id: 'pay_1',
      user_id: 42,
      amount: 1000,
      plan_id: 'custom',
      currency: 'CNY',
      payment_method: 'creem',
      status: 'PENDING',
    } as never);
    const updateRecord = vi.spyOn(prisma.creemPaymentRecord, 'update').mockResolvedValue(record as never);
    const withLock = vi.spyOn(redisService, 'withLock').mockImplementation(async (_key, callback) => callback());

    try {
      await expect(processCreemWebhook({
        rawBody,
        signature: createHmac('sha256', 'test-secret').update(rawBody).digest('hex'),
        resolveConfig: async () => ({
          projectKey: 'qianfu',
          apiKey: 'test-key',
          webhookSecret: 'test-secret',
          mode: 'test',
          returnUrl: 'https://mc-u.top/api/v1/payment/creem/return',
        }),
        completePayment,
      })).resolves.toMatchObject({ status: 'PROCESSED' });
    } finally {
      findRecord.mockRestore();
      findEvent.mockRestore();
      upsertEvent.mockRestore();
      updateEvent.mockRestore();
      findPayment.mockRestore();
      updateRecord.mockRestore();
      withLock.mockRestore();
    }
  });
});

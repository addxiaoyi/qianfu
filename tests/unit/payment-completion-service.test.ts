import { describe, expect, it, vi } from 'vitest';

import {
  completePaymentWithSideEffects,
  completePaymentWithSideEffectsInTransaction,
} from '../../server/services/paymentCompletionService';

describe('payment completion side effects', () => {
  it('settles a completed custom recharge even when its wallet was missing', async () => {
    const payment = { id: 'pay_recharge_1', user_id: 9, amount: 1_000, plan_id: 'custom', status: 'PENDING' };
    const wallet = { id: 7, user_id: 9, balance: 0, currency: 'CNY' };
    const transaction = {
      id: 11,
      wallet_id: 7,
      amount: 1_000,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      created_at: new Date('2026-08-06T00:00:00.000Z'),
    };
    const tx = {
      payment: {
        findUnique: vi.fn(async () => payment),
        update: vi.fn(async ({ data }: any) => Object.assign(payment, data)),
      },
      wallet: {
        upsert: vi.fn(async () => wallet),
        findUnique: vi.fn(async () => wallet),
        update: vi.fn(async ({ data }: any) => {
          wallet.balance += data.balance.increment;
          return wallet;
        }),
      },
      transaction: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => transaction),
        update: vi.fn(async () => transaction),
      },
      marketplaceOrder: { findMany: vi.fn(async () => []) },
    };

    await expect(completePaymentWithSideEffectsInTransaction(tx as any, {
      paymentId: payment.id,
      expectedAmountFen: payment.amount,
    })).resolves.toMatchObject({ status: 'COMPLETED' });

    expect(tx.wallet.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: payment.user_id },
    }));
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: payment.user_id },
      data: { balance: { increment: payment.amount } },
    }));
  });

  it('synchronizes a marketplace order exactly once on replay', async () => {
    const payment = { id: 'pay_1', user_id: 9, amount: 1_500, plan_id: 'marketplace', status: 'PENDING' };
    const order = {
      id: 'ord_1', payment_id: 'pay_1', product_id: 'prod_1', quantity: 2,
      status: 'PENDING', payment_status: 'PENDING', fulfillment_status: 'PENDING',
      delivery_url: null,
    };
    const product = { id: 'prod_1', download_url: 'https://cdn.example.test/file.zip', sales: 0 };
    const logs: unknown[] = [];
    const tx = {
      payment: {
        findUnique: vi.fn(async () => payment),
        update: vi.fn(async ({ data }: any) => Object.assign(payment, data)),
      },
      marketplaceOrder: {
        findMany: vi.fn(async () => [order]),
        update: vi.fn(async ({ data }: any) => Object.assign(order, data)),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => product),
        update: vi.fn(async ({ data }: any) => {
          product.sales += data.sales.increment;
          return product;
        }),
      },
      marketplaceFulfillmentLog: {
        create: vi.fn(async ({ data }: any) => { logs.push(data); return data; }),
      },
    };
    const db = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as any;

    await expect(completePaymentWithSideEffects(db, {
      paymentId: 'pay_1',
      expectedAmountFen: 1_500,
    })).resolves.toMatchObject({ status: 'COMPLETED' });
    await expect(completePaymentWithSideEffects(db, {
      paymentId: 'pay_1',
      expectedAmountFen: 1_500,
    })).resolves.toMatchObject({ status: 'ALREADY_COMPLETED' });

    expect(payment.status).toBe('COMPLETED');
    expect(order).toMatchObject({
      status: 'PAID',
      payment_status: 'PAID',
      fulfillment_status: 'DELIVERED',
      delivery_url: product.download_url,
    });
    expect(product.sales).toBe(2);
    expect(logs).toHaveLength(1);
  });

  it('rejects a wrong amount before changing payment state', async () => {
    const payment = { id: 'pay_2', user_id: 9, amount: 1_500, plan_id: 'marketplace', status: 'PENDING' };
    const db = {
      $transaction: vi.fn(async (callback: (client: any) => unknown) => callback({
        payment: { findUnique: vi.fn(async () => payment) },
      })),
    } as any;

    await expect(completePaymentWithSideEffects(db, {
      paymentId: 'pay_2',
      expectedAmountFen: 1_499,
    })).resolves.toMatchObject({ status: 'AMOUNT_MISMATCH' });
    expect(payment.status).toBe('PENDING');
  });

  it('synchronizes a marketplace order in the caller-owned transaction', async () => {
    const payment = { id: 'pay_3', user_id: 9, amount: 1_500, plan_id: 'marketplace', status: 'PENDING' };
    const order = {
      id: 'ord_3', payment_id: 'pay_3', product_id: 'prod_3', quantity: 1,
      status: 'PENDING', payment_status: 'PENDING', fulfillment_status: 'PENDING',
      delivery_url: null,
    };
    const product = { id: 'prod_3', download_url: null, sales: 0 };
    const tx = {
      payment: {
        findUnique: vi.fn(async () => payment),
        update: vi.fn(async ({ data }: any) => Object.assign(payment, data)),
      },
      marketplaceOrder: {
        findMany: vi.fn(async () => [order]),
        update: vi.fn(async ({ data }: any) => Object.assign(order, data)),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => product),
        update: vi.fn(async ({ data }: any) => {
          product.sales += data.sales.increment;
          return product;
        }),
      },
      marketplaceFulfillmentLog: {
        create: vi.fn(async ({ data }: any) => data),
      },
    };

    await expect(completePaymentWithSideEffectsInTransaction(tx as any, {
      paymentId: 'pay_3',
      expectedAmountFen: 1_500,
    })).resolves.toMatchObject({ status: 'COMPLETED' });

    expect(payment.status).toBe('COMPLETED');
    expect(order).toMatchObject({
      status: 'PAID',
      payment_status: 'PAID',
      fulfillment_status: 'READY',
    });
    expect(product.sales).toBe(1);
  });
});

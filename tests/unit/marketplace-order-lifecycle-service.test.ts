import { describe, expect, it, vi } from 'vitest';

import {
  fulfillMarketplaceOrder,
  openMarketplaceDispute,
  resolveMarketplaceDispute,
} from '../../server/services/marketplaceOrderLifecycleService';

const mutationContext = {
  actorUserId: 11,
  method: 'POST',
  endpoint: '/api/v1/qianfu/marketplace/test',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'prd_1',
  title: 'Starter map',
  creator_id: 11,
  download_url: 'https://cdn.example.com/map.zip',
  creator: { marketplace_seller_status: 'ACTIVE' },
  ...overrides,
});

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'ord_1',
  product_id: 'prd_1',
  buyer_id: 7,
  buyer_name: 'buyer',
  quantity: 1,
  total_price: 100,
  status: 'PAID',
  payment_status: 'PAID',
  fulfillment_status: 'PENDING',
  dispute_status: 'NONE',
  dispute_reason: null,
  dispute_description: null,
  dispute_resolution: null,
  dispute_opened_at: null,
  dispute_resolved_at: null,
  delivery_url: null,
  payment_id: 'pay_1',
  created_at: new Date('2026-07-24T00:00:00.000Z'),
  updated_at: new Date('2026-07-24T00:00:00.000Z'),
  product: makeProduct(),
  ...overrides,
});

const makeStatefulDb = (
  initialOrder: ReturnType<typeof makeOrder>,
  options: { forceUpdateCount?: number } = {},
) => {
  let order = initialOrder;
  const fulfillmentLogs: unknown[] = [];
  const audits: unknown[] = [];
  const notifications: unknown[] = [];

  const tx = {
    marketplaceOrder: {
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (options.forceUpdateCount === 0) return { count: 0 };
        order = { ...order, ...data };
        return { count: 1 };
      }),
      findUnique: vi.fn(async () => order),
    },
    marketplaceFulfillmentLog: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        fulfillmentLogs.push(data);
        return data;
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        audits.push(data);
        return data;
      }),
    },
    notification: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        notifications.push(data);
        return data;
      }),
    },
  };

  const db = {
    marketplaceOrder: {
      findUnique: vi.fn(async () => order),
    },
    $transaction: vi.fn(async (
      callback: (client: typeof tx) => unknown,
      _options?: { isolationLevel?: string },
    ) => callback(tx)),
  } as any;

  return {
    db,
    tx,
    getOrder: () => order,
    fulfillmentLogs,
    audits,
    notifications,
  };
};

describe('marketplace order lifecycle service', () => {
  it('fulfills a paid order once and treats a repeated request as idempotent', async () => {
    const state = makeStatefulDb(makeOrder());

    await expect(fulfillMarketplaceOrder(state.db, {
      ...mutationContext,
      orderId: 'ord_1',
      sellerId: 11,
    })).resolves.toMatchObject({
      replayed: false,
      deliveryUrl: 'https://cdn.example.com/map.zip',
    });

    await expect(fulfillMarketplaceOrder(state.db, {
      ...mutationContext,
      orderId: 'ord_1',
      sellerId: 11,
    })).resolves.toMatchObject({ replayed: true });

    expect(state.getOrder()).toMatchObject({
      status: 'PAID',
      fulfillment_status: 'DELIVERED',
      delivery_url: 'https://cdn.example.com/map.zip',
    });
    expect(state.tx.marketplaceOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(state.tx.marketplaceOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'ord_1',
        payment_status: 'PAID',
        dispute_status: { not: 'OPEN' },
        fulfillment_status: { not: 'DELIVERED' },
      }),
    }));
    expect(state.fulfillmentLogs).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('rejects fulfillment by another seller or a suspended seller', async () => {
    const wrongSellerState = makeStatefulDb(makeOrder());
    await expect(fulfillMarketplaceOrder(wrongSellerState.db, {
      ...mutationContext,
      orderId: 'ord_1',
      sellerId: 12,
    })).rejects.toThrow('Forbidden');
    expect(wrongSellerState.db.$transaction).not.toHaveBeenCalled();

    const suspendedState = makeStatefulDb(makeOrder({
      product: makeProduct({ creator: { marketplace_seller_status: 'SUSPENDED' } }),
    }));
    await expect(fulfillMarketplaceOrder(suspendedState.db, {
      ...mutationContext,
      orderId: 'ord_1',
      sellerId: 11,
    })).rejects.toThrow('Marketplace seller access is suspended');
    expect(suspendedState.db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects fulfillment until payment completes and while a dispute is open', async () => {
    const unpaidState = makeStatefulDb(makeOrder({ payment_status: 'PENDING' }));
    await expect(fulfillMarketplaceOrder(unpaidState.db, {
      ...mutationContext,
      orderId: 'ord_1',
      sellerId: 11,
    })).rejects.toThrow('Order payment is not complete');

    const disputedState = makeStatefulDb(makeOrder({ dispute_status: 'OPEN' }));
    await expect(fulfillMarketplaceOrder(disputedState.db, {
      ...mutationContext,
      orderId: 'ord_1',
      sellerId: 11,
    })).rejects.toThrow('Order has an open dispute');
  });

  it('opens one paid buyer dispute with log, audit, and seller notification', async () => {
    const state = makeStatefulDb(makeOrder());

    const result = await openMarketplaceDispute(state.db, {
      ...mutationContext,
      actorUserId: 7,
      orderId: 'ord_1',
      buyerId: 7,
      reason: 'NOT_DELIVERED',
      description: 'No file was delivered after payment.',
    });

    expect(result).toMatchObject({
      dispute_status: 'OPEN',
      dispute_reason: 'NOT_DELIVERED',
      dispute_description: 'No file was delivered after payment.',
    });
    expect(state.tx.marketplaceOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'ord_1',
        buyer_id: 7,
        payment_status: 'PAID',
        dispute_status: 'NONE',
      },
    }));
    expect(state.fulfillmentLogs).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.notifications).toEqual([
      expect.objectContaining({ user_id: 11, type: 'WARNING' }),
    ]);

    await expect(openMarketplaceDispute(state.db, {
      ...mutationContext,
      actorUserId: 7,
      orderId: 'ord_1',
      buyerId: 7,
      reason: 'NOT_DELIVERED',
      description: 'Duplicate request.',
    })).rejects.toThrow('Order already has a dispute record');
  });

  it('rejects dispute creation if the conditional transition loses a race', async () => {
    const state = makeStatefulDb(makeOrder(), { forceUpdateCount: 0 });

    await expect(openMarketplaceDispute(state.db, {
      ...mutationContext,
      actorUserId: 7,
      orderId: 'ord_1',
      buyerId: 7,
      reason: 'OTHER',
      description: 'A concurrent update changed this order.',
    })).rejects.toThrow('Order dispute state changed, refresh and try again');

    expect(state.fulfillmentLogs).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });

  it('resolves an open dispute once and notifies both buyer and seller atomically', async () => {
    const state = makeStatefulDb(makeOrder({ dispute_status: 'OPEN' }));

    const result = await resolveMarketplaceDispute(state.db, {
      ...mutationContext,
      actorUserId: 1,
      orderId: 'ord_1',
      status: 'RESOLVED',
      resolution: 'A replacement asset was delivered.',
    });

    expect(result).toMatchObject({
      dispute_status: 'RESOLVED',
      dispute_resolution: 'A replacement asset was delivered.',
    });
    expect(state.fulfillmentLogs).toHaveLength(1);
    expect(state.audits).toEqual([
      expect.objectContaining({
        user_id: 1,
        action: 'MARKETPLACE_DISPUTE_RESOLVED',
      }),
    ]);
    expect(state.notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: 7, type: 'SUCCESS' }),
      expect.objectContaining({ user_id: 11, type: 'SUCCESS' }),
    ]));
    expect(state.notifications).toHaveLength(2);

    await expect(resolveMarketplaceDispute(state.db, {
      ...mutationContext,
      actorUserId: 1,
      orderId: 'ord_1',
      status: 'RESOLVED',
      resolution: 'Duplicate decision.',
    })).rejects.toThrow('Order has no open dispute');
  });
});

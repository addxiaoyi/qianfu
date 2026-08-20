import { describe, expect, it, vi } from 'vitest';

import { createMarketplaceOrder } from '../../server/services/marketplaceOrderService';

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'ord_existing',
  product_id: 'prd_1',
  buyer_id: 7,
  buyer_name: 'buyer_7',
  quantity: 2,
  total_price: 2_500,
  status: 'PENDING',
  payment_status: 'PENDING',
  fulfillment_status: 'PENDING',
  payment_id: 'pay_existing',
  created_at: new Date('2026-07-15T00:00:00.000Z'),
  ...overrides,
});

const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay_existing',
  user_id: 7,
  amount: 2_500,
  plan_id: 'marketplace',
  payment_method: 'MARKETPLACE',
  currency: 'CNY',
  status: 'PENDING',
  ...overrides,
});

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'prd_1',
  title: 'Starter map',
  category: 'map',
  description: 'A starter map.',
  price: 1_250,
  currency: 'CNY',
  tax_included: true,
  additional_fees: 0,
  validity_text: '永久使用',
  delivery_method: '订单中心下载',
  delivery_eta: '即时交付',
  compatibility: 'Minecraft Java 1.20.x',
  is_platform_operated: false,
  seller_identity: 'Verified seller',
  author_name: 'Builder',
  after_sales_contact: 'Support ticket',
  refund_terms: 'Refund for non-delivery or material mismatch',
  ip_source: 'Original work',
  prohibited_use: 'No redistribution',
  risk_notice: 'Back up before installation',
  product_version: '1.0.0',
  file_sha256: 'a'.repeat(64),
  asset_size: 1024,
  asset_mime: 'application/zip',
  download_url: '/uploads/starter-map.zip',
  created_at: new Date('2026-07-15T00:00:00.000Z'),
  updated_at: new Date('2026-07-15T00:00:00.000Z'),
  creator_id: 11,
  is_published: true,
  listing_status: 'APPROVED',
  creator: { marketplace_seller_status: 'ACTIVE' },
  ...overrides,
});

const makeDb = (tx: Record<string, unknown>) => {
  const client = {
    marketplaceProductVersion: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'mpv_default' })),
    },
    marketplaceOrderEvidence: {
      create: vi.fn(async () => ({ id: 'mpe_default' })),
    },
    ...tx,
  };
  return {
    client,
    $transaction: vi.fn(async (callback: (transactionClient: typeof client) => unknown) => callback(client)),
  };
};

describe('marketplace order service', () => {
  it('creates the payment and order through one transaction', async () => {
    const payment = makePayment({ id: 'pay_new' });
    const order = makeOrder({ id: 'ord_new', payment_id: payment.id });
    const tx = {
      marketplaceOrder: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => order),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => makeProduct()),
      },
      payment: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => payment),
      },
      marketplaceProductVersion: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'mpv_1' })),
      },
      marketplaceOrderEvidence: {
        create: vi.fn(async () => ({ id: 'mpe_1' })),
      },
    };
    const db = makeDb(tx);

    const created = await createMarketplaceOrder(db as any, {
      buyerId: 7,
      buyerName: 'buyer_7',
      productId: 'prd_1',
      quantity: 2,
      policyAcceptance: { accepted: true },
      idempotencyKey: 'f94e1021-64f3-4d10-b1a8-505ea5fdde3d',
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 2_500, user_id: 7, plan_id: 'marketplace' }),
    }));
    expect(tx.marketplaceOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ product_id: 'prd_1', buyer_id: 7, total_price: 2_500 }),
    }));
    expect(tx.marketplaceProductVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        product_id: 'prd_1',
        version: '1.0.0',
        file_sha256: 'a'.repeat(64),
        asset_size: 1024,
        asset_mime: 'application/zip',
        download_url: '/uploads/starter-map.zip',
      }),
    }));
    expect(tx.marketplaceOrderEvidence.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        order_id: order.id,
        product_version_id: 'mpv_1',
        listing_snapshot: expect.any(String),
        policy_snapshot: expect.any(String),
        accepted_at: expect.any(Date),
      }),
    }));
    expect(created).toMatchObject({ order, payment, product: makeProduct(), replayed: false });
  });

  it('rejects self-purchase before creating a payment or order', async () => {
    const tx = {
      marketplaceOrder: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => makeProduct({ creator_id: 7 })),
      },
      payment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    const db = makeDb(tx);

    await expect(createMarketplaceOrder(db as any, {
      buyerId: 7,
      buyerName: 'buyer_7',
      productId: 'prd_1',
      quantity: 1,
      policyAcceptance: { accepted: true },
      idempotencyKey: 'a09e70d3-cd0e-45f6-86e4-16278c14e15b',
    })).rejects.toThrow('Cannot purchase your own product');

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.marketplaceOrder.create).not.toHaveBeenCalled();
  });

  it('rejects an unpublished product before creating a payment or order', async () => {
    const tx = {
      marketplaceOrder: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => makeProduct({ is_published: false })),
      },
      payment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    const db = makeDb(tx);

    await expect(createMarketplaceOrder(db as any, {
      buyerId: 7,
      buyerName: 'buyer_7',
      productId: 'prd_1',
      quantity: 1,
      policyAcceptance: { accepted: true },
      idempotencyKey: '8445f930-2d86-4b3c-9ea6-7eb3bf7305d8',
    })).rejects.toThrow('Product is unavailable');

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.marketplaceOrder.create).not.toHaveBeenCalled();
  });

  it('rejects a product that has not passed marketplace review', async () => {
    const tx = {
      marketplaceOrder: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => makeProduct({ listing_status: 'PENDING_REVIEW' })),
      },
      payment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    const db = makeDb(tx);

    await expect(createMarketplaceOrder(db as any, {
      buyerId: 7,
      buyerName: 'buyer_7',
      productId: 'prd_1',
      quantity: 1,
      policyAcceptance: { accepted: true },
      idempotencyKey: 'a728eba0-1d9a-4a07-ae31-82dc79d9c8d3',
    })).rejects.toThrow('Product is unavailable');

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.marketplaceOrder.create).not.toHaveBeenCalled();
  });

  it('rejects purchases from a suspended seller', async () => {
    const tx = {
      marketplaceOrder: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => makeProduct({
          creator: { marketplace_seller_status: 'SUSPENDED' },
        })),
      },
      payment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    const db = makeDb(tx);

    await expect(createMarketplaceOrder(db as any, {
      buyerId: 7,
      buyerName: 'buyer_7',
      productId: 'prd_1',
      quantity: 1,
      policyAcceptance: { accepted: true },
      idempotencyKey: '51509061-c069-4512-8b44-ebdbd0cd243d',
    })).rejects.toThrow('Seller is unavailable');

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.marketplaceOrder.create).not.toHaveBeenCalled();
  });

  it('returns the committed order after a concurrent idempotency collision', async () => {
    const existingOrder = makeOrder();
    const existingPayment = makePayment();
    const tx = {
      marketplaceOrder: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingOrder),
        create: vi.fn(),
      },
      marketplaceProduct: {
        findUnique: vi.fn(async () => makeProduct()),
      },
      payment: {
        findUnique: vi.fn(async () => existingPayment),
        create: vi.fn(async () => { throw { code: 'P2002' }; }),
      },
      marketplaceProductVersion: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'mpv_collision' })),
      },
    };
    const db = makeDb(tx);

    await expect(createMarketplaceOrder(db as any, {
      buyerId: 7,
      buyerName: 'buyer_7',
      productId: 'prd_1',
      quantity: 2,
      policyAcceptance: { accepted: true },
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    })).resolves.toMatchObject({ order: existingOrder, payment: existingPayment, replayed: true });

    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.marketplaceOrder.create).not.toHaveBeenCalled();
  });
});

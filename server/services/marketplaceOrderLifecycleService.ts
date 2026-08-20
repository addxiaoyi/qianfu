import crypto from 'crypto';
import type { Prisma, PrismaClient } from '../../prisma/generated/client/index.js';

import { AppError, ErrorCode } from '../utils/errors';

const MAX_TRANSACTION_ATTEMPTS = 3;

export interface MarketplaceMutationContext {
  actorUserId: number;
  method: string;
  endpoint: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface FulfillMarketplaceOrderInput extends MarketplaceMutationContext {
  orderId: string;
  sellerId: number;
}

export interface OpenMarketplaceDisputeInput extends MarketplaceMutationContext {
  orderId: string;
  buyerId: number;
  reason: string;
  description: string;
}

export interface ResolveMarketplaceDisputeInput extends MarketplaceMutationContext {
  orderId: string;
  status: 'RESOLVED' | 'REJECTED';
  resolution: string;
}

const makeLifecycleLogId = () => `flg_${crypto.randomUUID()}`;

const isRetryableTransactionError = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: unknown }).code === 'P2034'
);

const runSerializableTransaction = async <T>(
  db: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw lastError;
};

const auditData = (context: MarketplaceMutationContext, action: string, target: string, details: string | null) => ({
  user_id: context.actorUserId,
  action,
  target,
  details,
  method: context.method,
  endpoint: context.endpoint,
  ip_address: context.ipAddress ?? null,
  user_agent: context.userAgent ?? null,
});

export const fulfillMarketplaceOrder = async (
  db: PrismaClient,
  input: FulfillMarketplaceOrderInput,
) => {
  const initial = await db.marketplaceOrder.findUnique({
    where: { id: input.orderId },
    include: {
      product: {
        include: {
          creator: { select: { marketplace_seller_status: true } },
        },
      },
    },
  });
  if (!initial) {
    throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
  }
  if (initial.product.creator_id !== input.sellerId) {
    throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
  }
  if (initial.product.creator?.marketplace_seller_status !== 'ACTIVE') {
    throw new AppError('Marketplace seller access is suspended', 403, ErrorCode.FORBIDDEN);
  }
  if (initial.payment_status !== 'PAID') {
    throw new AppError('Order payment is not complete', 409, ErrorCode.CONFLICT);
  }
  if (initial.dispute_status === 'OPEN') {
    throw new AppError('Order has an open dispute', 409, ErrorCode.CONFLICT);
  }

  const deliveryUrl = initial.product.download_url ?? null;
  const targetStatus = deliveryUrl ? 'DELIVERED' : 'READY';
  if (initial.fulfillment_status === targetStatus) {
    return { order: initial, deliveryUrl, replayed: true };
  }

  return runSerializableTransaction(db, async (tx) => {
    const transition = await tx.marketplaceOrder.updateMany({
      where: {
        id: input.orderId,
        payment_status: 'PAID',
        dispute_status: { not: 'OPEN' },
        fulfillment_status: { not: targetStatus },
      },
      data: {
        status: 'PAID',
        fulfillment_status: targetStatus,
        delivery_url: deliveryUrl,
        updated_at: new Date(),
      },
    });

    if (transition.count === 0) {
      const existing = await tx.marketplaceOrder.findUnique({
        where: { id: input.orderId },
        include: { product: true },
      });
      if (!existing) {
        throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
      }
      if (existing.dispute_status === 'OPEN') {
        throw new AppError('Order has an open dispute', 409, ErrorCode.CONFLICT);
      }
      if (existing.payment_status !== 'PAID') {
        throw new AppError('Order payment is not complete', 409, ErrorCode.CONFLICT);
      }
      return { order: existing, deliveryUrl: existing.delivery_url, replayed: true };
    }

    const now = new Date();
    await tx.marketplaceFulfillmentLog.create({
      data: {
        id: makeLifecycleLogId(),
        order_id: input.orderId,
        status: targetStatus,
        note: deliveryUrl ? 'Auto delivered from the approved product asset' : 'Ready for manual delivery',
        userId: input.actorUserId,
        created_at: now,
      },
    });
    await tx.auditLog.create({
      data: auditData(input, 'MARKETPLACE_ORDER_FULFILLED', input.orderId, targetStatus),
    });

    const order = await tx.marketplaceOrder.findUnique({
      where: { id: input.orderId },
      include: { product: true },
    });
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }
    return { order, deliveryUrl, replayed: false };
  });
};

export const openMarketplaceDispute = async (
  db: PrismaClient,
  input: OpenMarketplaceDisputeInput,
) => {
  const initial = await db.marketplaceOrder.findUnique({
    where: { id: input.orderId },
    include: { product: true },
  });
  if (!initial) {
    throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
  }
  if (initial.buyer_id !== input.buyerId) {
    throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
  }
  if (initial.payment_status !== 'PAID') {
    throw new AppError('Only paid orders can be disputed', 409, ErrorCode.CONFLICT);
  }
  if (initial.dispute_status !== 'NONE') {
    throw new AppError('Order already has a dispute record', 409, ErrorCode.CONFLICT);
  }

  return runSerializableTransaction(db, async (tx) => {
    const openedAt = new Date();
    const transition = await tx.marketplaceOrder.updateMany({
      where: {
        id: input.orderId,
        buyer_id: input.buyerId,
        payment_status: 'PAID',
        dispute_status: 'NONE',
      },
      data: {
        dispute_status: 'OPEN',
        dispute_reason: input.reason,
        dispute_description: input.description,
        dispute_opened_at: openedAt,
        dispute_resolution: null,
        dispute_resolved_at: null,
        updated_at: openedAt,
      },
    });
    if (transition.count === 0) {
      throw new AppError('Order dispute state changed, refresh and try again', 409, ErrorCode.CONFLICT);
    }

    await tx.marketplaceFulfillmentLog.create({
      data: {
        id: makeLifecycleLogId(),
        order_id: input.orderId,
        status: 'DISPUTE_OPENED',
        note: input.reason,
        userId: input.actorUserId,
        created_at: openedAt,
      },
    });
    await tx.auditLog.create({
      data: auditData(input, 'MARKETPLACE_DISPUTE_OPENED', input.orderId, JSON.stringify({ reason: input.reason })),
    });
    if (initial.product.creator_id) {
      await tx.notification.create({
        data: {
          user_id: initial.product.creator_id,
          title: 'Marketplace dispute opened',
          content: `Order ${input.orderId} requires your attention.`,
          type: 'WARNING',
        },
      });
    }

    const order = await tx.marketplaceOrder.findUnique({
      where: { id: input.orderId },
      include: { product: true },
    });
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }
    return order;
  });
};

export const resolveMarketplaceDispute = async (
  db: PrismaClient,
  input: ResolveMarketplaceDisputeInput,
) => {
  const initial = await db.marketplaceOrder.findUnique({
    where: { id: input.orderId },
    include: { product: true },
  });
  if (!initial) {
    throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
  }
  if (initial.dispute_status !== 'OPEN') {
    throw new AppError('Order has no open dispute', 409, ErrorCode.CONFLICT);
  }

  return runSerializableTransaction(db, async (tx) => {
    const resolvedAt = new Date();
    const transition = await tx.marketplaceOrder.updateMany({
      where: { id: input.orderId, dispute_status: 'OPEN' },
      data: {
        dispute_status: input.status,
        dispute_resolution: input.resolution,
        dispute_resolved_at: resolvedAt,
        updated_at: resolvedAt,
      },
    });
    if (transition.count === 0) {
      throw new AppError('Order dispute was already handled', 409, ErrorCode.CONFLICT);
    }

    await tx.marketplaceFulfillmentLog.create({
      data: {
        id: makeLifecycleLogId(),
        order_id: input.orderId,
        status: `DISPUTE_${input.status}`,
        note: input.resolution,
        userId: input.actorUserId,
        created_at: resolvedAt,
      },
    });
    await tx.auditLog.create({
      data: auditData(input, `MARKETPLACE_DISPUTE_${input.status}`, input.orderId, input.resolution),
    });

    const recipientIds = new Set<number>();
    if (initial.buyer_id) recipientIds.add(initial.buyer_id);
    if (initial.product.creator_id) recipientIds.add(initial.product.creator_id);
    await Promise.all(Array.from(recipientIds).map((userId) => tx.notification.create({
      data: {
        user_id: userId,
        title: 'Marketplace dispute updated',
        content: `Dispute for order ${input.orderId} was ${input.status.toLowerCase()}.`,
        type: input.status === 'RESOLVED' ? 'SUCCESS' : 'WARNING',
      },
    })));

    const order = await tx.marketplaceOrder.findUnique({
      where: { id: input.orderId },
      include: { product: true },
    });
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }
    return order;
  });
};

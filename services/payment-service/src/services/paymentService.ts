/**
 * Payment Service
 * 支付业务逻辑层
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '@qianfu/shared';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// 数据库
// ============================================================================

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ============================================================================
// 类型定义
// ============================================================================

interface CreatePaymentInput {
  userId: string;
  amount: number; // 金额（分）
  currency: string;
  provider: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface ListPaymentsInput {
  userId?: string;
  status?: string;
  page: number;
  limit: number;
}

interface CreateRefundInput {
  amount?: number; // 不传则全额退款
  reason?: string;
}

// ============================================================================
// 支付服务
// ============================================================================

export class PaymentService {
  /**
   * 创建支付
   */
  static async createPayment(input: CreatePaymentInput) {
    const { userId, amount, currency, provider, description, metadata } = input;

    // 验证支付状态（只能创建待处理的支付）
    const payment = await prisma.payment.create({
      data: {
        id: uuidv4(),
        userId,
        amount,
        currency,
        provider,
        status: 'pending',
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        providerTransactionId: null, // 初始化时为空
      },
    });

    console.log(`[PaymentService] Payment created: ${payment.id}, amount: ${amount}`);

    // TODO: 调用支付提供商的 API 创建支付，获取 providerTransactionId
    // const providerResult = await this.callProviderAPI(provider, payment);

    return payment;
  }

  /**
   * 获取支付 by ID
   */
  static async getPaymentById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * 获取支付 by Provider Transaction ID
   */
  static async getPaymentByProviderTransactionId(providerTransactionId: string) {
    return prisma.payment.findUnique({
      where: { providerTransactionId },
      include: {
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * 列出支付
   */
  static async listPayments(input: ListPaymentsInput) {
    const { userId, status, page, limit } = input;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          refunds: {
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 取消支付
   */
  static async cancelPayment(id: string, reason?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return null;
    }

    // 检查支付是否可以取消
    if (['succeeded', 'failed', 'cancelled'].includes(payment.status)) {
      throw AppError.badRequest(
        `Cannot cancel payment with status: ${payment.status}`
      );
    }

    // 检查是否有已成功的退款
    const successfulRefunds = await prisma.refund.findMany({
      where: {
        paymentId: id,
        status: 'succeeded',
      },
    });

    if (successfulRefunds.length > 0) {
      throw AppError.badRequest('Cannot cancel payment with successful refunds');
    }

    // 取消所有待处理的退款
    await prisma.refund.updateMany({
      where: {
        paymentId: id,
        status: 'pending',
      },
      data: {
        status: 'failed',
        reason: reason || 'Payment cancelled',
      },
    });

    // 更新支付状态
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
    });

    console.log(`[PaymentService] Payment cancelled: ${id}`);

    // TODO: 调用支付提供商的 API 取消支付

    return updatedPayment;
  }

  /**
   * 创建退款
   */
  static async createRefund(paymentId: string, input: CreateRefundInput) {
    const { amount, reason } = input;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw AppError.notFound('Payment not found');
    }

    // 检查支付状态
    if (payment.status !== 'succeeded') {
      throw AppError.badRequest('Can only refund succeeded payments');
    }

    // 计算已退款金额
    const existingRefunds = await prisma.refund.aggregate({
      where: {
        paymentId,
        status: { in: ['succeeded', 'processing'] },
      },
      _sum: {
        amount: true,
      },
    });

    const refundedAmount = existingRefunds._sum.amount || 0;
    const refundAmount = amount || (payment.amount - refundedAmount);

    // 验证退款金额
    if (refundAmount <= 0) {
      throw AppError.badRequest('Refund amount must be positive');
    }

    if (refundAmount > payment.amount - refundedAmount) {
      throw AppError.badRequest('Refund amount exceeds available balance');
    }

    const refund = await prisma.refund.create({
      data: {
        id: uuidv4(),
        paymentId,
        amount: refundAmount,
        reason,
        status: 'pending',
      },
    });

    console.log(`[PaymentService] Refund created: ${refund.id}, amount: ${refundAmount}`);

    // TODO: 调用支付提供商的 API 创建退款

    return refund;
  }

  /**
   * 获取退款项列表
   */
  static async getRefundsByPaymentId(paymentId: string) {
    return prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 更新支付状态（通过 Provider Transaction ID）
   */
  static async updatePaymentByProviderTransactionId(
    providerTransactionId: string,
    status: string,
    _provider: string
  ) {
    const payment = await prisma.payment.findUnique({
      where: { providerTransactionId },
    });

    if (!payment) {
      console.warn(`[PaymentService] Payment not found by provider tx ID: ${providerTransactionId}`);
      return null;
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    console.log(`[PaymentService] Payment ${payment.id} status updated to: ${status}`);

    return updatedPayment;
  }

  /**
   * 处理待处理的退款（当支付成功时）
   */
  static async processPendingRefunds(providerTransactionId: string) {
    const payment = await prisma.payment.findUnique({
      where: { providerTransactionId },
    });

    if (!payment) {
      return;
    }

    const pendingRefunds = await prisma.refund.findMany({
      where: {
        paymentId: payment.id,
        status: 'pending',
      },
    });

    for (const refund of pendingRefunds) {
      // TODO: 调用支付提供商的 API 处理退款
      await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'processing',
        },
      });
    }
  }

  /**
   * 更新退款状态
   */
  static async updateRefundStatus(
    refundId: string,
    status: string,
    providerRefundId?: string
  ) {
    return prisma.refund.update({
      where: { id: refundId },
      data: {
        status,
        providerRefundId: providerRefundId || undefined,
      },
    });
  }
}

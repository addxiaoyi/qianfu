/**
 * Payment Routes
 * 处理支付相关的 HTTP 请求
 */

import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/paymentService.js';
import { AppError } from '@qianfu/shared';
import { z } from 'zod';

const router = Router();

// ============================================================================
// 验证 Schema
// ============================================================================

const createPaymentSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().positive().max(100000000), // 最大 100 万分 = 1 万元
  currency: z.string().length(3).default('CNY'),
  provider: z.enum(['alipay', 'wechat', 'stripe', 'xpay']),
  description: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const cancelPaymentSchema = z.object({
  reason: z.string().max(500).optional(),
});

const createRefundSchema = z.object({
  amount: z.number().int().positive().optional(), // 不传则全额退款
  reason: z.string().max(500).optional(),
});

// ============================================================================
// 辅助函数
// ============================================================================

function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

// ============================================================================
// 路由
// ============================================================================

/**
 * POST /api/payments - 创建支付
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = createPaymentSchema.parse(req.body);
    const payment = await PaymentService.createPayment({
      userId: body.userId,
      amount: body.amount,
      currency: body.currency,
      provider: body.provider,
      description: body.description,
      metadata: body.metadata,
    });

    res.status(201).json(successResponse(payment));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw AppError.badRequest('Invalid request body', 'VALIDATION_ERROR', error.errors);
    }
    throw error;
  }
});

/**
 * GET /api/payments/:id - 获取支付详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const payment = await PaymentService.getPaymentById(id);

  if (!payment) {
    throw AppError.notFound('Payment not found');
  }

  res.json(successResponse(payment));
});

/**
 * GET /api/payments - 列出用户的支付
 */
router.get('/', async (req: Request, res: Response) => {
  const { userId, status, page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const result = await PaymentService.listPayments({
    userId: userId as string | undefined,
    status: status as string | undefined,
    page: pageNum,
    limit: limitNum,
  });

  res.json(successResponse(result.payments, { pagination: result.pagination }));
});

/**
 * POST /api/payments/:id/cancel - 取消支付
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = cancelPaymentSchema.parse(req.body);

    const payment = await PaymentService.cancelPayment(id, body.reason);

    if (!payment) {
      throw AppError.notFound('Payment not found');
    }

    res.json(successResponse(payment));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw AppError.badRequest('Invalid request body', 'VALIDATION_ERROR', error.errors);
    }
    throw error;
  }
});

/**
 * POST /api/payments/:id/refund - 创建退款
 */
router.post('/:id/refund', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = createRefundSchema.parse(req.body);

    const payment = await PaymentService.getPaymentById(id);

    if (!payment) {
      throw AppError.notFound('Payment not found');
    }

    const refund = await PaymentService.createRefund(id, {
      amount: body.amount,
      reason: body.reason,
    });

    res.status(201).json(successResponse(refund));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw AppError.badRequest('Invalid request body', 'VALIDATION_ERROR', error.errors);
    }
    throw error;
  }
});

/**
 * GET /api/payments/:id/refunds - 获取退款项列表
 */
router.get('/:id/refunds', async (req: Request, res: Response) => {
  const { id } = req.params;

  const payment = await PaymentService.getPaymentById(id);

  if (!payment) {
    throw AppError.notFound('Payment not found');
  }

  const refunds = await PaymentService.getRefundsByPaymentId(id);

  res.json(successResponse(refunds));
});

export { router as paymentRoutes };

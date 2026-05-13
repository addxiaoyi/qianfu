/**
 * Webhook Routes
 * 处理支付提供商的回调通知
 */

import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/paymentService.js';
import { verifyWebhookSignature } from '../middleware/signature.js';
import { AppError } from '@qianfu/shared';
import { logger } from '@qianfu/shared';

const router = Router();

// ============================================================================
// 支持的提供商列表
// ============================================================================

const SUPPORTED_PROVIDERS = ['alipay', 'wechat', 'stripe', 'xpay'] as const;
type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

// ============================================================================
// 辅助函数
// ============================================================================

function successResponse(message: string) {
  return {
    success: true,
    message,
  };
}

// ============================================================================
// Webhook 处理工厂
// ============================================================================

interface WebhookPayload {
  provider: SupportedProvider;
  transactionId: string;
  status: string;
  amount?: number;
  timestamp?: string;
  rawData?: Record<string, unknown>;
}

async function handleWebhook(provider: SupportedProvider, payload: WebhookPayload): Promise<void> {
  const { transactionId, status } = payload;

  logger.info(`[Webhook] ${provider} callback: ${transactionId} -> ${status}`);

  // 根据提供商的状态映射到内部状态
  const statusMap: Record<string, string> = {
    // Alipay
    TRADE_SUCCESS: 'succeeded',
    TRADE_CLOSED: 'cancelled',
    // WeChat
    SUCCESS: 'succeeded',
    PAYERROR: 'failed',
    // Stripe
    'payment_intent.succeeded': 'succeeded',
    'payment_intent.payment_failed': 'failed',
    // XPay
    paid: 'succeeded',
    failed: 'failed',
    cancelled: 'cancelled',
  };

  const internalStatus = statusMap[status] || status;

  // 更新支付状态
  await PaymentService.updatePaymentByProviderTransactionId(
    transactionId,
    internalStatus,
    provider
  );

  // 如果是成功状态，更新退款处理中状态的退款
  if (internalStatus === 'succeeded') {
    await PaymentService.processPendingRefunds(transactionId);
  }
}

// ============================================================================
// 路由
// ============================================================================

/**
 * POST /api/webhooks/:provider - Webhook 回调入口
 */
router.post('/:provider',
  async (req: Request, res: Response) => {
    const { provider } = req.params;

    // 验证提供商是否支持
    if (!SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)) {
      throw AppError.badRequest(`Unsupported provider: ${provider}`);
    }

    // 验证签名
    const isValid = verifyWebhookSignature(
      provider as SupportedProvider,
      req.headers,
      req.body
    );

    if (!isValid) {
      logger.warn(`[Webhook] Invalid signature from ${provider}`);
      throw AppError.unauthorized('Invalid webhook signature');
    }

    // 解析 payload
    const payload = req.body as WebhookPayload;

    // 验证必需字段
    if (!payload.transactionId || !payload.status) {
      throw AppError.badRequest('Missing required fields: transactionId, status');
    }

    try {
      await handleWebhook(provider as SupportedProvider, {
        ...payload,
        provider: provider as SupportedProvider,
      });

      res.json(successResponse('Webhook processed successfully'));
    } catch (error) {
      logger.error(`[Webhook] Processing failed for ${provider}:`, error);
      // 即使处理失败也返回 200，避免提供商重复发送
      res.json(successResponse('Webhook received'));
    }
  }
);

export { router as webhookRoutes, SUPPORTED_PROVIDERS };

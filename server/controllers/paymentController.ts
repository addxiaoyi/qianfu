import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendListResponse } from '../utils/response';
import { AppError, ErrorCode, handleError } from '../utils/errors';
import prisma from '../db';
import crypto from 'crypto';
import { eventService, EVENTS } from '../services/eventService';
import { logDataChange } from '../services/auditService';
import {
  paymentCreateSchema,
  manualPaymentSchema,
  payProNotifySchema,
  xpayNotifySchema,
  paymentQuerySchema,
  paymentCancelParamSchema,
  paymentStatusParamSchema,
  paymentStatsQuerySchema
} from '../utils/validation';
import { generateTransactionSignature } from '../lib/wallet';
import { redisService } from '../services/redisService';
import { yuanToFen, fenToYuanNumber } from '../utils/currency';
import {
  buildDateRange,
  buildKeywordOrConditions,
  buildPagination,
  resolveSortField,
  resolveSortOrder,
} from '../utils/queryBuilder';
import { logger } from '../utils/logger';
import {
  EXTERNAL_PAYMENT_METHODS,
  evaluatePaymentGuardrails,
  isExternalPaymentMethod,
  type PaymentMethod,
} from '../services/paymentGuardrails';
import { resolvePaymentCancelAction } from '../services/paymentCancelPolicy';
import {
  buildPayProNotifyReplayKey,
  buildXpayNotifyReplayKey,
  extractRequestClientIp,
  isNotifyIpAllowed,
  resolveNotifyIpAllowlist,
} from '../services/paymentCallbackSecurity';

const XPAY_TOKEN = process.env.XPAY_TOKEN;
const XPAY_API_URL = process.env.XPAY_API_URL || 'http://localhost:8080/api/pay';
const XPAY_NOTIFY_URL = process.env.XPAY_NOTIFY_URL || 'http://localhost:3000/api/payment/xpay/notify';
const PAYPRO_ENABLED = String(process.env.PAYPRO_ENABLED || 'false').toLowerCase() === 'true';
const PAYPRO_API_URL = (process.env.PAYPRO_API_URL || '').replace(/\/+$/, '');
const PAYPRO_OPENAPI_SECRET = process.env.PAYPRO_OPENAPI_SECRET || '';
const PAYPRO_NOTIFY_URL = process.env.PAYPRO_NOTIFY_URL;
const PAYPRO_TIMEOUT_MS = Number.parseInt(process.env.PAYPRO_TIMEOUT_MS || '10000', 10);
const PAYPRO_DEV_MOCK_ENABLED =
  process.env.NODE_ENV !== 'production' &&
  String(process.env.PAYPRO_DEV_MOCK_ENABLED || 'false').toLowerCase() === 'true';
const PAYPRO_DEV_MOCK_MARK_COMPLETED =
  process.env.NODE_ENV !== 'production' &&
  String(process.env.PAYPRO_DEV_MOCK_MARK_COMPLETED || 'true').toLowerCase() === 'true';
const PAYPRO_DEV_MOCK_WECHAT_QR_URL = (process.env.PAYPRO_DEV_MOCK_WECHAT_QR_URL || '').trim();
const PAYPRO_DEV_MOCK_ALIPAY_QR_URL = (process.env.PAYPRO_DEV_MOCK_ALIPAY_QR_URL || '').trim();
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const parseNonNegativeIntegerEnv = (envName: string, fallback: number): number => {
  const raw = process.env[envName];
  if (!raw?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    logger.warn(`[Payment] Invalid ${envName}=${raw}, fallback to ${fallback}`);
    return fallback;
  }

  return parsed;
};

const parseNonNegativeYuanLimitToFenEnv = (envName: string, fallbackFen: number): number => {
  const raw = process.env[envName];
  if (!raw?.trim()) {
    return fallbackFen;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    logger.warn(`[Payment] Invalid ${envName}=${raw}, fallback to ${fenToYuanNumber(fallbackFen)}`);
    return fallbackFen;
  }

  return yuanToFen(parsed);
};

const PAYMENT_MAX_PENDING_ORDERS = parseNonNegativeIntegerEnv('PAYMENT_MAX_PENDING_ORDERS', 3);
const PAYMENT_DAILY_LIMIT_CNY_FEN = parseNonNegativeYuanLimitToFenEnv('PAYMENT_DAILY_LIMIT_CNY', 0);
const PAYMENT_DAILY_LIMIT_WECHAT_CNY_FEN = parseNonNegativeYuanLimitToFenEnv('PAYMENT_DAILY_LIMIT_WECHAT_CNY', 0);
const PAYMENT_DAILY_LIMIT_ALIPAY_CNY_FEN = parseNonNegativeYuanLimitToFenEnv('PAYMENT_DAILY_LIMIT_ALIPAY_CNY', 0);
const PAYMENT_NOTIFY_REPLAY_TTL_SECONDS = parseNonNegativeIntegerEnv('PAYMENT_NOTIFY_REPLAY_TTL_SECONDS', 600);
const XPAY_NOTIFY_IP_ALLOWLIST = resolveNotifyIpAllowlist(
  process.env.XPAY_NOTIFY_IP_ALLOWLIST,
  process.env.PAYMENT_NOTIFY_IP_ALLOWLIST,
);
const PAYPRO_NOTIFY_IP_ALLOWLIST = resolveNotifyIpAllowlist(
  process.env.PAYPRO_NOTIFY_IP_ALLOWLIST,
  process.env.PAYMENT_NOTIFY_IP_ALLOWLIST,
);

// Prices stored in fen (yuan * 100) for precision
// NOTE: These should match the frontend PaymentPlans.tsx defaultPlanConfigs
const PLAN_PRICES_FEN: Record<string, number> = {
  'basic-monthly': 700,      // 7 yuan
  'premium-quarterly': 2000, // 20 yuan
  'premium-yearly': 6300,    // 63 yuan
  'server_slot': 500          // 5 yuan
};

// NOTE: XPay's callback protocol currently defines an MD5 signature scheme.
// We keep this for compatibility with the upstream gateway and add strict freshness checks below.
const generateSignature = (params: Record<string, any>, token: string) => {
  const { money, mark, type, dt } = params;
  const str = `${type}${money}${mark}${dt}${token}`;
  return crypto.createHash('md5').update(str).digest('hex');
};

interface PayProCreateResponse {
  code?: number | string;
  msg?: string;
  data?: {
    orderNo?: string;
    payNum?: string;
    qrCodeUrl?: string;
    returnUrl?: string;
  };
}

interface PayProCreateResult {
  paymentUrl: string;
  payNum?: string;
  provider?: 'paypro' | 'paypro-mock';
}

type ExternalNotifyResult = 'COMPLETED' | 'ALREADY_COMPLETED' | 'NOT_FOUND' | 'AMOUNT_MISMATCH';

interface CompleteExternalPaymentOptions {
  expectedAmountFen?: number;
  metadata?: Record<string, unknown>;
}

const normalizeAmountToFen = (raw: string | number): number | null => {
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return yuanToFen(parsed);
};

const normalizePayProAmount = (raw: string | number): string | null => {
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed.toFixed(2);
};

const timingSafeEqualText = (left: string, right: string): boolean => {
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
};

const resolveTodayWindow = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const ensurePaymentGuardrails = async (
  userId: number,
  amountFen: number,
  paymentMethod: PaymentMethod,
): Promise<void> => {
  if (!isExternalPaymentMethod(paymentMethod)) {
    return;
  }

  const { start, end } = resolveTodayWindow();
  const [pendingCount, todayUsage, methodUsage] = await Promise.all([
    prisma.payment.count({
      where: {
        user_id: userId,
        status: 'PENDING',
        payment_method: { in: EXTERNAL_PAYMENT_METHODS },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        user_id: userId,
        status: 'COMPLETED',
        currency: 'CNY',
        payment_method: { in: EXTERNAL_PAYMENT_METHODS },
        created_at: { gte: start, lt: end },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        user_id: userId,
        status: 'COMPLETED',
        currency: 'CNY',
        payment_method: paymentMethod,
        created_at: { gte: start, lt: end },
      },
    }),
  ]);

  const violation = evaluatePaymentGuardrails(
    {
      maxPendingOrders: PAYMENT_MAX_PENDING_ORDERS,
      dailyLimitFen: PAYMENT_DAILY_LIMIT_CNY_FEN,
      dailyWechatLimitFen: PAYMENT_DAILY_LIMIT_WECHAT_CNY_FEN,
      dailyAlipayLimitFen: PAYMENT_DAILY_LIMIT_ALIPAY_CNY_FEN,
    },
    {
      paymentMethod,
      amountFen,
    },
    {
      pendingExternalOrders: pendingCount,
      dailyExternalUsedFen: todayUsage._sum.amount ?? 0,
      dailyMethodUsedFen: methodUsage._sum.amount ?? 0,
    },
  );

  if (!violation) {
    return;
  }

  if (violation.type === 'MAX_PENDING_ORDERS') {
    throw new AppError(
      `Too many pending payment orders (max ${PAYMENT_MAX_PENDING_ORDERS})`,
      429,
      ErrorCode.LIMIT_EXCEEDED,
      true,
      violation.details,
    );
  }

  if (violation.type === 'DAILY_TOTAL_LIMIT') {
    throw new AppError(
      'Daily payment limit exceeded',
      429,
      ErrorCode.LIMIT_EXCEEDED,
      true,
      violation.details,
    );
  }

  throw new AppError(
    `Daily ${paymentMethod} payment limit exceeded`,
    429,
    ErrorCode.LIMIT_EXCEEDED,
    true,
    violation.details,
  );
};

const buildPayProNotifyUrl = (req: Request): string => {
  if (PAYPRO_NOTIFY_URL?.trim()) {
    return PAYPRO_NOTIFY_URL.trim();
  }

  const host = req.get('host');
  if (!host) {
    return 'http://localhost:3000/api/v1/payment/paypro/notify';
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim()
    : req.protocol;

  return `${protocol}://${host}/api/v1/payment/paypro/notify`;
};

const buildPayProMockPaymentUrl = (
  req: Request,
  paymentId: string,
  amount: number,
  paymentMethod: 'wechat' | 'alipay',
): string => {
  const customUrl = paymentMethod === 'wechat'
    ? PAYPRO_DEV_MOCK_WECHAT_QR_URL
    : PAYPRO_DEV_MOCK_ALIPAY_QR_URL;

  if (customUrl) {
    return customUrl;
  }

  const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:4123';
  const mockUrl = new URL('/mock-pay-qr.html', origin);
  mockUrl.searchParams.set('orderId', paymentId);
  mockUrl.searchParams.set('amount', amount.toFixed(2));
  mockUrl.searchParams.set('method', paymentMethod);
  return mockUrl.toString();
};

const createPayProMockResult = (
  req: Request,
  payment: { id: string },
  amount: number,
  paymentMethod: 'wechat' | 'alipay',
): PayProCreateResult => ({
  paymentUrl: buildPayProMockPaymentUrl(req, payment.id, amount, paymentMethod),
  payNum: `mock-${payment.id}`,
  provider: 'paypro-mock',
});

const generatePayProSignature = (params: Record<string, unknown>, secret: string) => {
  const segments = Object.keys(params)
    .sort()
    .filter((key) => key !== 'sign')
    .map((key) => {
      const value = params[key];
      if (value === undefined || value === null) return '';
      const normalized = String(value).trim();
      if (!normalized) return '';
      return `${key}=${normalized}`;
    })
    .filter(Boolean);

  const signBase = [...segments, `key=${secret}`].join('&');
  return crypto.createHash('md5').update(signBase).digest('hex').toUpperCase();
};

const createPayProPayment = async (
  req: AuthRequest,
  payment: { id: string; plan_id: string },
  amount: number,
  paymentMethod: 'wechat' | 'alipay',
): Promise<PayProCreateResult> => {
  if (PAYPRO_DEV_MOCK_ENABLED) {
    logger.warn('[Payment] PayPro DEV mock mode enabled, returning mock QR payment URL', {
      paymentId: payment.id,
      paymentMethod,
    });
    return createPayProMockResult(req, payment, amount, paymentMethod);
  }

  if (!PAYPRO_ENABLED) {
    throw new AppError('PayPro payment channel is disabled', 503, ErrorCode.SERVICE_UNAVAILABLE);
  }

  if (!PAYPRO_API_URL || !PAYPRO_OPENAPI_SECRET) {
    throw new AppError('PayPro payment channel is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
  }

  const timestamp = Date.now();
  const amountText = amount.toFixed(2);
  const payloadForSign: Record<string, unknown> = {
    orderNo: payment.id,
    amount: amountText,
    payType: paymentMethod,
    timestamp,
    notifyUrl: buildPayProNotifyUrl(req),
    description: `QianFu ${payment.plan_id} order`,
    userId: String(req.user?.id || ''),
    nickName: req.user?.username || '',
    email: req.user?.email || '',
  };
  const sign = generatePayProSignature(payloadForSign, PAYPRO_OPENAPI_SECRET);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(PAYPRO_TIMEOUT_MS, 3000));

  try {
    const response = await fetch(`${PAYPRO_API_URL}/api/openapi/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payloadForSign,
        amount: Number(amountText),
        sign,
      }),
      signal: controller.signal,
    });

    let parsed: PayProCreateResponse;
    try {
      parsed = await response.json() as PayProCreateResponse;
    } catch {
      throw new AppError('PayPro response is invalid', 502, ErrorCode.SERVICE_UNAVAILABLE);
    }

    const success = String(parsed.code) === '200';
    if (!response.ok || !success) {
      const msg = parsed.msg || `HTTP ${response.status}`;
      throw new AppError(`PayPro create order failed: ${msg}`, 502, ErrorCode.PAYMENT_FAILED);
    }

    const paymentUrl = parsed.data?.returnUrl || parsed.data?.qrCodeUrl;
    if (!paymentUrl) {
      throw new AppError('PayPro did not return a payment URL', 502, ErrorCode.PAYMENT_FAILED);
    }

    return {
      paymentUrl,
      payNum: parsed.data?.payNum,
      provider: 'paypro',
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new AppError('PayPro request timeout', 504, ErrorCode.GATEWAY_TIMEOUT);
    }
    if (error instanceof AppError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'unknown upstream error';
    throw new AppError(`PayPro request failed: ${message}`, 502, ErrorCode.PAYMENT_FAILED);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Development-only fast-path completion for PayPro mock mode.
 * Avoids cross-connection audit writes inside SQLite transactions.
 */
const completeDevMockPayment = async (paymentId: string): Promise<void> => {
  await redisService.withLock(`payment:${paymentId}`, async () => {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === 'COMPLETED') {
      return;
    }

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const paymentRecord = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          updated_at: new Date(),
        },
      });

      if (paymentRecord.plan_id === 'custom') {
        let wallet = await tx.wallet.findUnique({
          where: { user_id: paymentRecord.user_id },
        });

        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              user_id: paymentRecord.user_id,
              balance: 0,
              currency: 'CNY',
              is_active: true,
            },
          });
        }

        const updatedWallet = await tx.wallet.update({
          where: { user_id: paymentRecord.user_id },
          data: { balance: { increment: paymentRecord.amount } },
        });

        const transaction = await tx.transaction.create({
          data: {
            wallet_id: wallet.id,
            amount: paymentRecord.amount,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            description: `Recharge: ${paymentRecord.plan_id}`,
            metadata: JSON.stringify({
              paymentId: paymentRecord.id,
              method: paymentRecord.payment_method,
              callbackSource: 'paypro-dev-mock',
            }),
          },
        });

        const signature = generateTransactionSignature({
          id: transaction.id,
          walletId: transaction.wallet_id,
          amount: transaction.amount,
          type: transaction.type,
          status: transaction.status,
          createdAt: transaction.created_at,
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { signature },
        });

        logger.info('[Payment] DEV mock wallet recharge completed', {
          paymentId: paymentRecord.id,
          walletId: updatedWallet.id,
          amountFen: paymentRecord.amount,
        });
      }

      return paymentRecord;
    });

    eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);
  });
};

const completeExternalPayment = async (
  req: Request,
  paymentId: string,
  options: CompleteExternalPaymentOptions = {},
): Promise<ExternalNotifyResult> => {
  return redisService.withLock(`payment:${paymentId}`, async () => {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      return 'NOT_FOUND';
    }

    if (typeof options.expectedAmountFen === 'number' && options.expectedAmountFen !== payment.amount) {
      return 'AMOUNT_MISMATCH';
    }

    if (payment.status === 'COMPLETED') {
      return 'ALREADY_COMPLETED';
    }

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const beforePayment = await tx.payment.findUnique({ where: { id: paymentId } });
      const paymentRecord = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          updated_at: new Date(),
        },
      });

      if (paymentRecord.plan_id === 'custom') {
        const wallet = await tx.wallet.findUnique({
          where: { user_id: paymentRecord.user_id },
        });

        if (wallet) {
          const beforeWallet = { ...wallet };
          const updatedWallet = await tx.wallet.update({
            where: { user_id: paymentRecord.user_id },
            data: { balance: { increment: paymentRecord.amount } },
          });

          const transaction = await tx.transaction.create({
            data: {
              wallet_id: wallet.id,
              amount: paymentRecord.amount,
              type: 'DEPOSIT',
              status: 'COMPLETED',
              description: `Recharge: ${paymentRecord.plan_id}`,
              metadata: JSON.stringify({
                paymentId: paymentRecord.id,
                method: paymentRecord.payment_method,
                ...(options.metadata || {}),
              }),
            },
          });

          const signature = generateTransactionSignature({
            id: transaction.id,
            walletId: transaction.wallet_id,
            amount: transaction.amount,
            type: transaction.type,
            status: transaction.status,
            createdAt: transaction.created_at,
          });

          await tx.transaction.update({
            where: { id: transaction.id },
            data: { signature },
          });

          await logDataChange(paymentRecord.user_id, 'WALLET_DEPOSIT', `wallet_${wallet.id}`, req, beforeWallet, updatedWallet);
        }
      }

      await logDataChange(paymentRecord.user_id, 'PAYMENT_COMPLETED', `payment_${paymentRecord.id}`, req, beforePayment, paymentRecord);
      return paymentRecord;
    });

    eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);
    return 'COMPLETED';
  });
};

export const createPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const idempotencyKeyHeader = req.header('Idempotency-Key') || req.header('idempotency-key');
    const idempotencyKey = idempotencyKeyHeader ? idempotencyKeyHeader.trim() : '';
    const idempotencyCacheKey = idempotencyKey ? `idempotency:payment:create:${userId}:${idempotencyKey}` : '';

    if (idempotencyCacheKey) {
      const cached: any = await redisService.get(idempotencyCacheKey);
      if (cached && cached.ok) {
        return sendSuccess(res, cached.data, cached.message);
      }
    }

    const execute = async () => {
      const validation = paymentCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
          issues: validation.error.issues,
        });
      }
      const { amount, planId, paymentMethod, currency = 'CNY' } = validation.data;

      // Convert yuan to fen for storage
      const amountFen = yuanToFen(amount);

      if (planId !== 'custom') {
        const expectedPriceFen = PLAN_PRICES_FEN[planId];
        if (expectedPriceFen === undefined) {
          throw new AppError(`Invalid plan ID: ${planId}`, 400, ErrorCode.VALIDATION_ERROR);
        }
        if (amountFen !== expectedPriceFen) {
          throw new AppError(`Invalid amount for ${planId}. Expected ${expectedPriceFen / 100} yuan, got ${amount}`, 400, ErrorCode.VALIDATION_ERROR);
        }
      } else if (amount < 0.1) {
        throw new AppError('Minimum recharge amount is 0.1', 400, ErrorCode.VALIDATION_ERROR);
      }

      await ensurePaymentGuardrails(userId, amountFen, paymentMethod);

      const payment = await prisma.payment.create({
        data: {
          user_id: userId,
          amount: amountFen, // Store as fen
          plan_id: planId,
          payment_method: paymentMethod,
          currency,
          status: 'PENDING',
        },
      });

      if (paymentMethod === 'balance') {
        try {
          const updatedPayment = await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUniqueOrThrow({
              where: { user_id: userId },
            });

            if (wallet.balance < amountFen) {
              throw new AppError('Insufficient balance', 400, ErrorCode.INSUFFICIENT_FUNDS);
            }

            const updateResult = await tx.wallet.updateMany({
              where: {
                id: wallet.id,
                balance: { gte: amountFen }
              },
              data: {
                balance: { decrement: amountFen },
              },
            });

            if (updateResult.count === 0) {
              throw new AppError('Insufficient balance', 400, ErrorCode.INSUFFICIENT_FUNDS);
            }

            const transaction = await tx.transaction.create({
              data: {
                wallet_id: wallet.id,
                amount: -amountFen, // Negative fen for deduction
                type: 'PAYMENT',
                status: 'COMPLETED',
                description: `Plan: ${planId}`,
                metadata: JSON.stringify({ paymentId: payment.id })
              },
            });

            const signature = generateTransactionSignature({
              id: transaction.id,
              walletId: transaction.wallet_id,
              amount: transaction.amount,
              type: transaction.type,
              status: transaction.status,
              createdAt: transaction.created_at,
            });

            await tx.transaction.update({
              where: { id: transaction.id },
              data: { signature }
            });

            const finalPayment = await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: 'COMPLETED',
                updated_at: new Date()
              }
            });

            return finalPayment;
          });

          await logDataChange(userId, 'PAYMENT_COMPLETED_BALANCE', `payment_${payment.id}`, req, payment, updatedPayment);
          eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);

          const responseData = {
            success: true,
            paymentId: payment.id,
            orderId: payment.id,
            id: payment.id,
            status: 'COMPLETED',
          };
          if (idempotencyCacheKey) {
            await redisService.set(idempotencyCacheKey, { ok: true, data: responseData, message: 'Payment successful' }, IDEMPOTENCY_TTL_SECONDS);
          }

          return sendSuccess(res, responseData, 'Payment successful');
        } catch (error: any) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { 
              status: 'FAILED',
              updated_at: new Date()
            }
          });
          throw error;
        }
      }

      const xpayType = paymentMethod === 'wechat' ? 'wechat' : 'alipay';
      let responseData: Record<string, unknown>;
      try {
        if (PAYPRO_ENABLED || PAYPRO_DEV_MOCK_ENABLED) {
          const payProResult = await createPayProPayment(req, payment, amount, xpayType);
          if (payProResult.provider === 'paypro-mock' && PAYPRO_DEV_MOCK_MARK_COMPLETED) {
            await completeDevMockPayment(payment.id);
          }
          responseData = {
            success: true,
            paymentId: payment.id,
            orderId: payment.id,
            id: payment.id,
            paymentUrl: payProResult.paymentUrl,
            payNum: payProResult.payNum,
            provider: payProResult.provider || 'paypro',
          };
        } else {
          if (!XPAY_TOKEN) {
            throw new AppError('Payment service unavailable', 503, ErrorCode.SERVICE_UNAVAILABLE);
          }

          const dt = Date.now().toString();
          const mark = payment.id;
          const sign = generateSignature({ money: amount.toFixed(2), mark, type: xpayType, dt }, XPAY_TOKEN);
          responseData = {
            success: true,
            paymentId: payment.id,
            orderId: payment.id,
            id: payment.id,
            provider: 'xpay',
            paymentUrl: `${XPAY_API_URL}?type=${xpayType}&money=${amount.toFixed(2)}&mark=${mark}&dt=${dt}&sign=${sign}&notify_url=${encodeURIComponent(XPAY_NOTIFY_URL)}`,
          };
        }
      } catch (error) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            updated_at: new Date(),
          },
        });
        throw error;
      }

      if (idempotencyCacheKey) {
        await redisService.set(idempotencyCacheKey, { ok: true, data: responseData, message: 'Success' }, IDEMPOTENCY_TTL_SECONDS);
      }

      return sendSuccess(res, responseData, 'Success');
    };

    if (idempotencyCacheKey) {
      const lockKey = `idempotency:lock:payment:create:${userId}:${idempotencyKey}`;
      return await redisService.withLock(lockKey, execute, 30);
    }

    return await execute();

  } catch (error: any) {
    next(handleError(error));
  }
};

export const xpayNotify = async (req: Request, res: Response) => {
  let replayKey: string | null = null;
  try {
    const clientIp = extractRequestClientIp(req);
    if (!isNotifyIpAllowed(clientIp, XPAY_NOTIFY_IP_ALLOWLIST)) {
      logger.warn('[Payment] xpayNotify rejected by IP allowlist', {
        clientIp,
        allowlistSize: XPAY_NOTIFY_IP_ALLOWLIST.size,
      });
      return res.send('fail');
    }

    const validation = xpayNotifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).send('fail');
    }
    const { type, money, mark, dt, sign } = validation.data;

    const timestamp = Number(dt);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return res.send('fail');
    }

    if (!XPAY_TOKEN) {
      logger.error('[Payment] xpayNotify rejected: XPAY_TOKEN is not configured');
      return res.send('fail');
    }

    const expectedSign = generateSignature({ money, mark, type, dt }, XPAY_TOKEN);
    if (!timingSafeEqualText(String(sign).trim().toLowerCase(), expectedSign.toLowerCase())) {
      return res.send('fail');
    }

    const expectedAmountFen = normalizeAmountToFen(money);
    if (expectedAmountFen === null) {
      return res.send('fail');
    }

    if (PAYMENT_NOTIFY_REPLAY_TTL_SECONDS > 0) {
      replayKey = buildXpayNotifyReplayKey({
        mark,
        dt,
        money,
        sign: String(sign),
      });

      const accepted = await redisService.setIfNotExists(
        replayKey,
        { source: 'xpay', mark, dt, money },
        PAYMENT_NOTIFY_REPLAY_TTL_SECONDS,
      );

      if (!accepted) {
        logger.warn('[Payment] xpayNotify replay callback ignored', {
          mark,
          replayKey,
        });
        return res.send('success');
      }
    }

    const result = await completeExternalPayment(req, mark, {
      expectedAmountFen,
      metadata: {
        callbackSource: 'xpay',
        type,
        dt,
      },
    });

    if (result === 'NOT_FOUND' || result === 'AMOUNT_MISMATCH') {
      if (replayKey) {
        await redisService.del(replayKey).catch(() => undefined);
      }
      return res.send('fail');
    }

    return res.send('success');

  } catch (error: any) {
    if (replayKey) {
      await redisService.del(replayKey).catch(() => undefined);
    }
    logger.error('[Payment] xpayNotify error:', error);
    res.status(500).send('error');
  }
};

export const payProNotify = async (req: Request, res: Response) => {
  let replayKey: string | null = null;
  try {
    const clientIp = extractRequestClientIp(req);
    if (!isNotifyIpAllowed(clientIp, PAYPRO_NOTIFY_IP_ALLOWLIST)) {
      logger.warn('[Payment] payProNotify rejected by IP allowlist', {
        clientIp,
        allowlistSize: PAYPRO_NOTIFY_IP_ALLOWLIST.size,
      });
      return res.send('fail');
    }

    const validation = payProNotifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).send('fail');
    }

    const { orderNo, amount, payNum, sign } = validation.data;
    if (!PAYPRO_OPENAPI_SECRET) {
      logger.error('[Payment] payProNotify rejected: PAYPRO_OPENAPI_SECRET is not configured');
      return res.send('fail');
    }

    const normalizedAmount = normalizePayProAmount(amount);
    if (!normalizedAmount) {
      return res.send('fail');
    }

    const expectedSign = generatePayProSignature(
      {
        orderNo,
        amount: normalizedAmount,
        payNum,
      },
      PAYPRO_OPENAPI_SECRET,
    );

    if (!timingSafeEqualText(String(sign).trim().toUpperCase(), expectedSign.toUpperCase())) {
      return res.send('fail');
    }

    const expectedAmountFen = normalizeAmountToFen(normalizedAmount);
    if (expectedAmountFen === null) {
      return res.send('fail');
    }

    if (PAYMENT_NOTIFY_REPLAY_TTL_SECONDS > 0) {
      replayKey = buildPayProNotifyReplayKey({
        orderNo,
        payNum,
        amount: normalizedAmount,
        sign: String(sign),
      });

      const accepted = await redisService.setIfNotExists(
        replayKey,
        { source: 'paypro', orderNo, payNum, amount: normalizedAmount },
        PAYMENT_NOTIFY_REPLAY_TTL_SECONDS,
      );

      if (!accepted) {
        logger.warn('[Payment] payProNotify replay callback ignored', {
          orderNo,
          replayKey,
        });
        return res.send('success');
      }
    }

    const result = await completeExternalPayment(req, orderNo, {
      expectedAmountFen,
      metadata: {
        callbackSource: 'paypro',
        payNum,
      },
    });

    if (result === 'NOT_FOUND' || result === 'AMOUNT_MISMATCH') {
      if (replayKey) {
        await redisService.del(replayKey).catch(() => undefined);
      }
      return res.send('fail');
    }

    return res.send('success');
  } catch (error: any) {
    if (replayKey) {
      await redisService.del(replayKey).catch(() => undefined);
    }
    logger.error('[Payment] payProNotify error:', error);
    return res.status(500).send('error');
  }
};

export const getPaymentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = paymentStatusParamSchema.safeParse(req.params);
    if (!validation.success) {
      throw new AppError('Invalid payment ID', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }
    const { orderId } = validation.data;
    const userId = req.user!.id;

    const payment = await prisma.payment.findFirst({
      where: { id: orderId, user_id: userId }
    });

    if (!payment) {
      throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
    }

    return sendSuccess(res, { 
      status: payment.status,
      orderId: payment.id
    });
  } catch (error: any) {
    next(handleError(error));
  }
};

export const cancelPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = paymentCancelParamSchema.safeParse(req.params);
    if (!validation.success) {
      throw new AppError('Invalid payment ID', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }

    const userId = req.user!.id;
    const { orderId } = validation.data;

    const result = await redisService.withLock(`payment:${orderId}`, async () => {
      const payment = await prisma.payment.findFirst({
        where: { id: orderId, user_id: userId },
      });

      if (!payment) {
        throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
      }

      const cancelAction = resolvePaymentCancelAction(payment.status);

      if (cancelAction === 'ALREADY_COMPLETED') {
        throw new AppError('Completed payment cannot be cancelled', 409, ErrorCode.INVALID_OPERATION);
      }

      if (cancelAction === 'ALREADY_PROCESSED') {
        return {
          paymentId: payment.id,
          orderId: payment.id,
          status: payment.status,
          cancelled: false,
        };
      }

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          updated_at: new Date(),
        },
      });

      await logDataChange(userId, 'PAYMENT_CANCELLED', `payment_${payment.id}`, req, payment, updatedPayment);

      return {
        paymentId: updatedPayment.id,
        orderId: updatedPayment.id,
        status: updatedPayment.status,
          cancelled: true,
        };
      });

    return sendSuccess(
      res,
      result,
      result.cancelled ? 'Pending payment cancelled' : 'Order already processed',
    );
  } catch (error: any) {
    next(handleError(error));
  }
};

export const getUserPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const validation = paymentQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }
    const { page, limit, status, planId, search, fuzzy, sortBy, sortOrder, startDate, endDate } = validation.data;
    const { skip, take } = buildPagination({ page, limit });

    const where: any = { user_id: userId };
    if (status) where.status = status;
    if (planId) where.plan_id = planId;
    if (search) {
      where.OR = [
        ...buildKeywordOrConditions(['id', 'plan_id', 'payment_method', 'status'], search, fuzzy),
      ];
    }
    const range = buildDateRange({ startDate, endDate });
    if (range) {
      where.created_at = range;
    }

    const normalizedSortField = resolveSortField(
      sortBy,
      ['created_at', 'updated_at', 'amount', 'status'] as const,
      'created_at',
    );
    const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { [normalizedSortField]: normalizedSortOrder },
        skip,
        take
      }),
      prisma.payment.count({
        where
      })
    ]);

    // Convert amounts from fen to yuan for API response
    const paymentsWithFormattedAmounts = payments.map(p => ({
      ...p,
      amount: fenToYuanNumber(p.amount)
    }));

    return sendListResponse(res, paymentsWithFormattedAmounts, totalCount, page, limit, { resource: 'Payment' });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all payments (Admin only)
 */
export const getAllPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = paymentQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { page, limit, status, planId, userId, search, fuzzy, sortBy, sortOrder, startDate, endDate } = validation.data;
    const { skip, take } = buildPagination({ page, limit });

    const where: any = {};
    if (status) where.status = status;
    if (planId) where.plan_id = planId;
    if (userId) where.user_id = userId;
    if (search) {
      where.OR = [
        ...buildKeywordOrConditions(['id', 'plan_id', 'payment_method', 'status'], search, fuzzy),
      ];
    }
    const range = buildDateRange({ startDate, endDate });
    if (range) {
      where.created_at = range;
    }

    const normalizedSortField = resolveSortField(
      sortBy,
      ['created_at', 'updated_at', 'amount', 'status'] as const,
      'created_at',
    );
    const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { [normalizedSortField]: normalizedSortOrder },
        skip,
        take,
        include: {
          user: {
            select: { id: true, username: true, email: true }
          }
        }
      }),
      prisma.payment.count({ where })
    ]);

    // Convert amounts from fen to yuan for API response
    const paymentsWithFormattedAmounts = payments.map(p => ({
      ...p,
      amount: fenToYuanNumber(p.amount)
    }));

    return sendListResponse(res, paymentsWithFormattedAmounts, totalCount, page, limit, { resource: 'Payment' });
  } catch (error: any) {
    next(handleError(error));
  }
};

/**
 * Manually complete a payment (Admin only)
 */
export const manualCompletePayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = manualPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
        issues: validation.error.issues,
      });
    }
    const { orderId } = validation.data;

    await redisService.withLock(`payment:${orderId}`, async () => {
      const payment = await prisma.payment.findUnique({ where: { id: orderId } });
      if (!payment) throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
      if (payment.status === 'COMPLETED') return; // Already completed, handled by withLock return value if needed

      const updatedPayment = await prisma.$transaction(async (tx) => {
        const beforePayment = await tx.payment.findUnique({ where: { id: orderId } });
        // Re-check status inside transaction for absolute safety
        if (beforePayment?.status === 'COMPLETED') return beforePayment;

        const paymentRecord = await tx.payment.update({
          where: { id: orderId },
          data: { status: 'COMPLETED', updated_at: new Date() }
        });

        // Only add to balance if it's a custom recharge plan
        if (paymentRecord.plan_id === 'custom') {
          const wallet = await tx.wallet.findUnique({
            where: { user_id: paymentRecord.user_id }
          });

          if (wallet) {
            const beforeWallet = { ...wallet };
            const updatedWallet = await tx.wallet.update({
              where: { user_id: paymentRecord.user_id },
              data: { balance: { increment: paymentRecord.amount } }
            });

            const transaction = await tx.transaction.create({
              data: {
                wallet_id: wallet.id,
                amount: paymentRecord.amount,
                type: 'DEPOSIT',
                status: 'COMPLETED',
                description: `Manual Recharge: ${paymentRecord.plan_id}`,
                metadata: JSON.stringify({ admin_id: req.user!.id, method: 'MANUAL' })
              }
            });

            // Generate Signature
            const signature = generateTransactionSignature({
              id: transaction.id,
              walletId: transaction.wallet_id,
              amount: transaction.amount,
              type: transaction.type,
              status: transaction.status,
              createdAt: transaction.created_at,
            });

            // Save Signature
            await tx.transaction.update({
              where: { id: transaction.id },
              data: { signature }
            });

            await logDataChange(paymentRecord.user_id, 'WALLET_DEPOSIT_MANUAL', `wallet_${wallet.id}`, req, beforeWallet, updatedWallet);
          }
        }

        await logDataChange(req.user!.id, 'PAYMENT_COMPLETED_MANUAL', `payment_${paymentRecord.id}`, req, beforePayment, paymentRecord);
        return paymentRecord;
      });

      if (updatedPayment) {
        eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);
      }
    });

    return sendSuccess(res, { message: 'Order completed or already handled' }, 'Order processed');
  } catch (error: any) {
    next(handleError(error));
  }
};

/**
 * Get payment statistics (Admin only)
 */
export const getPaymentStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = paymentStatsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { days } = validation.data;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await prisma.payment.findMany({
      where: { created_at: { gte: startDate } },
      orderBy: { created_at: 'asc' }
    });

    const stats: Record<string, { total: number, completed: number, failed: number, amount: number }> = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().split('T')[0];
      stats[dayKey] = { total: 0, completed: 0, failed: 0, amount: 0 };
    }

    payments.forEach(p => {
      const dayKey = p.created_at.toISOString().split('T')[0];
      if (stats[dayKey]) {
        stats[dayKey].total++;
        if (p.status === 'COMPLETED') {
          stats[dayKey].completed++;
          stats[dayKey].amount += p.amount; // p.amount is in fen, accumulate in fen
        } else if (p.status === 'FAILED' || p.status === 'EXPIRED') {
          stats[dayKey].failed++;
        }
      }
    });

    const sortedStats = Object.entries(stats)
      .map(([date, data]) => ({
        date,
        total: data.total,
        completed: data.completed,
        failed: data.failed,
        amount: fenToYuanNumber(data.amount) // Convert total fen to yuan for display
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return sendSuccess(res, sortedStats);
  } catch (error: any) {
    next(error);
  }
};

import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import prisma from '../db';
import { sendSuccess } from '../utils/response';
import { AppError, ErrorCode } from '../utils/errors';
import { redisService } from '../services/redisService';
import { logger } from '../utils/logger';

const PAYMENT_PROJECT_CONFIG_PREFIX = 'payment_project:';
const DEFAULT_PAYMENT_PROJECT_KEY = process.env.DEFAULT_PAYMENT_PROJECT_KEY?.trim() || 'qianfu';
const BRIDGE_REPLAY_TTL_SECONDS = Number.parseInt(process.env.XPAY_BRIDGE_REPLAY_TTL_SECONDS || '600', 10);

interface BridgeProjectConfig {
  key: string;
  displayName: string;
  xpayGatewayBaseUrl?: string;
  xpayGatewayNotifySecret?: string;
  xpayTenantKey?: string;
  bridgeNotifySecret?: string;
  personalQrListenerSecret?: string;
}

interface NormalizedBridgeNotify {
  projectKey: string;
  orderId: string;
  amount: string;
  tradeNo: string;
  timestamp: string;
  nonce: string;
  status: string;
  provider: string;
  metadata?: unknown;
}

const sanitizeProjectKey = (raw: string | null | undefined): string => {
  const value = (raw || '').trim().toLowerCase();
  if (!value) {
    return DEFAULT_PAYMENT_PROJECT_KEY;
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
    throw new AppError('Invalid project key', 400, ErrorCode.VALIDATION_ERROR);
  }
  return value;
};

const parseBridgeProjectConfig = (projectKey: string, raw: string | null | undefined): BridgeProjectConfig => {
  if (!raw?.trim()) {
    throw new AppError(`Payment project config missing: ${projectKey}`, 503, ErrorCode.SERVICE_UNAVAILABLE);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(`Payment project config is invalid JSON: ${projectKey}`, 500, ErrorCode.INTERNAL_ERROR);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AppError(`Payment project config must be an object: ${projectKey}`, 500, ErrorCode.INTERNAL_ERROR);
  }

  const record = parsed as Record<string, unknown>;
  return {
    key: sanitizeProjectKey(String(record.key || projectKey)),
    displayName: String(record.displayName || projectKey).trim() || projectKey,
    xpayGatewayBaseUrl: String(record.xpayGatewayBaseUrl || '').trim() || undefined,
    xpayGatewayNotifySecret: String(record.xpayGatewayNotifySecret || '').trim() || undefined,
    xpayTenantKey: String(record.xpayTenantKey || '').trim() || undefined,
    bridgeNotifySecret: String(record.bridgeNotifySecret || '').trim() || undefined,
    personalQrListenerSecret: String(record.personalQrListenerSecret || '').trim() || undefined,
  };
};

const getBridgeProjectConfig = async (projectKeyRaw?: string): Promise<BridgeProjectConfig> => {
  const projectKey = sanitizeProjectKey(projectKeyRaw);
  const stored = await prisma.systemConfig.findUnique({
    where: { key: `${PAYMENT_PROJECT_CONFIG_PREFIX}${projectKey}` },
  });
  return parseBridgeProjectConfig(projectKey, stored?.value);
};

const buildSortedSignBase = (params: Record<string, unknown>): string =>
  Object.keys(params)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => `${key}=${String(params[key] ?? '').trim()}`)
    .join('&');

const generateHexHmac = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

const generateBase64Hmac = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('base64');

const timingSafeEqualText = (left: string, right: string): boolean => {
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
};

const buildReplayKey = (parts: Array<string | number | null | undefined>): string => {
  const raw = parts.map((part) => String(part ?? '').trim()).join('|');
  const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');
  return `payment:notify:replay:xpay-bridge:${fingerprint}`;
};

const normalizeAmountText = (raw: unknown): string => {
  const parsed = Number(String(raw ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError('Invalid amount', 400, ErrorCode.VALIDATION_ERROR);
  }
  return parsed.toFixed(2);
};

const normalizeProvider = (raw: unknown): string => {
  const provider = String(raw || '').trim().toLowerCase();
  if (!['alipay', 'wechat', 'qqpay', 'unipay'].includes(provider)) {
    throw new AppError('Unsupported provider', 400, ErrorCode.VALIDATION_ERROR);
  }
  return provider;
};

const normalizeSuccessStatus = (raw: unknown): string => {
  const status = String(raw || 'SUCCESS').trim().toUpperCase();
  if (status === 'SUCCESS' || status === 'PAID' || status === 'TRADE_SUCCESS') {
    return 'SUCCESS';
  }
  throw new AppError('Unsupported status', 400, ErrorCode.VALIDATION_ERROR);
};

const extractOrderIdFromBody = (projectKey: string, body: Record<string, unknown>): string => {
  const direct = String(body.orderId || body.mark || body.outOrderId || body.merchantOrderId || '').trim();
  if (direct) {
    return direct;
  }

  const source = [
    body.remark,
    body.subject,
    body.description,
    body.memo,
  ].map((value) => String(value || '')).join(' ');

  const projectScoped = source.match(new RegExp(`\\b${projectKey}_[a-z0-9-]{8,80}\\b`, 'i'));
  if (projectScoped?.[0]) {
    return projectScoped[0];
  }

  const genericScoped = source.match(/\b[a-z0-9][a-z0-9_-]{0,63}_[a-z0-9-]{8,80}\b/i);
  if (genericScoped?.[0]) {
    return genericScoped[0];
  }

  throw new AppError('Missing orderId. Personal QR events must include orderId or a remark containing it.', 400, ErrorCode.VALIDATION_ERROR);
};

const ensureBridgeConfig = (config: BridgeProjectConfig) => {
  if (!config.xpayGatewayBaseUrl || !config.xpayGatewayNotifySecret || !config.xpayTenantKey) {
    throw new AppError('Bridge project config incomplete', 503, ErrorCode.SERVICE_UNAVAILABLE);
  }
};

const assertFreshTimestamp = (timestamp: string) => {
  const dt = Number(timestamp);
  if (!Number.isFinite(dt) || Math.abs(Date.now() - dt) > 10 * 60 * 1000) {
    throw new AppError('Bridge timestamp expired', 400, ErrorCode.VALIDATION_ERROR);
  }
};

const verifyBridgeSignature = (
  payload: NormalizedBridgeNotify,
  sign: string,
  secret: string,
) => {
  const signPayload = {
    projectKey: payload.projectKey,
    orderId: payload.orderId,
    amount: payload.amount,
    tradeNo: payload.tradeNo,
    timestamp: payload.timestamp,
    nonce: payload.nonce,
    status: payload.status,
    provider: payload.provider,
  };
  const expectedSign = generateHexHmac(buildSortedSignBase(signPayload), secret);
  if (!timingSafeEqualText(sign.toLowerCase(), expectedSign.toLowerCase())) {
    throw new AppError('Invalid bridge signature', 401, ErrorCode.UNAUTHORIZED);
  }
};

const reserveBridgeReplay = async (input: NormalizedBridgeNotify, sign: string): Promise<string | null> => {
  if (BRIDGE_REPLAY_TTL_SECONDS <= 0) {
    return null;
  }

  const replayKey = buildReplayKey([input.projectKey, input.orderId, input.tradeNo, input.amount, input.timestamp, input.nonce, sign]);
  const accepted = await redisService.setIfNotExists(
    replayKey,
    { projectKey: input.projectKey, orderId: input.orderId, tradeNo: input.tradeNo, amount: input.amount, timestamp: input.timestamp },
    BRIDGE_REPLAY_TTL_SECONDS,
  );
  return accepted ? replayKey : '';
};

const forwardToXpayGateway = async (input: NormalizedBridgeNotify, config: BridgeProjectConfig) => {
  ensureBridgeConfig(config);

  const gatewayPayload: Record<string, unknown> = {
    tradeNo: input.tradeNo,
    amount: input.amount,
    timestamp: input.timestamp,
    nonce: input.nonce,
    status: input.status,
    provider: input.provider,
  };
  if (input.metadata !== undefined) {
    gatewayPayload.metadata = typeof input.metadata === 'string' ? input.metadata : JSON.stringify(input.metadata);
  }
  const gatewaySign = generateBase64Hmac(buildSortedSignBase(gatewayPayload), config.xpayGatewayNotifySecret!);
  gatewayPayload.sign = gatewaySign;

  const gatewayBaseUrl = config.xpayGatewayBaseUrl!.replace(/\/+$/, '');
  const gatewayUrl = `${gatewayBaseUrl}/open/gateway/tenants/${encodeURIComponent(config.xpayTenantKey!)}/orders/${encodeURIComponent(input.orderId)}/notify`;

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gatewayPayload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    logger.error('[XPayBridge] gateway notify failed', {
      projectKey: input.projectKey,
      orderId: input.orderId,
      status: response.status,
      responseText,
    });
    throw new AppError(`XPay gateway notify failed: HTTP ${response.status}`, 502, ErrorCode.PAYMENT_FAILED);
  }

  let parsedResponse: unknown = responseText;
  try {
    parsedResponse = JSON.parse(responseText);
  } catch {
    parsedResponse = responseText;
  }

  return {
    tenantKey: config.xpayTenantKey,
    gatewayUrl,
    gatewayResponse: parsedResponse,
  };
};

export const xpayGatewayBridgeNotify = async (req: Request, res: Response, next: NextFunction) => {
  let replayKey: string | null = null;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const projectKey = sanitizeProjectKey(String(body.projectKey || DEFAULT_PAYMENT_PROJECT_KEY));
    const config = await getBridgeProjectConfig(projectKey);

    if (!config.bridgeNotifySecret) {
      throw new AppError('Bridge project config incomplete', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    ensureBridgeConfig(config);

    const orderId = String(body.orderId || '').trim();
    const amount = normalizeAmountText(body.amount);
    const tradeNo = String(body.tradeNo || '').trim();
    const timestamp = String(body.timestamp || '').trim();
    const nonce = String(body.nonce || '').trim();
    const sign = String(body.sign || '').trim();
    const status = normalizeSuccessStatus(body.status);
    const provider = normalizeProvider(body.provider);
    const metadata = body.metadata;

    if (!orderId || !amount || !tradeNo || !timestamp || !nonce || !sign) {
      throw new AppError('Missing required fields', 400, ErrorCode.VALIDATION_ERROR);
    }

    const input: NormalizedBridgeNotify = {
      projectKey,
      orderId,
      amount,
      tradeNo,
      timestamp,
      nonce,
      status,
      provider,
      metadata,
    };
    verifyBridgeSignature(input, sign, config.bridgeNotifySecret);
    assertFreshTimestamp(timestamp);

    replayKey = await reserveBridgeReplay(input, sign);
    if (replayKey === '') {
      return sendSuccess(res, { accepted: true, replay: true }, 'Bridge replay ignored');
    }

    const gatewayResult = await forwardToXpayGateway(input, config);

    return sendSuccess(res, {
      accepted: true,
      projectKey,
      tenantKey: gatewayResult.tenantKey,
      orderId,
      tradeNo,
      gatewayUrl: gatewayResult.gatewayUrl,
      gatewayResponse: gatewayResult.gatewayResponse,
    }, 'Bridge notify accepted');
  } catch (error) {
    if (replayKey) {
      await redisService.del(replayKey).catch(() => undefined);
    }
    next(error);
  }
};

export const personalQrListenerNotify = async (req: Request, res: Response, next: NextFunction) => {
  let replayKey: string | null = null;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const projectKey = sanitizeProjectKey(String(body.projectKey || DEFAULT_PAYMENT_PROJECT_KEY));
    const config = await getBridgeProjectConfig(projectKey);
    const listenerSecret = config.personalQrListenerSecret || config.bridgeNotifySecret;

    if (!listenerSecret) {
      throw new AppError('Personal QR listener secret is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    ensureBridgeConfig(config);

    const input: NormalizedBridgeNotify = {
      projectKey,
      orderId: extractOrderIdFromBody(projectKey, body),
      amount: normalizeAmountText(body.amount),
      tradeNo: String(body.tradeNo || body.transactionId || body.billNo || '').trim(),
      timestamp: String(body.timestamp || '').trim(),
      nonce: String(body.nonce || '').trim(),
      status: normalizeSuccessStatus(body.status),
      provider: normalizeProvider(body.provider),
      metadata: {
        source: 'personal-qr-listener',
        paidAt: body.paidAt || null,
        payer: body.payer || null,
        remark: body.remark || null,
        listenerId: body.listenerId || null,
      },
    };
    const sign = String(body.sign || '').trim();

    if (!input.tradeNo || !input.timestamp || !input.nonce || !sign) {
      throw new AppError('Missing required fields', 400, ErrorCode.VALIDATION_ERROR);
    }

    verifyBridgeSignature(input, sign, listenerSecret);
    assertFreshTimestamp(input.timestamp);

    replayKey = await reserveBridgeReplay(input, sign);
    if (replayKey === '') {
      return sendSuccess(res, { accepted: true, replay: true }, 'Personal QR replay ignored');
    }

    const gatewayResult = await forwardToXpayGateway(input, config);

    return sendSuccess(res, {
      accepted: true,
      source: 'personal-qr-listener',
      projectKey,
      tenantKey: gatewayResult.tenantKey,
      orderId: input.orderId,
      tradeNo: input.tradeNo,
      gatewayUrl: gatewayResult.gatewayUrl,
      gatewayResponse: gatewayResult.gatewayResponse,
    }, 'Personal QR notify accepted');
  } catch (error) {
    if (replayKey) {
      await redisService.del(replayKey).catch(() => undefined);
    }
    next(error);
  }
};

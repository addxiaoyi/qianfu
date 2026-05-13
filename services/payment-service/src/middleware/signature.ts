/**
 * HMAC Signature Middleware
 * 验证 Webhook 请求的签名
 */

import { createHmac } from 'crypto';
import { IncomingHttpHeaders } from 'http';

// ============================================================================
// 类型定义
// ============================================================================

type SupportedProvider = 'alipay' | 'wechat' | 'stripe' | 'xpay';

interface SignatureConfig {
  secret: string;
  signatureHeader: string;
  timestampHeader?: string;
  algorithm?: 'sha256' | 'sha1';
}

// ============================================================================
// 提供商配置
// ============================================================================

const PROVIDER_CONFIGS: Record<SupportedProvider, SignatureConfig> = {
  alipay: {
    secret: process.env.ALIPAY_WEBHOOK_SECRET || '',
    signatureHeader: 'x-alipay-signature',
    timestampHeader: 'x-alipay-timestamp',
    algorithm: 'sha256',
  },
  wechat: {
    secret: process.env.WECHAT_WEBHOOK_SECRET || '',
    signatureHeader: 'x-wechat-signature',
    algorithm: 'sha256',
  },
  stripe: {
    secret: process.env.STRIPE_WEBHOOK_SECRET || '',
    signatureHeader: 'stripe-signature',
    algorithm: 'sha256',
  },
  xpay: {
    secret: process.env.XPAY_WEBHOOK_SECRET || '',
    signatureHeader: 'x-xpay-signature',
    timestampHeader: 'x-xpay-timestamp',
    algorithm: 'sha256',
  },
};

// ============================================================================
// 签名验证函数
// ============================================================================

/**
 * 生成 HMAC 签名
 */
function generateSignature(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256',
  timestamp?: string
): string {
  const data = timestamp ? `${timestamp}.${payload}` : payload;
  return createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * 验证 Stripe 签名（使用 timestamp 处理重放攻击）
 */
function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = 300 // 5 分钟
): boolean {
  // Stripe 使用特定格式: t=timestamp,v1=signature
  const parts = signature.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = parseInt(timestampPart.split('=')[1], 10);
  const expectedSignature = signaturePart.split('=')[1];

  // 检查时间戳是否在容差范围内
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    console.warn('[Signature] Stripe signature timestamp out of tolerance');
    return false;
  }

  // 计算期望的签名
  const payloadToSign = `${timestamp}.${payload}`;
  const computedSignature = createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex');

  // 安全的字符串比较（防止时序攻击）
  return timingSafeEqual(computedSignature, expectedSignature);
}

/**
 * 安全的字符串比较
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 通用签名验证
 */
function verifyGenericSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256',
  timestamp?: string
): boolean {
  const expectedSignature = generateSignature(payload, secret, algorithm, timestamp);
  return timingSafeEqual(expectedSignature.toLowerCase(), signature.toLowerCase());
}

// ============================================================================
// 验证中间件
// ============================================================================

/**
 * 验证 Webhook 签名
 */
export function verifyWebhookSignature(
  provider: SupportedProvider,
  headers: IncomingHttpHeaders,
  body: unknown
): boolean {
  const config = PROVIDER_CONFIGS[provider];

  if (!config || !config.secret) {
    console.warn(`[Signature] No secret configured for provider: ${provider}`);
    // 在开发环境下，如果未配置密钥，跳过验证
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }

  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const signature = headers[config.signatureHeader] as string | undefined;

  if (!signature) {
    console.warn(`[Signature] Missing signature header for ${provider}`);
    return false;
  }

  const timestamp = config.timestampHeader
    ? (headers[config.timestampHeader] as string | undefined)
    : undefined;

  // 根据提供商使用不同的验证策略
  switch (provider) {
    case 'stripe':
      return verifyStripeSignature(payload, signature, config.secret);

    case 'alipay':
    case 'wechat':
    case 'xpay':
      return verifyGenericSignature(
        payload,
        signature,
        config.secret,
        config.algorithm || 'sha256',
        timestamp
      );

    default:
      return false;
  }
}

/**
 * 生成签名（供测试和调试使用）
 */
export function generateWebhookSignature(
  provider: SupportedProvider,
  payload: string,
  timestamp?: string
): string | null {
  const config = PROVIDER_CONFIGS[provider];

  if (!config || !config.secret) {
    return null;
  }

  if (provider === 'stripe') {
    // Stripe 格式: t=timestamp,v1=signature
    const ts = timestamp || Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', config.secret)
      .update(`${ts}.${payload}`)
      .digest('hex');
    return `t=${ts},v1=${signature}`;
  }

  return generateSignature(
    payload,
    config.secret,
    config.algorithm || 'sha256',
    timestamp
  );
}

/**
 * 验证请求 IP（可选，用于额外验证）
 */
export function isValidWebhookIP(
  provider: SupportedProvider,
  ip: string | undefined
): boolean {
  // 白名单 IP 列表
  const validIPs: Record<SupportedProvider, string[]> = {
    alipay: (process.env.ALIPAY_WEBHOOK_IPS || '')
      .split(',')
      .filter(Boolean),
    wechat: (process.env.WECHAT_WEBHOOK_IPS || '')
      .split(',')
      .filter(Boolean),
    stripe: (process.env.STRIPE_WEBHOOK_IPS || '')
      .split(',')
      .filter(Boolean),
    xpay: (process.env.XPAY_WEBHOOK_IPS || '')
      .split(',')
      .filter(Boolean),
  };

  const providerIPs = validIPs[provider];

  // 如果没有配置白名单，跳过 IP 验证
  if (!providerIPs || providerIPs.length === 0) {
    return true;
  }

  return ip ? providerIPs.includes(ip) : false;
}

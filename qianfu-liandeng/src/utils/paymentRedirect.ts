import { isUrlSafe } from '@/utils/urlValidator';

const allowedPaymentHosts = (import.meta.env.VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS || '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

export const createPaymentIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('当前浏览器无法创建安全的支付请求');
  }
  return globalThis.crypto.randomUUID();
};

export const isTrustedPaymentUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !isUrlSafe(value)) return false;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.origin === window.location.origin) return true;

    const host = parsed.host.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    return allowedPaymentHosts.includes(host) || allowedPaymentHosts.includes(hostname);
  } catch {
    return false;
  }
};

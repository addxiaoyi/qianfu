import { Request } from 'express';
import crypto from 'crypto';

const LOOPBACK_V4 = '127.0.0.1';

const normalizeLoopback = (value: string): string => {
  if (value === 'localhost' || value === '::1' || value === '0:0:0:0:0:0:0:1') {
    return LOOPBACK_V4;
  }
  return value;
};

export const normalizeClientIp = (raw: string | null | undefined): string | null => {
  if (!raw) return null;

  let value = raw.trim().toLowerCase();
  if (!value) return null;

  if (value.startsWith('for=')) {
    value = value.slice(4).trim();
  }

  if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
    value = value.slice(1, -1).trim();
  }

  // RFC7239 can include multiple forwarded entries.
  if (value.includes(',')) {
    value = value.split(',')[0]?.trim() || '';
  }

  // [IPv6]:port -> IPv6
  if (value.startsWith('[') && value.includes(']')) {
    value = value.slice(1, value.indexOf(']')).trim();
  } else {
    // IPv4/hostname:port -> IPv4/hostname
    const firstColon = value.indexOf(':');
    const lastColon = value.lastIndexOf(':');
    if (firstColon > 0 && firstColon === lastColon) {
      const possiblePort = value.slice(lastColon + 1);
      if (/^\d+$/.test(possiblePort)) {
        value = value.slice(0, lastColon).trim();
      }
    }
  }

  if (value.startsWith('::ffff:')) {
    value = value.slice(7);
  }

  const zoneIndex = value.indexOf('%');
  if (zoneIndex > 0) {
    value = value.slice(0, zoneIndex);
  }

  value = normalizeLoopback(value.trim());
  return value || null;
};

const splitAllowlist = (raw: string): string[] =>
  raw
    .split(/[\n,]/g)
    .map((item) => normalizeClientIp(item))
    .filter((item): item is string => Boolean(item));

export const parseNotifyIpAllowlist = (raw?: string): Set<string> => {
  if (!raw?.trim()) {
    return new Set();
  }
  return new Set(splitAllowlist(raw));
};

export const resolveNotifyIpAllowlist = (
  providerRaw?: string,
  globalRaw?: string,
): Set<string> => {
  if (providerRaw?.trim()) {
    return parseNotifyIpAllowlist(providerRaw);
  }
  return parseNotifyIpAllowlist(globalRaw);
};

const firstHeaderValue = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value;
};

export const extractRequestClientIp = (req: Request): string | null => {
  const cfIp = normalizeClientIp(firstHeaderValue(req.headers['cf-connecting-ip']));
  if (cfIp) return cfIp;

  const realIp = normalizeClientIp(firstHeaderValue(req.headers['x-real-ip']));
  if (realIp) return realIp;

  const forwarded = normalizeClientIp(firstHeaderValue(req.headers['x-forwarded-for']));
  if (forwarded) return forwarded;

  const expressIp = normalizeClientIp(req.ip);
  if (expressIp) return expressIp;

  return normalizeClientIp(req.socket?.remoteAddress || null);
};

export const isNotifyIpAllowed = (clientIp: string | null, allowlist: Set<string>): boolean => {
  if (allowlist.size === 0) {
    return true;
  }
  if (!clientIp) {
    return false;
  }
  return allowlist.has(normalizeLoopback(clientIp));
};

const hashReplayFingerprint = (parts: Array<string | number | null | undefined>): string => {
  const raw = parts.map((part) => String(part ?? '').trim()).join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
};

export const buildXpayNotifyReplayKey = (params: {
  mark: string;
  dt: string;
  money: string | number;
  sign: string;
}): string =>
  `payment:notify:replay:xpay:${hashReplayFingerprint([
    params.mark,
    params.dt,
    params.money,
    params.sign.toLowerCase(),
  ])}`;

export const buildPayProNotifyReplayKey = (params: {
  orderNo: string;
  payNum: string;
  amount: string | number;
  sign: string;
}): string =>
  `payment:notify:replay:paypro:${hashReplayFingerprint([
    params.orderNo,
    params.payNum,
    params.amount,
    params.sign.toUpperCase(),
  ])}`;

export const buildQianFuNotifyReplayKey = (params: {
  outTradeNo: string;
  tradeNo?: string;
  payType?: string;
  amount?: string | number;
  money?: string | number;
  dt?: string;
  status?: string;
  payTime?: number;
  sign?: string;
}): string =>
  `payment:notify:replay:qianfu:${hashReplayFingerprint([
    params.outTradeNo,
    params.tradeNo,
    params.payType,
    params.amount ?? params.money,
    params.dt,
    params.status,
    params.payTime,
    params.sign?.toLowerCase(),
  ])}`;

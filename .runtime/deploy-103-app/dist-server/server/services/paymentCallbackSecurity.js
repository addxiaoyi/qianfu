import crypto from 'crypto';
const LOOPBACK_V4 = '127.0.0.1';
const normalizeLoopback = (value) => {
    if (value === 'localhost' || value === '::1' || value === '0:0:0:0:0:0:0:1') {
        return LOOPBACK_V4;
    }
    return value;
};
export const normalizeClientIp = (raw) => {
    if (!raw)
        return null;
    let value = raw.trim().toLowerCase();
    if (!value)
        return null;
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
    }
    else {
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
const splitAllowlist = (raw) => raw
    .split(/[\n,]/g)
    .map((item) => normalizeClientIp(item))
    .filter((item) => Boolean(item));
export const parseNotifyIpAllowlist = (raw) => {
    if (!raw?.trim()) {
        return new Set();
    }
    return new Set(splitAllowlist(raw));
};
export const resolveNotifyIpAllowlist = (providerRaw, globalRaw) => {
    if (providerRaw?.trim()) {
        return parseNotifyIpAllowlist(providerRaw);
    }
    return parseNotifyIpAllowlist(globalRaw);
};
const firstHeaderValue = (value) => {
    if (!value)
        return null;
    if (Array.isArray(value)) {
        return value[0] || null;
    }
    return value;
};
export const extractRequestClientIp = (req) => {
    const cfIp = normalizeClientIp(firstHeaderValue(req.headers['cf-connecting-ip']));
    if (cfIp)
        return cfIp;
    const realIp = normalizeClientIp(firstHeaderValue(req.headers['x-real-ip']));
    if (realIp)
        return realIp;
    const forwarded = normalizeClientIp(firstHeaderValue(req.headers['x-forwarded-for']));
    if (forwarded)
        return forwarded;
    const expressIp = normalizeClientIp(req.ip);
    if (expressIp)
        return expressIp;
    return normalizeClientIp(req.socket?.remoteAddress || null);
};
export const isNotifyIpAllowed = (clientIp, allowlist) => {
    if (allowlist.size === 0) {
        return true;
    }
    if (!clientIp) {
        return false;
    }
    return allowlist.has(normalizeLoopback(clientIp));
};
const hashReplayFingerprint = (parts) => {
    const raw = parts.map((part) => String(part ?? '').trim()).join('|');
    return crypto.createHash('sha256').update(raw).digest('hex');
};
export const buildXpayNotifyReplayKey = (params) => `payment:notify:replay:xpay:${hashReplayFingerprint([
    params.mark,
    params.dt,
    params.money,
    params.sign.toLowerCase(),
])}`;
export const buildXpayTenantNotifyReplayKey = (params) => `payment:notify:replay:xpay-tenant:${hashReplayFingerprint([
    params.tenantKey,
    params.orderId,
    params.outOrderId,
    params.amount,
    params.tradeNo,
    params.timestamp,
    params.nonce,
    params.sign,
])}`;
export const buildPayProNotifyReplayKey = (params) => `payment:notify:replay:paypro:${hashReplayFingerprint([
    params.orderNo,
    params.payNum,
    params.amount,
    params.sign.toUpperCase(),
])}`;
export const buildQianFuNotifyReplayKey = (params) => `payment:notify:replay:qianfu:${hashReplayFingerprint([
    params.outTradeNo,
    params.tradeNo,
    params.payType,
    params.amount ?? params.money,
    params.dt,
    params.status,
    params.payTime,
    params.sign?.toLowerCase(),
])}`;
export const buildTpayNotifyReplayKey = (params) => `payment:notify:replay:tpay:${hashReplayFingerprint([
    params.orderNo,
    params.xddpayOrder,
    params.money,
    params.result,
    params.sign.toUpperCase(),
])}`;
export const buildHupijiaoNotifyReplayKey = (params) => `payment:notify:replay:hupijiao:${hashReplayFingerprint([
    params.tradeOrderId,
    params.transactionId,
    params.totalFee,
    params.status,
    params.hash.toLowerCase(),
])}`;
//# sourceMappingURL=paymentCallbackSecurity.js.map
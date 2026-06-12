import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisService } from '../services/redisService.js';
import { logger } from '../utils/logger.js';
import { logAction } from '../services/auditService.js';
import { buildErrorEnvelope } from '../contracts/responseEnvelope.js';
export const createRateLimiter = (config) => {
    const isRedisEnabled = process.env.REDIS_ENABLED === 'true' && redisService.getStatus();
    const client = redisService.getClient();
    const keyStrategy = config.keyStrategy || 'ip';
    const options = {
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: true,
        legacyHeaders: false,
        passOnStoreError: true,
        validate: false,
        message: config.message || 'Too many requests, please try again later',
        handler: (req, res, next, options) => {
            logger.warn(`[RateLimit] ${req.ip} -> ${req.path} (User: ${req.user?.id || 'anon'})`);
            logger.security(`Rate limit exceeded for ${req.ip} on ${req.path}`, {
                ip: req.ip,
                user: req.user?.id,
                path: req.path,
                requestId: req.requestId,
                userAgent: req.get?.('user-agent') || undefined,
            });
            (async () => {
                try {
                    const uid = req.user?.id ?? null;
                    const rid = req.requestId ?? '';
                    await logAction(uid, 'RATE_LIMIT_HIT', 'route', req, { request_id: rid, path: req.path, ip: req.ip });
                }
                catch (err) {
                    logger.error('Failed to log rate limit hit:', err);
                }
            })();
            res.status(429).json(buildErrorEnvelope({
                message: options.message,
                code: config.errorCode || 'RATE_LIMIT_EXCEEDED',
                statusCode: 429,
                requestId: req.requestId,
            }));
        },
        keyGenerator: (req) => {
            if (keyStrategy === 'userOrIp') {
                const uid = req.user?.id;
                return uid ? `u:${uid}` : `ip:${req.ip}`;
            }
            if (keyStrategy === 'ipAndUser') {
                const uid = req.user?.id || 'anon';
                return `${req.ip}:${uid}`;
            }
            return `ip:${req.ip}`;
        }
    };
    if (isRedisEnabled && client) {
        const redisClient = client;
        options.store = new RedisStore({
            sendCommand: (...args) => redisClient.call(args[0], ...args.slice(1)),
            prefix: config.prefix || 'rl:',
        });
    }
    return rateLimit(options);
};
const isVip = (req) => {
    const role = req.user?.role;
    return role === 'VIP' || role === 'MODERATOR' || role === 'ADMIN';
};
const isGraylisted = (req) => !!req.graylisted;
export const globalLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    prefix: 'rl:global:'
});
export const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 50 : 500,
    message: 'Too many authentication attempts, please try again later',
    prefix: 'rl:auth:',
    keyStrategy: 'userOrIp'
});
export const authBruteForceLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 15 : 120,
    message: 'Too many login attempts, temporarily blocked',
    prefix: 'rl:auth_bruteforce:',
    keyStrategy: 'ip'
});
export const ddosBurstLimiter = createRateLimiter({
    windowMs: 1000,
    max: process.env.NODE_ENV === 'production' ? 80 : 400,
    message: 'Request burst detected, slow down',
    prefix: 'rl:burst:',
    keyStrategy: 'ip'
});
export const csrfLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 200 : 2000,
    message: 'Too many CSRF token requests, please try again later',
    prefix: 'rl:csrf:'
});
export const cmsLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    prefix: 'rl:cms:'
});
export const cmsStrictLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    prefix: 'rl:cms_strict:',
    keyStrategy: 'userOrIp'
});
export const uploadLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: (req) => {
        const base = isVip(req) ? 50 : 20;
        return isGraylisted(req) ? Math.max(5, Math.floor(base / 2)) : base;
    },
    message: 'Uploads too frequent, please try again later',
    prefix: 'rl:upload:',
    keyStrategy: 'userOrIp'
});
export const aiLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: (req) => {
        const base = isVip(req) ? 50 : 10;
        return isGraylisted(req) ? Math.max(3, Math.floor(base / 2)) : base;
    },
    message: 'AI inquiries too frequent, please try again later',
    prefix: 'rl:ai:',
    keyStrategy: 'userOrIp'
});
export const serversLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 120 : 1200, // 2 req/sec average in production
    message: 'Public server list access too frequent, please try again later',
    prefix: 'rl:servers:'
});
export const userLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 450 : 2000, // Increase profile limit further
    message: 'User profile operations too frequent, please try again later',
    prefix: 'rl:user:',
    keyStrategy: 'userOrIp'
});
export const checkinLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 200,
    message: 'Check-in requests too frequent, please try again later',
    errorCode: 'CHECKIN_RATE_LIMITED',
    prefix: 'rl:checkin:',
    keyStrategy: 'userOrIp'
});
export const adminLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 180 : 1200,
    message: 'Admin operations too frequent, please try again later',
    prefix: 'rl:admin:',
    keyStrategy: 'userOrIp'
});
export const ticketLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 50 : 500,
    message: 'Too many ticket requests, please try again later',
    prefix: 'rl:ticket:',
    keyStrategy: 'userOrIp'
});
export const paymentLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 30 : 300,
    message: 'Payment requests too frequent, please try again later',
    prefix: 'rl:payment:',
    keyStrategy: 'userOrIp'
});
export const paymentStatusLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 240 : 2400,
    message: 'Payment status polling too frequent, please try again later',
    prefix: 'rl:payment_status:',
    keyStrategy: 'userOrIp'
});
export const walletLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 50 : 500,
    message: 'Wallet operations too frequent, please try again later',
    prefix: 'rl:wallet:',
    keyStrategy: 'userOrIp'
});
export const notificationLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 180 : 1800, // Increase to 180 per minute (3 per sec)
    message: 'Notification requests too frequent, please try again later',
    prefix: 'rl:notification:',
    keyStrategy: 'userOrIp'
});
export const staticDataLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Static data access too frequent, please try again later',
    prefix: 'rl:static:'
});
export const visitLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 60 : 600,
    message: 'Too many visit requests, please try again later',
    prefix: 'rl:visit:'
});
//# sourceMappingURL=rateLimiter.js.map
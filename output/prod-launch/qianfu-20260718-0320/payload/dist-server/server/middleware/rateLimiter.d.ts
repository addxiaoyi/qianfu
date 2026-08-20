interface RateLimitConfig {
    windowMs: number;
    max: number | ((req: any) => number);
    message?: string;
    errorCode?: string;
    prefix?: string;
    keyStrategy?: 'ip' | 'userOrIp' | 'ipAndUser';
}
export declare const createRateLimiter: (config: RateLimitConfig) => import("express-rate-limit").RateLimitRequestHandler;
export declare const globalLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authBruteForceLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const ddosBurstLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const csrfLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const cmsLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const cmsStrictLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const uploadLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const aiLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const serversLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const userLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const checkinLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const adminLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const ticketLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const paymentLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const paymentStatusLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const walletLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const promoBindingLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const promoClaimLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const notificationLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const staticDataLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const visitLimiter: import("express-rate-limit").RateLimitRequestHandler;
export {};
//# sourceMappingURL=rateLimiter.d.ts.map
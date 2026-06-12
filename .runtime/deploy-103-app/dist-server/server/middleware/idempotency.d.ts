import type { RequestHandler } from 'express';
interface DuplicateGuardOptions {
    ttlSeconds?: number;
    keyPrefix?: string;
    includeBody?: boolean;
}
interface IdempotencyOptions {
    ttlSeconds?: number;
    lockTtlSeconds?: number;
    keyPrefix?: string;
    requireHeader?: boolean;
}
export declare function createDuplicateRequestGuard(options?: DuplicateGuardOptions): RequestHandler;
export declare function createIdempotencyMiddleware(options?: IdempotencyOptions): RequestHandler;
export {};
//# sourceMappingURL=idempotency.d.ts.map
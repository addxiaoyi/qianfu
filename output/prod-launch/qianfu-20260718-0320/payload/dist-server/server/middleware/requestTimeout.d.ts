import type { RequestHandler } from 'express';
interface RequestTimeoutOptions {
    timeoutMs?: number;
    excludePaths?: string[];
}
export declare function createRequestTimeoutMiddleware(options?: RequestTimeoutOptions): RequestHandler;
export {};
//# sourceMappingURL=requestTimeout.d.ts.map
import type { Request } from 'express';
export interface ApiErrorPayload {
    message: string;
    code: string;
    statusCode: number;
    requestId?: string;
    details?: unknown;
}
export interface ApiSuccessEnvelope<T> {
    success: true;
    message: string;
    data: T;
    requestId?: string;
    timestamp: string;
    meta?: Record<string, unknown>;
}
export interface ApiErrorEnvelope {
    success: false;
    error: ApiErrorPayload;
    timestamp: string;
}
export declare function getRequestId(req?: Request): string | undefined;
export declare function buildSuccessEnvelope<T>(data: T, message?: string, requestId?: string, meta?: Record<string, unknown>): ApiSuccessEnvelope<T>;
export declare function buildErrorEnvelope(input: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    requestId?: string;
}): ApiErrorEnvelope;
//# sourceMappingURL=responseEnvelope.d.ts.map
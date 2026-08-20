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
/**
 * Generate a request ID from a header, or fall back to a random string.
 */
export declare function getRequestId(reqHeader?: string | string[] | undefined): string;
export declare function buildSuccessEnvelope<T>(data: T, message?: string, requestId?: string, meta?: Record<string, unknown>): ApiSuccessEnvelope<T>;
export declare function buildErrorEnvelope(input: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    requestId?: string;
}): ApiErrorEnvelope;
export type SuccessResponse<T = unknown> = ApiSuccessEnvelope<T>;
export type ApiResponse<T = unknown> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
export type PaginatedData<T = unknown> = {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};
export type PaginatedResponse<T = unknown> = ApiSuccessEnvelope<PaginatedData<T>>;
//# sourceMappingURL=responseEnvelope.d.ts.map
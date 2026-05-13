/**
 * Standard Success Response envelope
 * Returns a plain object ready to be JSON-stringified by the caller.
 */
export declare function successResponse<T>(data: T, message?: string, meta?: Record<string, unknown>): Record<string, unknown>;
/**
 * Paginated Success Response envelope
 */
export declare function paginatedResponse<T>(data: T[], total: number, page: number, limit: number, message?: string): Record<string, unknown>;
//# sourceMappingURL=response.d.ts.map
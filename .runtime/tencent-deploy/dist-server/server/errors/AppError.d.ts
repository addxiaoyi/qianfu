import { AppError, ErrorCode, createError, handleError, logError, getStatusCodeForErrorCode } from '../utils/errors';
export { AppError, ErrorCode, createError, handleError, logError, getStatusCodeForErrorCode };
export declare class NotFoundError extends AppError {
    constructor(message?: string, details?: unknown);
}
export declare class ConflictError extends AppError {
    constructor(message?: string, details?: unknown);
}
export declare class ValidationError extends AppError {
    constructor(message?: string, details?: Array<{
        field: string;
        message: string;
    }> | Record<string, unknown>);
}
//# sourceMappingURL=AppError.d.ts.map
import { AppError as SharedAppError, ErrorFactory, isOperationalError } from '@qianfu/shared';
export { ErrorFactory, isOperationalError };
export declare enum ErrorCode {
    BAD_REQUEST = "BAD_REQUEST",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    NOT_FOUND = "NOT_FOUND",
    CONFLICT = "CONFLICT",
    UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    TOKEN_INVALID = "TOKEN_INVALID",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    PAYMENT_FAILED = "PAYMENT_FAILED",
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
    INVALID_OPERATION = "INVALID_OPERATION",
    RATE_LIMITED = "RATE_LIMITED",
    DATABASE_ERROR = "DATABASE_ERROR",
    UNIQUE_CONSTRAINT_VIOLATION = "UNIQUE_CONSTRAINT_VIOLATION",
    FOREIGN_KEY_CONSTRAINT_VIOLATION = "FOREIGN_KEY_CONSTRAINT_VIOLATION",
    FILE_UPLOAD_ERROR = "FILE_UPLOAD_ERROR",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    FILE_SIZE_EXCEEDED = "FILE_SIZE_EXCEEDED",
    NETWORK_ERROR = "NETWORK_ERROR",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    PAYMENT_REQUIRED = "PAYMENT_REQUIRED",
    INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
    INVALID_PAYMENT_METHOD = "INVALID_PAYMENT_METHOD",
    TRANSACTION_NOT_FOUND = "TRANSACTION_NOT_FOUND",
    SESSION_EXPIRED = "SESSION_EXPIRED",
    LIMIT_EXCEEDED = "LIMIT_EXCEEDED",
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
    EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED",
    INVALID_INPUT = "INVALID_INPUT",
    RESOURCE_CONFLICT = "RESOURCE_CONFLICT"
}
export declare class AppError extends SharedAppError {
    readonly details?: Record<string, unknown>;
    constructor(message: string, statusCode?: number, errorCode?: ErrorCode, isOperational?: boolean, details?: unknown);
}
export interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code: ErrorCode;
        statusCode: number;
        details?: unknown;
        timestamp: string;
    };
}
export declare function createErrorResponse(error: SharedAppError | Error, includeDetails?: boolean): ErrorResponse;
export declare const createError: {
    unauthorized: (message?: string) => import("@qianfu/shared/errors").UnauthorizedError;
    forbidden: (message?: string) => import("@qianfu/shared/errors").ForbiddenError;
    validation: (message?: string, details?: Record<string, string>) => AppError;
    invalidInput: (message?: string) => AppError;
    notFound: (message?: string) => import("@qianfu/shared/errors").NotFoundError;
    conflict: (message?: string) => import("@qianfu/shared/errors").ConflictError;
    invalidOperation: (message?: string) => AppError;
    internal: (message?: string) => AppError;
    database: (message?: string) => AppError;
    fileUpload: (message?: string) => AppError;
    fileNotFound: (message?: string) => AppError;
    rateLimit: (retryAfter?: number) => import("@qianfu/shared").RateLimitError;
    payment: (message: string) => import("@qianfu/shared/errors").PaymentError;
    insufficientBalance: () => import("@qianfu/shared/errors").InsufficientBalanceError;
};
export declare function handleError(error: unknown): AppError;
export declare function logError(error: SharedAppError | Error, context?: unknown): void;
export declare function getStatusCodeForErrorCode(errorCode: ErrorCode): number;
//# sourceMappingURL=errors.d.ts.map
/**
 * QianFu Shared Errors
 * Unified error handling across all microservices
 */
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
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE"
}
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: ErrorCode;
    readonly isOperational: boolean;
    readonly errors?: Array<{
        field: string;
        message: string;
    }>;
    readonly details?: Record<string, unknown>;
    constructor(message: string, statusCode?: number, code?: ErrorCode, isOperational?: boolean, errors?: Array<{
        field: string;
        message: string;
    }>, details?: Record<string, unknown>);
    toJSON(): {
        error: {
            errors?: {
                field: string;
                message: string;
            }[] | undefined;
            message: string;
            code: ErrorCode;
        };
    };
}
export declare class ValidationError extends AppError {
    constructor(message: string, errors?: Array<{
        field: string;
        message: string;
    }>);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, id?: string | number);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class RateLimitError extends AppError {
    constructor(retryAfter?: number);
    readonly retryAfter?: number;
}
export declare class PaymentError extends AppError {
    constructor(message: string);
}
export declare class InsufficientBalanceError extends AppError {
    constructor();
}
/**
 * Error factory for common scenarios
 */
export declare const ErrorFactory: {
    notFound: (resource: string, id?: string | number) => NotFoundError;
    unauthorized: (message?: string) => UnauthorizedError;
    forbidden: (message?: string) => ForbiddenError;
    validation: (message: string, errors?: Array<{
        field: string;
        message: string;
    }>) => ValidationError;
    conflict: (message: string) => ConflictError;
    rateLimit: (retryAfter?: number) => RateLimitError;
    payment: (message: string) => PaymentError;
    insufficientBalance: () => InsufficientBalanceError;
};
/**
 * Check if error is operational (expected) or programming error
 */
export declare function isOperationalError(error: unknown): boolean;
/**
 * AppError options interface
 */
export interface AppErrorOptions {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
    isOperational?: boolean;
    stack?: string;
}
//# sourceMappingURL=index.d.ts.map
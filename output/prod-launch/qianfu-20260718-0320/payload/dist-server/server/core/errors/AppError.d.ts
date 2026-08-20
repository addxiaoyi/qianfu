/**
 * 应用错误基类
 * 提供统一的错误处理机制
 */
export interface ErrorDetails {
    field?: string;
    message: string;
    code?: string;
}
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: ErrorDetails[];
    readonly isOperational: boolean;
    constructor(message: string, statusCode?: number, code?: string, details?: ErrorDetails[], isOperational?: boolean);
    toJSON(): {
        success: boolean;
        error: {
            code: string;
            message: string;
            details: ErrorDetails[] | undefined;
        };
    };
}
export declare class ValidationError extends AppError {
    constructor(message?: string, details?: ErrorDetails[]);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
export declare class ExternalServiceError extends AppError {
    constructor(service?: string);
}
export declare enum ErrorCode {
    NOT_FOUND = "NOT_FOUND",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
    CONFLICT_ERROR = "CONFLICT_ERROR",
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    PAYMENT_ERROR = "PAYMENT_ERROR",
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
export interface ErrorContext {
    [key: string]: unknown;
}
export declare class PaymentError extends AppError {
    constructor(message: string, context?: ErrorContext);
}
export declare class InsufficientBalanceError extends AppError {
    constructor(message?: string);
}
export declare function createError(message: string, statusCode?: number, code?: ErrorCode): AppError;
export declare function handleError(error: unknown): AppError;
export declare function createErrorContext(context: Record<string, unknown>): ErrorContext;
export declare function getStatusCodeForErrorCode(code: string | ErrorCode): number;
export declare function isKnownBusinessError(error: unknown): boolean;
//# sourceMappingURL=AppError.d.ts.map
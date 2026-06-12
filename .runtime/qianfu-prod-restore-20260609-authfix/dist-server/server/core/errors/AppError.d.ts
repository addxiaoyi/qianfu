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
//# sourceMappingURL=AppError.d.ts.map
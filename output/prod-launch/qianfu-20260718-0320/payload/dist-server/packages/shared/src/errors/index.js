/**
 * QianFu Shared Errors
 * Unified error handling across all microservices
 */
export var ErrorCode;
(function (ErrorCode) {
    // 4xx Client Errors
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["UNPROCESSABLE_ENTITY"] = "UNPROCESSABLE_ENTITY";
    ErrorCode["TOO_MANY_REQUESTS"] = "TOO_MANY_REQUESTS";
    // 5xx Server Errors
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["GATEWAY_TIMEOUT"] = "GATEWAY_TIMEOUT";
    // Business Errors
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["RESOURCE_ALREADY_EXISTS"] = "RESOURCE_ALREADY_EXISTS";
    ErrorCode["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["TOKEN_INVALID"] = "TOKEN_INVALID";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ErrorCode["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    ErrorCode["INSUFFICIENT_BALANCE"] = "INSUFFICIENT_BALANCE";
    // Additional common error codes for server extension
    // These are not in shared but may be used by consuming packages
    // Note: Add additional codes here as needed
})(ErrorCode || (ErrorCode = {}));
export class AppError extends Error {
    statusCode;
    code;
    isOperational;
    errors;
    details;
    constructor(message, statusCode = 500, code = ErrorCode.INTERNAL_ERROR, isOperational = true, errors, details) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.errors = errors;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            error: {
                message: this.message,
                code: this.code,
                ...(this.errors && { errors: this.errors }),
            },
        };
    }
}
export class ValidationError extends AppError {
    constructor(message, errors) {
        super(message, 400, ErrorCode.VALIDATION_ERROR, true, errors);
    }
}
export class NotFoundError extends AppError {
    constructor(resource, id) {
        const message = id
            ? `${resource} with id ${id} not found`
            : `${resource} not found`;
        super(message, 404, ErrorCode.RESOURCE_NOT_FOUND);
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, ErrorCode.UNAUTHORIZED);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Permission denied') {
        super(message, 403, ErrorCode.FORBIDDEN);
    }
}
export class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, ErrorCode.CONFLICT);
    }
}
export class RateLimitError extends AppError {
    constructor(retryAfter) {
        super('Too many requests', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
        this.retryAfter = retryAfter;
    }
    retryAfter;
}
export class PaymentError extends AppError {
    constructor(message) {
        super(message, 402, ErrorCode.PAYMENT_FAILED);
    }
}
export class InsufficientBalanceError extends AppError {
    constructor() {
        super('Insufficient balance', 402, ErrorCode.INSUFFICIENT_BALANCE);
    }
}
/**
 * Error factory for common scenarios
 */
export const ErrorFactory = {
    notFound: (resource, id) => new NotFoundError(resource, id),
    unauthorized: (message) => new UnauthorizedError(message),
    forbidden: (message) => new ForbiddenError(message),
    validation: (message, errors) => new ValidationError(message, errors),
    conflict: (message) => new ConflictError(message),
    rateLimit: (retryAfter) => new RateLimitError(retryAfter),
    payment: (message) => new PaymentError(message),
    insufficientBalance: () => new InsufficientBalanceError(),
};
/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error) {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}
//# sourceMappingURL=index.js.map
// Error handling utility module
// Now using @qianfu/shared for core error classes
import { AppError as SharedAppError, ErrorFactory, isOperationalError } from '@qianfu/shared';
import { logger } from './logger';
// Re-export shared error classes and utilities
export { ErrorFactory, isOperationalError };
// Extended ErrorCode enum - includes all shared codes plus server-specific codes
export var ErrorCode;
(function (ErrorCode) {
    // Re-export shared error codes
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["UNPROCESSABLE_ENTITY"] = "UNPROCESSABLE_ENTITY";
    ErrorCode["TOO_MANY_REQUESTS"] = "TOO_MANY_REQUESTS";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["GATEWAY_TIMEOUT"] = "GATEWAY_TIMEOUT";
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
    // Additional server-specific error codes
    // General Errors
    ErrorCode["INVALID_OPERATION"] = "INVALID_OPERATION";
    // Rate Limiting (custom code for specific use cases)
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    // Database Errors
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["UNIQUE_CONSTRAINT_VIOLATION"] = "UNIQUE_CONSTRAINT_VIOLATION";
    ErrorCode["FOREIGN_KEY_CONSTRAINT_VIOLATION"] = "FOREIGN_KEY_CONSTRAINT_VIOLATION";
    // File Errors
    ErrorCode["FILE_UPLOAD_ERROR"] = "FILE_UPLOAD_ERROR";
    ErrorCode["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
    ErrorCode["FILE_SIZE_EXCEEDED"] = "FILE_SIZE_EXCEEDED";
    // Network Errors
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    // Payment Errors
    ErrorCode["PAYMENT_REQUIRED"] = "PAYMENT_REQUIRED";
    ErrorCode["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
    ErrorCode["INVALID_PAYMENT_METHOD"] = "INVALID_PAYMENT_METHOD";
    ErrorCode["TRANSACTION_NOT_FOUND"] = "TRANSACTION_NOT_FOUND";
    // Session/Rate Limit Errors
    ErrorCode["SESSION_EXPIRED"] = "SESSION_EXPIRED";
    ErrorCode["LIMIT_EXCEEDED"] = "LIMIT_EXCEEDED";
    // Auth Errors
    ErrorCode["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    ErrorCode["EMAIL_NOT_VERIFIED"] = "EMAIL_NOT_VERIFIED";
    // Business Errors
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["RESOURCE_CONFLICT"] = "RESOURCE_CONFLICT";
})(ErrorCode || (ErrorCode = {}));
// Re-export AppError from shared
export class AppError extends SharedAppError {
    // Additional server-specific properties
    details;
    constructor(message, statusCode = 500, errorCode = ErrorCode.INTERNAL_ERROR, isOperational = true, details) {
        // Build structured errors for parent when details look like key-value pairs.
        const errors = details && typeof details === 'object' && !Array.isArray(details)
            ? Object.entries(details).map(([field, message]) => ({
                field,
                message: String(message),
            }))
            : undefined;
        super(message, statusCode, errorCode, isOperational, errors);
        // Set additional properties
        this.details =
            details && typeof details === 'object' && !Array.isArray(details)
                ? details
                : undefined;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
// Create standard error response
export function createErrorResponse(error, includeDetails = false) {
    if (error instanceof SharedAppError) {
        return {
            success: false,
            error: {
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
                details: includeDetails ? error.errors || error.details : undefined,
                timestamp: new Date().toISOString()
            }
        };
    }
    return {
        success: false,
        error: {
            message: error.message || 'Internal server error',
            code: ErrorCode.INTERNAL_ERROR,
            statusCode: 500,
            timestamp: new Date().toISOString()
        }
    };
}
// Error factory functions - maintains backward compatibility
export const createError = {
    unauthorized: (message = 'Authentication required') => ErrorFactory.unauthorized(message),
    forbidden: (message = 'Access denied') => ErrorFactory.forbidden(message),
    validation: (message = 'Validation failed', details) => new AppError(message, 400, ErrorCode.VALIDATION_ERROR, true, details),
    invalidInput: (message = 'Invalid input') => new AppError(message, 400, ErrorCode.INVALID_INPUT),
    notFound: (message = 'Resource not found') => ErrorFactory.notFound('Resource', message),
    conflict: (message = 'Resource conflict') => ErrorFactory.conflict(message),
    invalidOperation: (message = 'Invalid operation') => new AppError(message, 400, ErrorCode.INVALID_OPERATION),
    internal: (message = 'Internal server error') => new AppError(message, 500, ErrorCode.INTERNAL_ERROR),
    database: (message = 'Database error') => new AppError(message, 500, ErrorCode.DATABASE_ERROR),
    fileUpload: (message = 'File upload failed') => new AppError(message, 400, ErrorCode.FILE_UPLOAD_ERROR),
    fileNotFound: (message = 'File not found') => new AppError(message, 404, ErrorCode.FILE_NOT_FOUND),
    rateLimit: (retryAfter) => ErrorFactory.rateLimit(retryAfter),
    payment: (message) => ErrorFactory.payment(message),
    insufficientBalance: () => ErrorFactory.insufficientBalance(),
};
// Error handler middleware helper
export function handleError(error) {
    if (isOperationalError(error)) {
        return error;
    }
    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
        const code = error.code;
        switch (code) {
            case 'P2002':
                return createError.conflict('Resource already exists');
            case 'P2003':
                return createError.validation('Related resource does not exist');
            case 'P2025':
                return createError.notFound('Resource not found');
            default:
                return createError.database('Database operation failed');
        }
    }
    if (error && typeof error === 'object' && 'name' in error) {
        const name = error.name;
        if (name === 'ValidationError') {
            const err = error;
            return createError.validation(err.message || 'Validation failed');
        }
        if (name === 'JsonWebTokenError') {
            return createError.unauthorized('Invalid authentication token');
        }
        if (name === 'TokenExpiredError') {
            return createError.unauthorized('Authentication token expired');
        }
    }
    const message = error && typeof error === 'object' && 'message' in error
        ? error.message
        : 'Unknown error';
    return createError.internal(message);
}
// Error logging utility
export function logError(error, context) {
    const timestamp = new Date().toISOString();
    const errorInfo = error instanceof SharedAppError ? {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        operational: error.isOperational
    } : {
        message: error.message,
        name: error.name,
        stack: error.stack
    };
    const meta = context && typeof context === 'object'
        ? { ...errorInfo, ...context, timestamp }
        : { ...errorInfo, context, timestamp };
    logger.error(`[${timestamp}] Error occurred:`, meta);
}
// Error code to HTTP status code mapping
export function getStatusCodeForErrorCode(errorCode) {
    const statusCodeMap = {
        // 4xx Client Errors
        [ErrorCode.BAD_REQUEST]: 400,
        [ErrorCode.UNAUTHORIZED]: 401,
        [ErrorCode.FORBIDDEN]: 403,
        [ErrorCode.NOT_FOUND]: 404,
        [ErrorCode.CONFLICT]: 409,
        [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
        [ErrorCode.TOO_MANY_REQUESTS]: 429,
        // 5xx Server Errors
        [ErrorCode.INTERNAL_ERROR]: 500,
        [ErrorCode.SERVICE_UNAVAILABLE]: 503,
        [ErrorCode.GATEWAY_TIMEOUT]: 504,
        // Business Errors
        [ErrorCode.VALIDATION_ERROR]: 400,
        [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
        [ErrorCode.RESOURCE_NOT_FOUND]: 404,
        [ErrorCode.INVALID_CREDENTIALS]: 401,
        [ErrorCode.TOKEN_EXPIRED]: 401,
        [ErrorCode.TOKEN_INVALID]: 401,
        [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
        [ErrorCode.RATE_LIMITED]: 429,
        [ErrorCode.PERMISSION_DENIED]: 403,
        [ErrorCode.PAYMENT_FAILED]: 402,
        [ErrorCode.INSUFFICIENT_BALANCE]: 402,
        // Additional server-specific mappings
        [ErrorCode.INVALID_OPERATION]: 400,
        [ErrorCode.DATABASE_ERROR]: 500,
        [ErrorCode.UNIQUE_CONSTRAINT_VIOLATION]: 409,
        [ErrorCode.FOREIGN_KEY_CONSTRAINT_VIOLATION]: 400,
        [ErrorCode.FILE_UPLOAD_ERROR]: 400,
        [ErrorCode.FILE_NOT_FOUND]: 404,
        [ErrorCode.FILE_SIZE_EXCEEDED]: 413,
        [ErrorCode.NETWORK_ERROR]: 503,
        [ErrorCode.TIMEOUT_ERROR]: 408,
        [ErrorCode.SESSION_EXPIRED]: 401,
        [ErrorCode.PAYMENT_REQUIRED]: 402,
        [ErrorCode.INSUFFICIENT_FUNDS]: 402,
        [ErrorCode.INVALID_PAYMENT_METHOD]: 400,
        [ErrorCode.TRANSACTION_NOT_FOUND]: 404,
        [ErrorCode.LIMIT_EXCEEDED]: 429,
        [ErrorCode.AUTHENTICATION_FAILED]: 401,
        [ErrorCode.INVALID_INPUT]: 400,
        [ErrorCode.RESOURCE_CONFLICT]: 409,
    };
    return statusCodeMap[errorCode] || 500;
}
//# sourceMappingURL=errors.js.map
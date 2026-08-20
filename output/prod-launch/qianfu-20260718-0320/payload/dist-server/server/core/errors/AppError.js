/**
 * 应用错误基类
 * 提供统一的错误处理机制
 */
export class AppError extends Error {
    statusCode;
    code;
    details;
    isOperational;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                details: this.details,
            },
        };
    }
}
// ============================================
// 具体错误类型
// ============================================
export class ValidationError extends AppError {
    constructor(message = '验证失败', details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}
export class AuthenticationError extends AppError {
    constructor(message = '认证失败') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}
export class AuthorizationError extends AppError {
    constructor(message = '权限不足') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}
export class NotFoundError extends AppError {
    constructor(resource = '资源') {
        super(`${resource}不存在`, 404, 'NOT_FOUND_ERROR');
    }
}
export class ConflictError extends AppError {
    constructor(message = '资源冲突') {
        super(message, 409, 'CONFLICT_ERROR');
    }
}
export class RateLimitError extends AppError {
    constructor(message = '请求过于频繁') {
        super(message, 429, 'RATE_LIMIT_ERROR');
    }
}
export class ExternalServiceError extends AppError {
    constructor(service = '外部服务') {
        super(`${service}调用失败`, 502, 'EXTERNAL_SERVICE_ERROR');
    }
}
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    ErrorCode["AUTHORIZATION_ERROR"] = "AUTHORIZATION_ERROR";
    ErrorCode["CONFLICT_ERROR"] = "CONFLICT_ERROR";
    ErrorCode["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["PAYMENT_ERROR"] = "PAYMENT_ERROR";
    ErrorCode["INSUFFICIENT_BALANCE"] = "INSUFFICIENT_BALANCE";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ErrorCode || (ErrorCode = {}));
export class PaymentError extends AppError {
    constructor(message, context) {
        super(message, 400, ErrorCode.PAYMENT_ERROR);
    }
}
export class InsufficientBalanceError extends AppError {
    constructor(message = 'Insufficient balance') {
        super(message, 400, ErrorCode.INSUFFICIENT_BALANCE);
    }
}
export function createError(message, statusCode = 500, code) {
    return new AppError(message, statusCode, code);
}
export function handleError(error) {
    if (error instanceof AppError)
        return error;
    if (error instanceof Error)
        return new AppError(error.message, 500, ErrorCode.INTERNAL_ERROR);
    return new AppError('Unknown error', 500, ErrorCode.INTERNAL_ERROR);
}
export function createErrorContext(context) {
    return { ...context };
}
export function getStatusCodeForErrorCode(code) {
    const map = {
        [ErrorCode.NOT_FOUND]: 404,
        [ErrorCode.VALIDATION_ERROR]: 400,
        [ErrorCode.AUTHENTICATION_ERROR]: 401,
        [ErrorCode.AUTHORIZATION_ERROR]: 403,
        [ErrorCode.CONFLICT_ERROR]: 409,
        [ErrorCode.RATE_LIMIT_ERROR]: 429,
        [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
        [ErrorCode.PAYMENT_ERROR]: 400,
        [ErrorCode.INSUFFICIENT_BALANCE]: 400,
        [ErrorCode.INTERNAL_ERROR]: 500,
    };
    return map[code] || 500;
}
export function isKnownBusinessError(error) {
    return error instanceof AppError;
}
//# sourceMappingURL=AppError.js.map
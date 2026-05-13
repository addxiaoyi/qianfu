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
//# sourceMappingURL=AppError.js.map
import { AppError, ErrorCode } from '../utils/errors';
import { maskData } from '../utils/masking';
import { logger } from '../utils/logger';
import { buildErrorEnvelope } from '../contracts/responseEnvelope';
export { AppError, ErrorCode };
export const errorHandler = (err, req, res, _next) => {
    const appError = err;
    let statusCode = appError.statusCode || 500;
    let message = appError.message || 'Internal Server Error';
    let code = appError.errorCode || ErrorCode.INTERNAL_ERROR;
    let details = appError.details || null;
    if (appError.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Failed';
        code = ErrorCode.VALIDATION_ERROR;
        details = appError.errors || appError.details;
    }
    else if (appError.code === 'EBADCSRFTOKEN') {
        statusCode = 403;
        message = 'Invalid CSRF token';
        code = ErrorCode.FORBIDDEN;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const displayMessage = isProduction && statusCode >= 500
        ? 'An unexpected error occurred'
        : message;
    const safeDetails = isProduction ? (statusCode >= 500 ? null : maskData(details)) : details;
    const requestId = req.requestId;
    // 使用统一 logger 记录错误
    if (statusCode >= 500 || !isProduction) {
        logger.error(`[Error] ${statusCode} - ${message}`, {
            url: req.originalUrl,
            method: req.method,
            code,
            requestId,
            details: isProduction ? (statusCode >= 500 ? undefined : safeDetails) : details,
            stack: isProduction ? undefined : err.stack
        });
    }
    res.status(statusCode).json(buildErrorEnvelope({
        message: displayMessage,
        code,
        statusCode,
        details: safeDetails,
        requestId,
    }));
};
//# sourceMappingURL=error.js.map
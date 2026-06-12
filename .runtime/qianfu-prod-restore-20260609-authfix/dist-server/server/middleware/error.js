import { AppError, ErrorCode } from '../utils/errors.js';
import { maskData } from '../utils/masking.js';
import { logger } from '../utils/logger.js';
import { buildErrorEnvelope } from '../contracts/responseEnvelope.js';
export { AppError, ErrorCode };
export const errorHandler = (err, req, res, _next) => {
    const appError = err;
    let statusCode = appError.statusCode || 500;
    let message = appError.message || 'Internal Server Error';
    let code = appError.errorCode || appError.code || ErrorCode.INTERNAL_ERROR;
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
    if (statusCode >= 500 &&
        code === ErrorCode.INTERNAL_ERROR &&
        typeof message === 'string' &&
        (message.includes('create order failed') ||
            message.includes('QiuPay create order failed') ||
            message.includes('Tpay create order failed') ||
            message.includes('HuPiJiao create order failed') ||
            message.includes('Creem create checkout failed') ||
            message.includes('XPay tenant create order failed'))) {
        code = ErrorCode.PAYMENT_FAILED;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const preserveBusinessFailureMessage = code === ErrorCode.PAYMENT_FAILED ||
        code === ErrorCode.SERVICE_UNAVAILABLE ||
        code === ErrorCode.GATEWAY_TIMEOUT;
    const displayMessage = isProduction && statusCode >= 500 && !preserveBusinessFailureMessage
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
/**
 * 统一错误码导出
 *
 * 所有错误码应从此文件导入，确保一致性
 *
 * @example
 * ```typescript
 * import { ErrorCode } from '../core/errors';
 * import { AppError } from '../core/errors';
 *
 * throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
 * ```
 */
// Re-export all error-related types and utilities
export { AppError, ErrorCode, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, RateLimitError, ExternalServiceError, PaymentError, InsufficientBalanceError, createError, handleError, createErrorContext, getStatusCodeForErrorCode, isKnownBusinessError, } from './AppError';
// Re-export error handling middleware
export { errorHandler, asyncHandler, syncHandler, notFoundHandler, } from '../middleware/errorHandler';
//# sourceMappingURL=index.js.map
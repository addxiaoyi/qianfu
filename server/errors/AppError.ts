import { AppError, ErrorCode, createError, handleError, logError, getStatusCodeForErrorCode } from '../utils/errors';

export { AppError, ErrorCode, createError, handleError, logError, getStatusCodeForErrorCode };

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, ErrorCode.NOT_FOUND, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(message, 409, ErrorCode.CONFLICT, true, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    details?: Array<{ field: string; message: string }> | Record<string, unknown>
  ) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, details);
  }
}

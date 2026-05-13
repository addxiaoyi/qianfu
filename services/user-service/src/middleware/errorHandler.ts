/**
 * Error Handler Middleware
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError, ErrorCode, isOperationalError } from '@qianfu/shared';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  // Log error
  if (isOperationalError(err)) {
    logger.warn(`[ErrorHandler] ${requestId} - ${err.message}`, {
      code: err instanceof AppError ? err.code : ErrorCode.INTERNAL_ERROR,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error(`[ErrorHandler] ${requestId} - Unexpected error:`, {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Handle AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        ...(err.errors && { errors: err.errors }),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle unknown errors
  const statusCode = isOperationalError(err) ? 400 : 500;
  const message = isOperationalError(err) ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: {
      message,
      code: ErrorCode.INTERNAL_ERROR,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

// Async wrapper to catch errors in async route handlers
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error handling utility module
// Now using @qianfu/shared for core error classes
import { 
  AppError as SharedAppError, 
  ErrorCode as SharedErrorCode,
  ErrorFactory,
  isOperationalError
} from '@qianfu/shared';
import { logger } from './logger';

// Re-export shared error classes and utilities
export { ErrorFactory, isOperationalError };

// Extended ErrorCode enum - includes all shared codes plus server-specific codes
export enum ErrorCode {
  // Re-export shared error codes
  BAD_REQUEST = SharedErrorCode.BAD_REQUEST,
  UNAUTHORIZED = SharedErrorCode.UNAUTHORIZED,
  FORBIDDEN = SharedErrorCode.FORBIDDEN,
  NOT_FOUND = SharedErrorCode.NOT_FOUND,
  CONFLICT = SharedErrorCode.CONFLICT,
  UNPROCESSABLE_ENTITY = SharedErrorCode.UNPROCESSABLE_ENTITY,
  TOO_MANY_REQUESTS = SharedErrorCode.TOO_MANY_REQUESTS,
  INTERNAL_ERROR = SharedErrorCode.INTERNAL_ERROR,
  SERVICE_UNAVAILABLE = SharedErrorCode.SERVICE_UNAVAILABLE,
  GATEWAY_TIMEOUT = SharedErrorCode.GATEWAY_TIMEOUT,
  VALIDATION_ERROR = SharedErrorCode.VALIDATION_ERROR,
  RESOURCE_ALREADY_EXISTS = SharedErrorCode.RESOURCE_ALREADY_EXISTS,
  RESOURCE_NOT_FOUND = SharedErrorCode.RESOURCE_NOT_FOUND,
  INVALID_CREDENTIALS = SharedErrorCode.INVALID_CREDENTIALS,
  TOKEN_EXPIRED = SharedErrorCode.TOKEN_EXPIRED,
  TOKEN_INVALID = SharedErrorCode.TOKEN_INVALID,
  RATE_LIMIT_EXCEEDED = SharedErrorCode.RATE_LIMIT_EXCEEDED,
  PERMISSION_DENIED = SharedErrorCode.PERMISSION_DENIED,
  PAYMENT_FAILED = SharedErrorCode.PAYMENT_FAILED,
  INSUFFICIENT_BALANCE = SharedErrorCode.INSUFFICIENT_BALANCE,

  // Additional server-specific error codes
  // General Errors
  INVALID_OPERATION = 'INVALID_OPERATION',
  
  // Rate Limiting (custom code for specific use cases)
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNIQUE_CONSTRAINT_VIOLATION = 'UNIQUE_CONSTRAINT_VIOLATION',
  FOREIGN_KEY_CONSTRAINT_VIOLATION = 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
  
  // File Errors
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_SIZE_EXCEEDED = 'FILE_SIZE_EXCEEDED',
  
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Payment Errors
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_PAYMENT_METHOD = 'INVALID_PAYMENT_METHOD',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  
  // Session/Rate Limit Errors
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  
  // Auth Errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  
  // Business Errors
  INVALID_INPUT = 'INVALID_INPUT',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
}

// Re-export AppError from shared
export class AppError extends SharedAppError {
  // Additional server-specific properties
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
    isOperational: boolean = true,
    details?: unknown
  ) {
    // Build structured errors for parent when details look like key-value pairs.
    const errors =
      details && typeof details === 'object' && !Array.isArray(details)
        ? Object.entries(details as Record<string, unknown>).map(([field, message]) => ({
            field,
            message: String(message),
          }))
        : undefined;
    
    super(message, statusCode, errorCode as any, isOperational, errors);
    
    // Set additional properties
    this.details =
      details && typeof details === 'object' && !Array.isArray(details)
        ? (details as Record<string, unknown>)
        : undefined;
    
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: ErrorCode;
    statusCode: number;
    details?: unknown;
    timestamp: string;
  };
}

// Create standard error response
export function createErrorResponse(
  error: SharedAppError | Error,
  includeDetails: boolean = false
): ErrorResponse {
  if (error instanceof SharedAppError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code as ErrorCode,
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
  unauthorized: (message: string = 'Authentication required') => 
    ErrorFactory.unauthorized(message),
  
  forbidden: (message: string = 'Access denied') => 
    ErrorFactory.forbidden(message),
  
  validation: (message: string = 'Validation failed', details?: Record<string, string>) => 
    new AppError(message, 400, ErrorCode.VALIDATION_ERROR, true, details),
  
  invalidInput: (message: string = 'Invalid input') => 
    new AppError(message, 400, ErrorCode.INVALID_INPUT),
  
  notFound: (message: string = 'Resource not found') => 
    ErrorFactory.notFound('Resource', message),
  
  conflict: (message: string = 'Resource conflict') => 
    ErrorFactory.conflict(message),
  
  invalidOperation: (message: string = 'Invalid operation') => 
    new AppError(message, 400, ErrorCode.INVALID_OPERATION),
  
  internal: (message: string = 'Internal server error') => 
    new AppError(message, 500, ErrorCode.INTERNAL_ERROR),
  
  database: (message: string = 'Database error') => 
    new AppError(message, 500, ErrorCode.DATABASE_ERROR),
  
  fileUpload: (message: string = 'File upload failed') => 
    new AppError(message, 400, ErrorCode.FILE_UPLOAD_ERROR),
  
  fileNotFound: (message: string = 'File not found') => 
    new AppError(message, 404, ErrorCode.FILE_NOT_FOUND),
  
  rateLimit: (retryAfter?: number) => 
    ErrorFactory.rateLimit(retryAfter),
  
  payment: (message: string) => 
    ErrorFactory.payment(message),
  
  insufficientBalance: () => 
    ErrorFactory.insufficientBalance(),
};

// Error handler middleware helper
export function handleError(error: unknown): AppError {
  if (isOperationalError(error)) {
    return error as AppError;
  }
  
  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
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
    const name = (error as { name: string }).name;
    
    if (name === 'ValidationError') {
      const err = error as { message?: string };
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
    ? (error as { message: string }).message 
    : 'Unknown error';
  
  return createError.internal(message);
}

// Error logging utility
export function logError(error: SharedAppError | Error, context?: unknown) {
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
    ? { ...errorInfo, ...(context as Record<string, unknown>), timestamp }
    : { ...errorInfo, context, timestamp };
  
  logger.error(`[${timestamp}] Error occurred:`, meta);
}

// Error code to HTTP status code mapping
export function getStatusCodeForErrorCode(errorCode: ErrorCode): number {
  const statusCodeMap: Record<string, number> = {
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

/**
 * QianFu Shared Errors
 * Unified error handling across all microservices
 */

export enum ErrorCode {
  // 4xx Client Errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // 5xx Server Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',

  // Business Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  // Additional common error codes for server extension
  // These are not in shared but may be used by consuming packages
  // Note: Add additional codes here as needed
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly errors?: Array<{ field: string; message: string }>;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    isOperational: boolean = true,
    errors?: Array<{ field: string; message: string }>,
    details?: Record<string, unknown>
  ) {
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
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, errors);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, 404, ErrorCode.RESOURCE_NOT_FOUND);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, ErrorCode.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 403, ErrorCode.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, ErrorCode.CONFLICT);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
    this.retryAfter = retryAfter;
  }

  public readonly retryAfter?: number;
}

export class PaymentError extends AppError {
  constructor(message: string) {
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
  notFound: (resource: string, id?: string | number) => new NotFoundError(resource, id),
  unauthorized: (message?: string) => new UnauthorizedError(message),
  forbidden: (message?: string) => new ForbiddenError(message),
  validation: (message: string, errors?: Array<{ field: string; message: string }>) =>
    new ValidationError(message, errors),
  conflict: (message: string) => new ConflictError(message),
  rateLimit: (retryAfter?: number) => new RateLimitError(retryAfter),
  payment: (message: string) => new PaymentError(message),
  insufficientBalance: () => new InsufficientBalanceError(),
};

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * AppError options interface
 */
export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  isOperational?: boolean;
  stack?: string;
}

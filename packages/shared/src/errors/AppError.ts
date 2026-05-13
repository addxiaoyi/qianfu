/**
 * 统一错误类
 * 所有应用错误都应继承此类
 */

export enum ErrorCode {
  // 通用错误 (1000-1999)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // 认证错误 (2000-2999)
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_2FA_REQUIRED = 'AUTH_2FA_REQUIRED',

  // 用户错误 (3000-3999)
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_EMAIL_NOT_VERIFIED = 'USER_EMAIL_NOT_VERIFIED',
  USER_ACCOUNT_LOCKED = 'USER_ACCOUNT_LOCKED',
  USER_ACCOUNT_DISABLED = 'USER_ACCOUNT_DISABLED',

  // 服务器错误 (4000-4999)
  SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',
  SERVER_ALREADY_EXISTS = 'SERVER_ALREADY_EXISTS',
  SERVER_NAME_TAKEN = 'SERVER_NAME_TAKEN',
  SERVER_AT_CAPACITY = 'SERVER_AT_CAPACITY',

  // 支付错误 (5000-5999)
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_INSUFFICIENT_FUNDS = 'PAYMENT_INSUFFICIENT_FUNDS',
  PAYMENT_SUBSCRIPTION_EXPIRED = 'PAYMENT_SUBSCRIPTION_EXPIRED',

  // AI 服务错误 (6000-6999)
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  AI_MODEL_UNAVAILABLE = 'AI_MODEL_UNAVAILABLE',
  AI_RATE_LIMITED = 'AI_RATE_LIMITED',
}

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  isOperational?: boolean;
  stack?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    this.timestamp = new Date().toISOString();

    // 捕获堆栈信息
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    } else {
      this.stack = new Error().stack;
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    };
  }

  toString(): string {
    return `[${this.code}] ${this.statusCode}: ${this.message}`;
  }

  // 工厂方法
  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.BAD_REQUEST,
      message,
      statusCode: 400,
      details,
    });
  }

  static unauthorized(message = 'Unauthorized', details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message,
      statusCode: 401,
      details,
    });
  }

  static forbidden(message = 'Forbidden', details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.FORBIDDEN,
      message,
      statusCode: 403,
      details,
    });
  }

  static notFound(message = 'Resource not found', details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.NOT_FOUND,
      message,
      statusCode: 404,
      details,
    });
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.CONFLICT,
      message,
      statusCode: 409,
      details,
    });
  }

  static internal(message = 'Internal server error', details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message,
      statusCode: 500,
      details,
      isOperational: false,
    });
  }

  static serviceUnavailable(message = 'Service unavailable', details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message,
      statusCode: 503,
      details,
    });
  }

  static validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: 422,
      details,
    });
  }
}

export default AppError;

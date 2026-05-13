/**
 * 全局错误处理中间件
 * 统一处理所有错误，提供一致的错误响应
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

// ============================================
// 错误处理中间件
// ============================================

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 记录错误日志
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: (req as unknown as { user?: { id: string } }).user?.id,
  });

  // 处理已知的应用错误
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // 处理 Prisma 错误
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = handlePrismaError(err as unknown as Record<string, unknown>);
    res.status(prismaError.statusCode).json(prismaError.toJSON());
    return;
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: '无效的认证令牌',
      },
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: '认证令牌已过期',
      },
    });
    return;
  }

  // 处理其他未知错误
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDevelopment ? err.message : '服务器内部错误',
      ...(isDevelopment && { stack: err.stack }),
    },
  });
}

// ============================================
// Prisma 错误处理
// ============================================

function handlePrismaError(err: Record<string, unknown>): AppError {
  const code = err.code as string;

  switch (code) {
    case 'P2002':
      return new AppError(
        '唯一约束冲突',
        409,
        'UNIQUE_CONSTRAINT_VIOLATION',
        [
          {
            field: (err.meta as Record<string, string>)?.target as string,
            message: '该值已存在',
          },
        ]
      );

    case 'P2003':
      return new AppError(
        '外键约束失败',
        400,
        'FOREIGN_KEY_CONSTRAINT_FAILED'
      );

    case 'P2025':
      return new AppError('记录不存在', 404, 'RECORD_NOT_FOUND');

    case 'P2014':
      return new AppError(
        '关系冲突',
        409,
        'RELATION_CONFLICT'
      );

    default:
      return new AppError(
        '数据库操作失败',
        500,
        'DATABASE_ERROR'
      );
  }
}

// ============================================
// 异步错误处理包装器
// ============================================

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

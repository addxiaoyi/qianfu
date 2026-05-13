/**
 * Zod 验证封装
 * 提供类型安全的请求验证
 */

import { z, ZodSchema, ZodError } from 'zod';
import { AppError } from '../errors/AppError';

/**
 * 验证结果
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    issues: Array<{
      path: string;
      message: string;
    }>;
  };
}

/**
 * 验证请求数据
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: formatZodError(result.error),
  };
}

/**
 * 验证并返回数据或抛出错误
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown, message = 'Validation failed'): T {
  const result = validate(schema, data);

  if (!result.success) {
    throw AppError.validationError(message, { issues: result.error?.issues });
  }

  return result.data!;
}

/**
 * 格式化 Zod 错误
 */
function formatZodError(error: ZodError): ValidationResult['error'] {
  return {
    code: 'VALIDATION_ERROR',
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Express 中间件工厂
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction): void => {
    const result = validate(schema, req.body);

    if (!result.success) {
      throw AppError.validationError('Invalid request body', { issues: result.error?.issues });
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction): void => {
    const result = validate(schema, req.query);

    if (!result.success) {
      throw AppError.validationError('Invalid query parameters', { issues: result.error?.issues });
    }

    req.query = result.data as typeof req.query;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction): void => {
    const result = validate(schema, req.params);

    if (!result.success) {
      throw AppError.validationError('Invalid URL parameters', { issues: result.error?.issues });
    }

    req.params = result.data as typeof req.params;
    next();
  };
}

// ============================================================================
// 常用验证模式
// ============================================================================

export const patterns = {
  // UUID
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // 用户名: 3-30字符，字母数字下划线
  username: /^[a-zA-Z0-9_]{3,30}$/,

  // 邮箱
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // 密码: 至少8位，包含大小写和数字
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,

  // URL
  url: /^https?:\/\/.+/i,
};

// ============================================================================
// 常用 Zod Schema
// ============================================================================

export const schemas = {
  // 分页参数
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // ID 参数
  idParam: z.object({
    id: z.string().regex(patterns.uuid, 'Invalid ID format'),
  }),

  // 可选 ID 参数
  optionalIdParam: z.object({
    id: z.string().regex(patterns.uuid, 'Invalid ID format').optional(),
  }),

  // 日期范围
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // 创建时间戳
  createdAt: z.object({
    createdAt: z.coerce.date().optional(),
  }),

  // 更新时间戳
  updatedAt: z.object({
    updatedAt: z.coerce.date().optional(),
  }),
};

// 重新导出 Zod
export { z };
export default {
  validate,
  validateOrThrow,
  validateBody,
  validateQuery,
  validateParams,
  patterns,
  schemas,
};

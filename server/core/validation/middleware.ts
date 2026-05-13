/**
 * 验证中间件
 * 
 * 提供请求数据自动验证：
 * - query 参数验证
 * - body 参数验证
 * - params 参数验证
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ZodValidationError } from './schemas';

function unwrapSchema(schema: unknown): unknown {
  if (
    schema &&
    typeof schema === 'object' &&
    'unwrap' in schema &&
    typeof (schema as { unwrap?: unknown }).unwrap === 'function'
  ) {
    return unwrapSchema((schema as { unwrap: () => unknown }).unwrap());
  }
  return schema;
}

/**
 * 从 Zod schema 生成验证中间件
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ZodValidationError('Request body validation failed', errors));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // 将字符串参数转换为适当的类型
    const query = castQueryParams(req.query, schema);
    const result = schema.safeParse(query);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ZodValidationError('Query parameters validation failed', errors));
    }
    req.query = result.data as any;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ZodValidationError('URL parameters validation failed', errors));
    }
    next();
  };
}

/**
 * 将查询参数从字符串转换为适当的类型
 */
function castQueryParams(query: Record<string, unknown>, schema: ZodSchema<unknown>): Record<string, unknown> {
  const shape = (schema as any)._def?.shape?.() || {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(query)) {
    const fieldSchema = shape[key] as unknown;
    if (!fieldSchema) {
      result[key] = value;
      continue;
    }

    const innerSchema = unwrapSchema(fieldSchema) as { _def?: { typeName?: string } };
    const typeName = (innerSchema as any)?._def?.typeName || '';

    if (typeName === 'ZodNumber') {
      result[key] = value === '' ? undefined : Number(value);
    } else if (typeName === 'ZodBoolean') {
      result[key] = value === 'true' ? true : value === 'false' ? false : value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

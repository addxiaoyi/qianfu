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
/**
 * 从 Zod schema 生成验证中间件
 */
export declare function validateBody<T>(schema: ZodSchema<T>): (req: Request, _res: Response, next: NextFunction) => void;
export declare function validateQuery<T>(schema: ZodSchema<T>): (req: Request, _res: Response, next: NextFunction) => void;
export declare function validateParams<T>(schema: ZodSchema<T>): (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=middleware.d.ts.map
/**
 * 日志工具
 * 统一的日志记录，支持结构化日志
 */
import winston from 'winston';
export declare const logger: winston.Logger;
import type { Request, Response, NextFunction } from 'express';
export declare function requestLogger(req: Request, res: Response, next: NextFunction): void;
export declare function performanceLogger<T extends (...args: unknown[]) => unknown>(fn: T, name: string): T;
//# sourceMappingURL=logger.d.ts.map
/**
 * 结构化日志模块 - 服务端版
 * 统一的后端日志解决方案
 *
 * Features:
 * - 结构化 JSON 输出，便于日志收集与分析
 * - 日志级别控制 (debug, info, warn, error)
 * - 请求追踪 (requestId)
 * - 用户上下文
 * - 敏感信息过滤（使用 server/utils/masking）
 * - 美化的开发模式输出
 */
import { Request, Response, NextFunction } from 'express';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogContext {
    requestId?: string;
    userId?: string | number;
    ip?: string;
    method?: string;
    path?: string;
    statusCode?: number;
    duration?: number;
    userAgent?: string;
    [key: string]: unknown;
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    category?: string;
    context?: LogContext;
    error?: {
        name?: string;
        message: string;
        stack?: string;
    };
}
export interface Logger {
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: unknown, context?: LogContext): void;
    child(context: LogContext): Logger;
    category(name: string): Logger;
    middleware(): (req: Request, res: Response, next: NextFunction) => void;
    requestLogger(): (req: Request, res: Response, next: NextFunction) => void;
}
export declare const logger: Logger;
export declare const authLogger: Logger;
export declare const apiLogger: Logger;
export declare const securityLogger: Logger;
export declare const paymentLogger: Logger;
export declare const requestLogger: Logger;
export declare function createRequestLogger(): (req: Request, res: Response, next: NextFunction) => void;
export declare function createErrorLogger(category?: string): Logger;
export declare function generateRequestId(): string;
export declare function getRequestId(req: Request): string | undefined;
export declare function withRequestId<T extends LogContext>(req: Request, context: T): T;
//# sourceMappingURL=logger.d.ts.map
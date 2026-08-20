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
import { maskSensitiveData, logMasker } from '../utils/masking';

// ============================================================
// Types
// ============================================================

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

// ============================================================
// Configuration
// ============================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (() => {
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel as LogLevel];
  }
  return process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;
})();

const isProduction = process.env.NODE_ENV === 'production';

// ============================================================
// Utilities
// ============================================================

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function serializeError(error: unknown): LogEntry['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

// 使用统一的脱敏模块进行敏感数据过滤
function filterSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  return maskSensitiveData(data) as Record<string, unknown>;
}

// ============================================================
// Core Logger
// ============================================================

function createLogEntry(
  level: LogLevel,
  message: string,
  category?: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    message,
  };

  if (category) entry.category = category;
  if (context) {
    entry.context = filterSensitiveData(context) as LogContext;
  }
  if (error) entry.error = serializeError(error);

  return entry;
}

function output(entry: LogEntry): void {
  const { timestamp, level, message, category, context, error } = entry;

  // 开发模式：使用美化输出
  if (!isProduction) {
    const prefix = category ? `[${category}]` : '';
    const levelLabel = level.toUpperCase().padEnd(5);

    // 使用统一的脱敏器
    const meta = context
      ? ` ${JSON.stringify(logMasker.mask(context as Record<string, unknown>), null, 0)}`
      : '';

    logger.info(`${timestamp} ${levelLabel} ${prefix} ${message}${meta}`);

    if (error) {
      logger.error(error.message, error);
    }
    return;
  }

  // 生产模式：结构化 JSON
  const outputStr = JSON.stringify(entry);
  switch (level) {
    case 'error':
      logger.error(outputStr);
      break;
    case 'warn':
      logger.warn(outputStr);
      break;
    default:
      logger.info(outputStr);
  }
}

// ============================================================
// Logger API
// ============================================================

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

/**
 * 创建分类日志器
 */
function createLogger(defaultCategory?: string, defaultContext?: LogContext): Logger {
  const category = defaultCategory;
  const baseContext = defaultContext;

  const log = (level: LogLevel, message: string, error?: unknown, context?: LogContext) => {
    if (!shouldLog(level)) return;

    const mergedContext = {
      ...baseContext,
      ...context,
    };

    const entry = createLogEntry(level, message, category, mergedContext, error);
    output(entry);
  };

  return {
    debug(message: string, context?: LogContext) {
      log('debug', message, undefined, context);
    },

    info(message: string, context?: LogContext) {
      log('info', message, undefined, context);
    },

    warn(message: string, context?: LogContext) {
      log('warn', message, undefined, context);
    },

    error(message: string, error?: unknown, context?: LogContext) {
      log('error', message, error, context);
    },

    child(context: LogContext) {
      return createLogger(category, { ...baseContext, ...context });
    },

    category(name: string) {
      return createLogger(name, baseContext);
    },

    /**
     * Express 中间件 - 请求日志
     */
    middleware() {
      return (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();
        const requestId = (req.headers['x-request-id'] as string) ||
          `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

        // 添加 requestId 到响应头
        res.setHeader('X-Request-Id', requestId);

        // 附加到请求对象
        req.requestId = requestId;
        req.startTime = startTime;

        next();
      };
    },

    /**
     * Express 中间件 - 请求完成日志
     */
    requestLogger() {
      return (req: Request, res: Response, next: NextFunction) => {
        const startTime = req.startTime || Date.now();
        const requestId = req.requestId;
        const duration = Date.now() - startTime;

        // 监听响应完成
        res.on('finish', () => {
          const context: LogContext = {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
          };

          const level: LogLevel = res.statusCode >= 500 ? 'error' :
            res.statusCode >= 400 ? 'warn' : 'info';

          const message = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;

          log(level, message, undefined, context);
        });

        next();
      };
    },
  };
}

// ============================================================
// Preset Loggers
// ============================================================

export const logger = createLogger();

export const authLogger = createLogger('auth');
export const apiLogger = createLogger('api');
export const securityLogger = createLogger('security');
export const paymentLogger = createLogger('payment');
export const requestLogger = createLogger('http');

// ============================================================
// Express Middleware Factory
// ============================================================

export function createRequestLogger() {
  return requestLogger.requestLogger();
}

export function createErrorLogger(category?: string) {
  return createLogger(category || 'error');
}

// ============================================================
// Request ID Utilities
// ============================================================

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getRequestId(req: Request): string | undefined {
  return req.requestId;
}

export function withRequestId<T extends LogContext>(req: Request, context: T): T {
  return {
    ...context,
    requestId: getRequestId(req),
  };
}

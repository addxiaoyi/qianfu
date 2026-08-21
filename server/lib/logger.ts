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
 * - Prometheus 指标集成 (Prometheus Metrics)
 */

import { Request, Response, NextFunction } from 'express';
import { maskSensitiveData, logMasker } from '../utils/masking';
import { env } from '../config/env';

// ============================================================
// Prometheus Metrics 导入（可选，无 prom-client 时静默跳过）
// ============================================================

let errorLogCounter: any = null;
let warnLogCounter: any = null;

try {
  // 动态导入 metrics 模块
  const metrics = require('./metrics');
  errorLogCounter = metrics.appErrorLogCounter;
  warnLogCounter = metrics.appWarnLogCounter;
} catch {
  // metrics 模块不存在或导入失败，指标收集将被跳过
}

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
  if (env.LOG_LEVEL && env.LOG_LEVEL in LOG_LEVELS) {
    return LOG_LEVELS[env.LOG_LEVEL as LogLevel];
  }
  return env.isProduction ? LOG_LEVELS.info : LOG_LEVELS.debug;
})();

const isProduction = env.isProduction;

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
// Metrics Recording
// ============================================================

/**
 * 记录错误到 Prometheus 指标
 */
function recordToMetrics(level: LogLevel, category: string) {
  if (level === 'error' && errorLogCounter) {
    try {
      errorLogCounter.inc({ category, level }, 1);
    } catch {
      // 忽略指标记录失败
    }
  }
  if (level === 'warn' && warnLogCounter) {
    try {
      warnLogCounter.inc({ category, level }, 1);
    } catch {
      // 忽略指标记录失败
    }
  }
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
    const style = getLevelStyle(level);

    // 使用统一的脱敏器
    const meta = context
      ? ` ${JSON.stringify(logMasker.mask(context as Record<string, unknown>), null, 0)}`
      : '';

    console.log(
      `%c${timestamp} %c${levelLabel}%c ${prefix} ${message}${meta}`,
      'color: #666; font-size: 10px;',
      style,
      'color: inherit;',
    );

    if (error) {
      console.error(error);
    }
    return;
  }

  // 生产模式：结构化 JSON
  const outputStr = JSON.stringify(entry);
  switch (level) {
    case 'error':
      console.error(outputStr);
      break;
    case 'warn':
      console.warn(outputStr);
      break;
    default:
      console.log(outputStr);
  }
}

function getLevelStyle(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return 'color: #888; font-weight: bold;';
    case 'info':
      return 'color: #3b82f6; font-weight: bold;';
    case 'warn':
      return 'color: #f59e0b; font-weight: bold;';
    case 'error':
      return 'color: #ef4444; font-weight: bold;';
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

    // 记录到 Prometheus 指标
    recordToMetrics(level, category || 'general');
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
        (req as any).requestId = requestId;
        (req as any).startTime = startTime;

        next();
      };
    },

    /**
     * Express 中间件 - 请求完成日志
     */
    requestLogger() {
      return (req: Request, res: Response, next: NextFunction) => {
        const startTime = (req as any).startTime || Date.now();
        const requestId = (req as any).requestId;
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
  return (req as any).requestId;
}

export function withRequestId<T extends LogContext>(req: Request, context: T): T {
  return {
    ...context,
    requestId: getRequestId(req),
  };
}

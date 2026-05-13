/**
 * Winston 日志封装
 * 提供结构化日志输出
 */

import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

// 请求上下文存储
const requestContext = new AsyncLocalStorage<Map<string, unknown>>();

// 日志级别颜色映射
const levelColors: Record<string, string> = {
  error: '\x1b[31m',   // 红色
  warn: '\x1b[33m',    // 黄色
  info: '\x1b[36m',    // 青色
  http: '\x1b[90m',    // 灰色
  debug: '\x1b[90m',   // 灰色
};

// 格式化器
const formatters = {
  // 控制台格式化
  console: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${levelColors[level] || ''}[${level.toUpperCase()}]${metaStr} ${message}\x1b[0m`;
    })
  ),

  // JSON 格式化 (生产环境)
  json: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
};

// 创建日志实例
function createLogger(name: string): winston.Logger {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

  return winston.createLogger({
    level: logLevel,
    defaultMeta: { service: name },
    levels: winston.config.npm.levels,
    format: isProduction ? formatters.json : formatters.console,
    transports: [
      // 控制台输出
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
      }),
      // 文件输出 (非测试环境)
      ...(!isTest
        ? [
            new winston.transports.File({
              filename: `logs/${name}-error-${new Date().toISOString().split('T')[0]}.log`,
              level: 'error',
              maxsize: 10 * 1024 * 1024, // 10MB
              maxFiles: 5,
            }),
            new winston.transports.File({
              filename: `logs/${name}-${new Date().toISOString().split('T')[0]}.log`,
              maxsize: 10 * 1024 * 1024, // 10MB
              maxFiles: 5,
            }),
          ]
        : []),
    ],
    exitOnError: false,
  });
}

// 默认日志实例
const defaultLogger = createLogger(process.env.SERVICE_NAME || 'qianfu');

/**
 * 获取带上下文的日志实例
 */
export function getLogger(context?: Record<string, unknown>): winston.Logger {
  if (!context) return defaultLogger;

  return defaultLogger.child(context);
}

/**
 * 创建带请求上下文的日志
 */
export function createRequestLogger(requestId: string): winston.Logger {
  return defaultLogger.child({ requestId });
}

// 请求上下文日志助手
export const requestLogger = {
  info(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    defaultLogger.info(message, { ...logMeta, ...meta });
  },
  error(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    defaultLogger.error(message, { ...logMeta, ...meta });
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    defaultLogger.warn(message, { ...logMeta, ...meta });
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    defaultLogger.debug(message, { ...logMeta, ...meta });
  },
};

/**
 * 执行带上下文的异步操作
 */
export function runWithContext<T>(
  context: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  return requestContext.run(new Map(Object.entries(context)), fn);
}

/**
 * Express 中间件：请求日志
 */
export function requestLoggingMiddleware(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || `req-${Date.now()}`;

  // 设置请求上下文
  requestContext.enterWith(
    new Map([
      ['requestId', requestId],
      ['method', req.method],
      ['path', req.path],
      ['ip', req.ip],
    ])
  );

  // 响应完成时记录
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};

    defaultLogger[logLevel](`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`, {
      ...logMeta,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

export { defaultLogger as logger };
export default {
  logger: defaultLogger,
  getLogger,
  createRequestLogger,
  requestLogger,
  runWithContext,
  requestLoggingMiddleware,
};

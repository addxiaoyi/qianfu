/**
 * QianFu Shared Logger
 * Winston-based structured logging with correlation IDs
 */

import winston from 'winston';
import { format } from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

const { combine, timestamp, printf, colorize, errors, json } = format;

// Request context storage
const requestContext = new AsyncLocalStorage<Map<string, unknown>>();

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log format configuration
 */
const logFormat = printf(({ level, message, timestamp, correlationId, service, ...metadata }) => {
  const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
  const corrId = correlationId ? `[${correlationId}]` : '';
  const svc = service ? `[${service}]` : '';
  return `${timestamp} ${level}${svc}${corrId}: ${message} ${meta}`;
});

const jsonFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  json()
);

const prettyFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  colorize({ all: true }),
  errors({ stack: true }),
  logFormat
);

/**
 * Create a logger instance
 */
export function createLogger(config: {
  service?: string;
  level?: string;
  json?: boolean;
  correlationId?: string;
} = {}): winston.Logger {
  const { service = 'qianfu', level = process.env.LOG_LEVEL || 'info', json = false } = config;

  return winston.createLogger({
    level,
    format: json ? jsonFormat : prettyFormat,
    defaultMeta: { service },
    transports: [
      // Console transport
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
      }),

      // File transport for errors
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true,
      }),

      // File transport for all logs
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        tailable: true,
      }),
    ],
    exitOnError: false,
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

/**
 * Get logger with optional context (for compatibility)
 */
export function getLogger(context?: Record<string, unknown>): winston.Logger {
  if (!context) return logger;
  return logger.child(context);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string): winston.Logger {
  return logger.child({ requestId });
}

/**
 * Request-scoped logging helpers
 */
export const requestLogger = {
  info(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    logger.info(message, { ...logMeta, ...meta });
  },
  error(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    logger.error(message, { ...logMeta, ...meta });
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    logger.warn(message, { ...logMeta, ...meta });
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};
    logger.debug(message, { ...logMeta, ...meta });
  },
};

/**
 * Run function with request context
 */
export function runWithContext<T>(
  context: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  return requestContext.run(new Map(Object.entries(context)), fn);
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
): void {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || `req-${Date.now()}`;

  // Set request context
  requestContext.enterWith(
    new Map([
      ['requestId', requestId],
      ['method', req.method],
      ['path', req.path],
      ['ip', req.ip],
    ])
  );

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    const context = requestContext.getStore();
    const logMeta = context ? Object.fromEntries(context) : {};

    logger[logLevel](`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`, {
      ...logMeta,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

/**
 * Log request/response helper
 */
export function logRequest(req: {
  method: string;
  url: string;
  ip?: string;
  headers?: Record<string, string>;
  body?: unknown;
  correlationId?: string;
}) {
  logger.info('Incoming request', {
    type: 'request',
    method: req.method,
    path: req.url,
    ip: req.ip,
    correlationId: req.correlationId,
    userAgent: req.headers?.['user-agent'],
  });
}

export function logResponse(req: {
  method: string;
  url: string;
}, res: {
  statusCode: number;
}, duration: number) {
  const log = res.statusCode >= 400 ? logger.warn : logger.info;
  log('Request completed', {
    type: 'response',
    method: req.method,
    path: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
  });
}

export { logger as default };

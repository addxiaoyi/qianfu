/**
 * 日志工具
 * 统一的日志记录，支持结构化日志
 */

import winston from 'winston';

// ============================================
// 日志配置
// ============================================

const isDevelopment = process.env.NODE_ENV === 'development';

// 创建 Winston logger 实例
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'qianfu-api',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: isDevelopment
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ level, message, timestamp, ...metadata }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(metadata).length > 0) {
                msg += ` ${JSON.stringify(metadata)}`;
              }
              return msg;
            })
          )
        : winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
    }),
  ],
});

// 在生产环境添加文件日志
if (!isDevelopment) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

// ============================================
// HTTP 请求日志中间件
// ============================================

import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: (req as unknown as { user?: { id: string } }).user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn(logData);
    } else {
      logger.info(logData);
    }
  });

  next();
}

// ============================================
// 性能日志
// ============================================

export function performanceLogger<T extends (...args: unknown[]) => unknown>(
  fn: T,
  name: string
): T {
  return ((...args: unknown[]) => {
    const start = Date.now();
    const result = fn(...args);

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = Date.now() - start;
        logger.debug({
          function: name,
          duration: `${duration}ms`,
        });
      });
    }

    const duration = Date.now() - start;
    logger.debug({
      function: name,
      duration: `${duration}ms`,
    });

    return result;
  }) as T;
}

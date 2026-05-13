/**
 * Logger Utility
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston;

const logFormat = printf(({ level, message, timestamp, correlationId, ...metadata }) => {
  const corrId = correlationId ? `[${correlationId}]` : '';
  const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
  return `${timestamp} ${level}${corrId}: ${message} ${meta}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    colorize({ all: true }),
    logFormat
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
  exitOnError: false,
});

export { logger };
export default logger;

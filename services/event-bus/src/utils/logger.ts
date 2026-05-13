/**
 * Logger Utility
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
  return `${timestamp} ${level}: ${message} ${meta}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    colorize({ all: true }),
    logFormat
  ),
  defaultMeta: { service: 'event-bus' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
});

export { logger };
export default logger;

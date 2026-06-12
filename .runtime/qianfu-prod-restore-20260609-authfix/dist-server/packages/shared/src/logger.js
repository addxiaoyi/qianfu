import winston from 'winston';
const defaultFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.colorize(), winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`.trim();
}));
export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: defaultFormat,
    transports: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production'
            ? [new winston.transports.File({ filename: 'logs/error.log', level: 'error' })]
            : []),
    ],
});
export function createLogger(options) {
    return winston.createLogger({
        level: options?.level ?? 'info',
        format: options?.format ?? defaultFormat,
        transports: options?.transports ?? [new winston.transports.Console()],
    });
}
//# sourceMappingURL=logger.js.map
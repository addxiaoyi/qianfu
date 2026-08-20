import winston from 'winston';
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';
export interface LoggerOptions {
    level?: LogLevel;
    format?: winston.Logform.Format;
    transports?: winston.transport[];
}
export declare const logger: winston.Logger;
export declare function createLogger(options?: LoggerOptions): winston.Logger;
//# sourceMappingURL=logger.d.ts.map
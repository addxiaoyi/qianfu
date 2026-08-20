import { logger as sharedLogger } from '@qianfu/shared';
import type { Logger } from 'winston';
import { Request } from 'express';
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
declare class LoggerWrapper {
    private currentLevel;
    private shared;
    constructor();
    private shouldLog;
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
    security(message: string, meta?: unknown): void;
    logRequest(req: Request, duration: number, statusCode: number): void;
    child(bindings: Record<string, unknown>): Logger;
    maskData(data: unknown): unknown;
}
export declare const logger: LoggerWrapper;
export { sharedLogger };
//# sourceMappingURL=logger.d.ts.map
// Logger utility module
// Now using @qianfu/shared for core logger functionality
import { logger as sharedLogger, createLogger as createSharedLogger } from '@qianfu/shared';
import safeStringify from 'json-stringify-safe';
import { maskData as maskDataUtil } from './masking.js';
// ============================================
// Extended Logger with Server-specific Features
// ============================================
// Log Level Configuration
// Note: Server uses its own LogLevel enum for type safety
export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (LogLevel = {}));
const LOG_LEVELS = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
};
// Get current log level from environment
const logLevel = process.env.LOG_LEVEL || LogLevel.INFO;
// ============================================
// Masking Utilities
// ============================================
function maskData(data, depth = 0) {
    if (!data || depth > 5)
        return data;
    let safeData = data;
    if (depth === 0 && typeof data === 'object') {
        try {
            safeData = JSON.parse(safeStringify(data));
        }
        catch {
            return '[Circular or Unserializable Data]';
        }
    }
    return maskDataUtil(safeData);
}
// ============================================
// Build Meta Helper
// ============================================
function buildMeta(meta) {
    const input = meta && typeof meta === 'object'
        ? meta
        : meta === undefined
            ? {}
            : { value: meta };
    // Extract request context if available
    const request = input.request;
    const requestId = request?.requestId || input.requestId;
    const context = {};
    if (requestId)
        context.requestId = requestId;
    if (request?.method) {
        context.method = request.method;
        context.path = request.path;
    }
    if (request?.ip)
        context.ip = request.ip;
    // Remove internal fields
    const { request: _req, requestId: _reqId, stack: _stack, ...restMeta } = input;
    return {
        ...context,
        ...Object.fromEntries(Object.entries(restMeta)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, maskData(v)])),
    };
}
// ============================================
// Extended Logger Class
// ============================================
class LoggerWrapper {
    currentLevel;
    shared;
    constructor() {
        this.currentLevel = logLevel;
        this.shared = createSharedLogger({ level: logLevel });
    }
    shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.currentLevel];
    }
    debug(message, meta) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            this.shared.debug(message, buildMeta((meta && typeof meta === 'object') ? meta : { meta }));
        }
    }
    info(message, meta) {
        if (this.shouldLog(LogLevel.INFO)) {
            this.shared.info(message, buildMeta((meta && typeof meta === 'object') ? meta : { meta }));
        }
    }
    warn(message, meta) {
        if (this.shouldLog(LogLevel.WARN)) {
            this.shared.warn(message, buildMeta((meta && typeof meta === 'object') ? meta : { meta }));
        }
    }
    error(message, meta) {
        if (this.shouldLog(LogLevel.ERROR)) {
            this.shared.error(message, buildMeta((meta && typeof meta === 'object') ? meta : { meta }));
        }
    }
    security(message, meta) {
        // Security events are always logged at error level
        this.shared.error(`[SECURITY] ${message}`, buildMeta((meta && typeof meta === 'object') ? meta : { meta }));
    }
    // HTTP request logging helper
    logRequest(req, duration, statusCode) {
        const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        const logFn = level === 'error' ? this.shared.error.bind(this.shared)
            : level === 'warn' ? this.shared.warn.bind(this.shared)
                : this.shared.info.bind(this.shared);
        logFn(`${req.method} ${req.path}`, {
            request: req,
            duration_ms: duration,
            status: statusCode,
        });
    }
    // Child logger for specific modules
    child(bindings) {
        return this.shared.child(bindings);
    }
    // Expose maskData for backward compatibility
    maskData(data) {
        return maskData(data);
    }
}
// Export the wrapped logger
export const logger = new LoggerWrapper();
// Also export the shared logger directly for cases that need winston.Logger
export { sharedLogger };
//# sourceMappingURL=logger.js.map
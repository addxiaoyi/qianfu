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
 */
import { maskSensitiveData, logMasker } from '../utils/masking';
// ============================================================
// Configuration
// ============================================================
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = (() => {
    const envLevel = process.env.LOG_LEVEL;
    if (envLevel && envLevel in LOG_LEVELS) {
        return LOG_LEVELS[envLevel];
    }
    return process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;
})();
const isProduction = process.env.NODE_ENV === 'production';
// ============================================================
// Utilities
// ============================================================
function shouldLog(level) {
    return LOG_LEVELS[level] >= currentLevel;
}
function formatTimestamp() {
    return new Date().toISOString();
}
function serializeError(error) {
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
function filterSensitiveData(data) {
    return maskSensitiveData(data);
}
// ============================================================
// Core Logger
// ============================================================
function createLogEntry(level, message, category, context, error) {
    const entry = {
        timestamp: formatTimestamp(),
        level,
        message,
    };
    if (category)
        entry.category = category;
    if (context) {
        entry.context = filterSensitiveData(context);
    }
    if (error)
        entry.error = serializeError(error);
    return entry;
}
function output(entry) {
    const { timestamp, level, message, category, context, error } = entry;
    // 开发模式：使用美化输出
    if (!isProduction) {
        const prefix = category ? `[${category}]` : '';
        const levelLabel = level.toUpperCase().padEnd(5);
        const style = getLevelStyle(level);
        // 使用统一的脱敏器
        const meta = context
            ? ` ${JSON.stringify(logMasker.mask(context), null, 0)}`
            : '';
        console.log(`%c${timestamp} %c${levelLabel}%c ${prefix} ${message}${meta}`, 'color: #666; font-size: 10px;', style, 'color: inherit;');
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
function getLevelStyle(level) {
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
/**
 * 创建分类日志器
 */
function createLogger(defaultCategory, defaultContext) {
    const category = defaultCategory;
    const baseContext = defaultContext;
    const log = (level, message, error, context) => {
        if (!shouldLog(level))
            return;
        const mergedContext = {
            ...baseContext,
            ...context,
        };
        const entry = createLogEntry(level, message, category, mergedContext, error);
        output(entry);
    };
    return {
        debug(message, context) {
            log('debug', message, undefined, context);
        },
        info(message, context) {
            log('info', message, undefined, context);
        },
        warn(message, context) {
            log('warn', message, undefined, context);
        },
        error(message, error, context) {
            log('error', message, error, context);
        },
        child(context) {
            return createLogger(category, { ...baseContext, ...context });
        },
        category(name) {
            return createLogger(name, baseContext);
        },
        /**
         * Express 中间件 - 请求日志
         */
        middleware() {
            return (req, res, next) => {
                const startTime = Date.now();
                const requestId = req.headers['x-request-id'] ||
                    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                // 添加 requestId 到响应头
                res.setHeader('X-Request-Id', requestId);
                // 附加到请求对象
                req.requestId = requestId;
                req.startTime = startTime;
                next();
            };
        },
        /**
         * Express 中间件 - 请求完成日志
         */
        requestLogger() {
            return (req, res, next) => {
                const startTime = req.startTime || Date.now();
                const requestId = req.requestId;
                const duration = Date.now() - startTime;
                // 监听响应完成
                res.on('finish', () => {
                    const context = {
                        requestId,
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode,
                        duration,
                        ip: req.ip || req.socket.remoteAddress,
                        userAgent: req.headers['user-agent'],
                    };
                    const level = res.statusCode >= 500 ? 'error' :
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
export function createErrorLogger(category) {
    return createLogger(category || 'error');
}
// ============================================================
// Request ID Utilities
// ============================================================
export function generateRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
export function getRequestId(req) {
    return req.requestId;
}
export function withRequestId(req, context) {
    return {
        ...context,
        requestId: getRequestId(req),
    };
}
//# sourceMappingURL=logger.js.map
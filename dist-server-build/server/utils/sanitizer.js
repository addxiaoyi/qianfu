import { logger } from './logger.js';
const sqlInjectionPatterns = [
    /union\s+select/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+set/i,
    /drop\s+table/i,
    /alter\s+table/i,
    /create\s+table/i,
    /truncate\s+table/i,
    /exec\s*\(/i,
    /xp_\w+/i,
    /;\s*(union|select|insert|update|delete|drop|alter|create|truncate|exec)/i,
    /'\s*or\s*'[^\n'=]*'?[^'=]*=/i, // Fixed potential ReDoS
    /'\s*and\s*'[^\n'=]*'?[^'=]*=/i, // Fixed potential ReDoS
    /@@\w+/i,
    /waitfor\s+delay/i,
    /shutdown\s+/i,
    /information_schema/i,
    /load_file\s*\(/i,
    /outfile\s+/i,
    /dumpfile\s+/i,
    /benchmark\s*\(/i,
    /sleep\s*\(/i,
    /pg_sleep\s*\(/i,
    /group_concat\s*\(/i,
    /ascii\s*\(/i,
    /substring\s*\(/i,
    /substr\s*\(/i,
    /waitfor\s+delay/i,
    /order\s+by\s+\d+/i,
    /into\s+outfile/i,
    /load_file/i,
    /mysql\./i,
    /pg_catalog\./i,
];
const suspiciousKeywords = [
    'script',
    'javascript:',
    'vbscript:',
    'onload=',
    'onerror=',
    'onclick=',
    'onmouseover=',
    'onsubmit=',
    'onchange=',
    'onfocus=',
    'onblur=',
    'onreset=',
    'onselect=',
    'ondblclick=',
    'onkeydown=',
    'onkeypress=',
    'onkeyup=',
    'onmousedown=',
    'onmousemove=',
    'onmouseout=',
    'onmouseup=',
    'document.cookie',
    'eval(',
    'setTimeout(',
    'setInterval(',
    'Function(',
    'window.',
    'parent.',
    'top.',
    'self.',
];
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isArray(value) {
    return Array.isArray(value);
}
const MAX_RECURSION_DEPTH = 5;
export function detectSQLInjection(value, depth = 0) {
    const threats = [];
    if (depth > MAX_RECURSION_DEPTH) {
        return { sanitized: true, threats: ['Max recursion depth reached'], value };
    }
    if (typeof value === 'string') {
        // Limit string length for regex testing to prevent ReDoS
        const testValue = value.length > 1000 ? value.slice(0, 1000) : value;
        for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(testValue)) {
                threats.push(`Pattern detected: ${pattern.toString()}`);
            }
        }
        for (const keyword of suspiciousKeywords) {
            if (testValue.toLowerCase().includes(keyword.toLowerCase())) {
                threats.push(`Suspicious keyword: ${keyword}`);
            }
        }
    }
    else if (isObject(value)) {
        for (const key of Object.keys(value)) {
            const result = detectSQLInjection(value[key], depth + 1);
            if (result.threats.length > 0) {
                threats.push(...result.threats.map(t => `In property "${key}": ${t}`));
            }
        }
    }
    else if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const result = detectSQLInjection(value[i], depth + 1);
            if (result.threats.length > 0) {
                threats.push(...result.threats.map(t => `At index ${i}: ${t}`));
            }
        }
    }
    return {
        sanitized: threats.length > 0,
        threats,
        value
    };
}
export function sanitizeString(value) {
    let sanitized = value;
    // Remove control characters except for newline and carriage return
    sanitized = sanitized.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
    // Basic HTML entity encoding for minimal XSS protection if displayed directly
    // Note: Most UI frameworks like React handle this automatically
    // sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // DO NOT manually escape quotes for SQL here, as Prisma handles parameterization
    // and manual escaping causes double-escaping issues (e.g., O'Connor -> O''Connor)
    return sanitized.trim();
}
export function sanitizeObject(obj) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizeString(key);
        if (typeof value === 'string') {
            sanitized[sanitizedKey] = sanitizeString(value);
        }
        else if (isObject(value)) {
            sanitized[sanitizedKey] = sanitizeObject(value);
        }
        else if (isArray(value)) {
            sanitized[sanitizedKey] = sanitizeArray(value);
        }
        else {
            sanitized[sanitizedKey] = value;
        }
    }
    return sanitized;
}
export function sanitizeArray(arr) {
    return arr.map((item) => {
        if (typeof item === 'string') {
            return sanitizeString(item);
        }
        else if (isObject(item)) {
            return sanitizeObject(item);
        }
        else if (isArray(item)) {
            return sanitizeArray(item);
        }
        else {
            return item;
        }
    });
}
export function sanitizeInput(value) {
    if (typeof value === 'string') {
        return sanitizeString(value);
    }
    else if (isObject(value)) {
        return sanitizeObject(value);
    }
    else if (isArray(value)) {
        return sanitizeArray(value);
    }
    return value;
}
export function sanitizeRequestBody(req, _res, next) {
    if (req.body && typeof req.body === 'object') {
        const sanitized = sanitizeObject(req.body);
        req.body = sanitized;
    }
    next();
}
export function createSQLInjectionProtection(enabled = true) {
    const whitelistedPaths = [
        '/api/csrf-token',
        '/health',
        '/api/health',
    ];
    return (req, res, next) => {
        if (!enabled) {
            next();
            return;
        }
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        const requestPath = req.path;
        const requestMethod = req.method;
        const isWhitelisted = whitelistedPaths.some(path => requestPath.startsWith(path));
        if (!isWhitelisted) {
            const bodyResult = detectSQLInjection(req.body);
            if (bodyResult.sanitized) {
                logger.warn(`[SQL Injection] Blocked potential SQL injection attempt from IP: ${clientIP}`, {
                    method: requestMethod,
                    path: requestPath,
                    threats: bodyResult.threats,
                });
                void res.status(400).json({
                    success: false,
                    error: 'Invalid input detected',
                    message: 'Potential SQL injection attack detected',
                });
                return;
            }
            const queryResult = detectSQLInjection(req.query);
            if (queryResult.sanitized) {
                logger.warn(`[SQL Injection] Blocked potential SQL injection attempt from IP: ${clientIP}`, {
                    method: requestMethod,
                    path: requestPath,
                    threats: queryResult.threats,
                });
                void res.status(400).json({
                    success: false,
                    error: 'Invalid query parameter',
                    message: 'Potential SQL injection attack detected',
                });
                return;
            }
            const paramsResult = detectSQLInjection(req.params);
            if (paramsResult.sanitized) {
                logger.warn(`[SQL Injection] Blocked potential SQL injection attempt from IP: ${clientIP}`, {
                    method: requestMethod,
                    path: requestPath,
                    threats: paramsResult.threats,
                });
                void res.status(400).json({
                    success: false,
                    error: 'Invalid URL parameter',
                    message: 'Potential SQL injection attack detected',
                });
                return;
            }
        }
        next();
    };
}
export function createParamSanitizer(paramNames) {
    return (req, _res, next) => {
        const params = req.params;
        for (const paramName of paramNames) {
            const paramValue = params[paramName];
            if (paramValue) {
                if (typeof paramValue === 'string') {
                    params[paramName] = sanitizeString(paramValue);
                }
                else if (Array.isArray(paramValue)) {
                    params[paramName] = paramValue.map((v) => sanitizeString(v));
                }
            }
            const queryValue = req.query[paramName];
            if (queryValue) {
                if (typeof queryValue === 'string') {
                    req.query[paramName] = sanitizeString(queryValue);
                }
                else if (Array.isArray(queryValue)) {
                    req.query[paramName] = queryValue.map(v => sanitizeString(v));
                }
            }
        }
        next();
    };
}
export function createBodySanitizer(fieldNames) {
    return (req, _res, next) => {
        if (req.body && typeof req.body === 'object') {
            for (const fieldName of fieldNames) {
                const value = req.body[fieldName];
                if (typeof value === 'string') {
                    req.body[fieldName] = sanitizeString(value);
                }
            }
        }
        next();
    };
}
export function sanitizeForLike(value) {
    return sanitizeString(value).replace(/%/g, '\\%').replace(/_/g, '\\_');
}
export function sanitizeForRegex(value) {
    return sanitizeString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function escapeLikeWildcards(value) {
    return value.replace(/%/g, '\\%').replace(/_/g, '\\_');
}
//# sourceMappingURL=sanitizer.js.map
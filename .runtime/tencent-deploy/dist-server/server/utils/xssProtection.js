import { logger } from './logger.js';
const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^>]*>/gi,
    /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
    /<meta\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /expression\s*\(/gi,
    /data\s*:/gi,
    /url\s*\(/gi,
    /import\s*\(/gi,
    /@import/gi,
    /\\[xX]00-[xX]1[fF]/g,
    /%0[0-9a-fA-F]/g,
    /\x00/g,
    /%u0[0-9a-fA-F]{4}/g,
    /&#x[0-9a-fA-F]+;/g,
    /&#\d+;/g,
    /fscommand\s*:/gi,
    /seek\s*=\s*"/gi,
    /style\s*=\s*".*expression\s*\(/gi,
    /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi,
    /<math\b[^<]*(?:(?!<\/math>)<[^<]*)*<\/math>/gi,
    /<form\b[^>]*>/gi,
    /<button\b[^>]*>/gi,
    /<input\b[^>]*>/gi,
    /<textarea\b[^>]*>/gi,
    /<base\b[^>]*>/gi,
    /alert\s*\(/gi,
    /confirm\s*\(/gi,
    /prompt\s*\(/gi,
    /document\.write\s*\(/gi,
    /innerHTML\s*=/gi,
    /outerHTML\s*=/gi,
    /insertAdjacentHTML\s*\(/gi,
];
const EVENT_HANDLERS_REGEX = /\b(on(?:load|error|click|mouseover|mouseout|change|submit|reset|select|blur|focus|keydown|keypress|keyup|mousedown|mousemove|mouseup|contextmenu|drag|drop|abort|beforeunload|canplay|canplaythrough|durationchange|emptied|ended|input|invalid|pause|play|playing|progress|ratechange|readystatechange|seeked|seeking|stalled|onsuspend|timeupdate|volumechange|waiting|wheel))\s*=/gi;
const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
};
export function escapeHtmlChars(str) {
    return str.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
}
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isArray(value) {
    return Array.isArray(value);
}
const MAX_RECURSION_DEPTH = 5;
export function detectXSS(value, depth = 0) {
    const threats = [];
    if (depth > MAX_RECURSION_DEPTH) {
        return { detected: true, threats: ['Max recursion depth reached during XSS scan'], value };
    }
    if (typeof value === 'string') {
        // Limit string length for regex testing to prevent ReDoS
        const testValue = value.length > 2000 ? value.slice(0, 2000) : value;
        for (const pattern of xssPatterns) {
            if (pattern.test(testValue)) {
                threats.push(`XSS pattern detected: ${pattern.toString()}`);
            }
        }
        let match;
        while ((match = EVENT_HANDLERS_REGEX.exec(testValue)) !== null) {
            threats.push(`Event handler detected: ${match[1]}`);
        }
    }
    else if (isObject(value)) {
        for (const key of Object.keys(value)) {
            const result = detectXSS(value[key], depth + 1);
            if (result.detected) {
                threats.push(...result.threats.map(t => `In property "${key}": ${t}`));
            }
        }
    }
    else if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const result = detectXSS(value[i], depth + 1);
            if (result.detected) {
                threats.push(...result.threats.map(t => `At index ${i}: ${t}`));
            }
        }
    }
    return {
        detected: threats.length > 0,
        threats,
        value
    };
}
import sanitizeHtml from 'sanitize-html';
export function sanitizeHTML(value, allowedTags = [], allowedAttributes = {}) {
    // Use sanitize-html for robust HTML sanitization
    return sanitizeHtml(value, {
        allowedTags: allowedTags.length > 0 ? allowedTags : sanitizeHtml.defaults.allowedTags,
        allowedAttributes: Object.keys(allowedAttributes).length > 0 ? allowedAttributes : sanitizeHtml.defaults.allowedAttributes,
        disallowedTagsMode: 'discard',
    });
}
export function sanitizeString(value) {
    // Step 26: Use sanitize-html for all string inputs
    // By default, we strip ALL tags from normal strings to prevent XSS
    let sanitized = sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard',
    });
    // Also escape common HTML characters as a second layer of defense
    sanitized = escapeHtmlChars(sanitized);
    // Strip control characters
    sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    return sanitized.trim();
}
export function sanitizeObject(obj, allowedTags = [], allowedAttributes = {}) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizeString(key);
        if (typeof value === 'string') {
            sanitized[sanitizedKey] = sanitizeString(value);
        }
        else if (isObject(value)) {
            sanitized[sanitizedKey] = sanitizeObject(value, allowedTags, allowedAttributes);
        }
        else if (isArray(value)) {
            sanitized[sanitizedKey] = sanitizeArray(value, allowedTags, allowedAttributes);
        }
        else {
            sanitized[sanitizedKey] = value;
        }
    }
    return sanitized;
}
export function sanitizeArray(arr, allowedTags = [], allowedAttributes = {}) {
    return arr.map((item) => {
        if (typeof item === 'string') {
            return sanitizeString(item);
        }
        else if (isObject(item)) {
            return sanitizeObject(item, allowedTags, allowedAttributes);
        }
        else if (isArray(item)) {
            return sanitizeArray(item, allowedTags, allowedAttributes);
        }
        else {
            return item;
        }
    });
}
export function sanitizeInput(value, allowedTags = [], allowedAttributes = {}) {
    if (typeof value === 'string') {
        return sanitizeString(value);
    }
    else if (isObject(value)) {
        return sanitizeObject(value, allowedTags, allowedAttributes);
    }
    else if (isArray(value)) {
        return sanitizeArray(value, allowedTags, allowedAttributes);
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
export function createXSSProtection(options = {}) {
    const { enabled = true, blockMode = true, allowedTags = [], allowedAttributes = {}, whitelistPaths = [], } = options;
    return (req, res, next) => {
        if (!enabled) {
            next();
            return;
        }
        if (whitelistPaths.some(path => req.path.startsWith(path))) {
            next();
            return;
        }
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        const requestPath = req.path;
        const requestMethod = req.method;
        const bodyResult = detectXSS(req.body);
        if (bodyResult.detected) {
            logger.warn(`[XSS Protection] Blocked potential XSS attempt from IP: ${clientIP}`, {
                method: requestMethod,
                path: requestPath,
                threats: bodyResult.threats,
            });
            if (blockMode) {
                void res.status(400).json({
                    success: false,
                    error: 'Invalid input detected',
                    message: 'Potential XSS attack detected',
                });
                return;
            }
            else {
                req.body = sanitizeObject(req.body, allowedTags, allowedAttributes);
            }
        }
        const queryResult = detectXSS(req.query);
        if (queryResult.detected) {
            logger.warn(`[XSS Protection] Blocked potential XSS attempt from IP: ${clientIP}`, {
                method: requestMethod,
                path: requestPath,
                threats: queryResult.threats,
            });
            if (blockMode) {
                void res.status(400).json({
                    success: false,
                    error: 'Invalid query parameter',
                    message: 'Potential XSS attack detected',
                });
                return;
            }
            else {
                for (const key of Object.keys(req.query)) {
                    const value = req.query[key];
                    if (typeof value === 'string') {
                        req.query[key] = sanitizeString(value);
                    }
                    else if (Array.isArray(value)) {
                        req.query[key] = value.map(v => sanitizeString(v));
                    }
                }
            }
        }
        const paramsResult = detectXSS(req.params);
        if (paramsResult.detected) {
            logger.warn(`[XSS Protection] Blocked potential XSS attempt from IP: ${clientIP}`, {
                method: requestMethod,
                path: requestPath,
                threats: paramsResult.threats,
            });
            if (blockMode) {
                void res.status(400).json({
                    success: false,
                    error: 'Invalid URL parameter',
                    message: 'Potential XSS attack detected',
                });
                return;
            }
            else {
                const params = req.params;
                for (const key of Object.keys(params)) {
                    const value = params[key];
                    if (typeof value === 'string') {
                        params[key] = sanitizeString(value);
                    }
                    else if (Array.isArray(value)) {
                        params[key] = value.map((v) => sanitizeString(v));
                    }
                }
            }
        }
        next();
    };
}
export function sanitizeForDisplay(value) {
    return escapeHtmlChars(value);
}
export function sanitizeForAttribute(value, allowedChars = '') {
    let sanitized = escapeHtmlChars(value);
    const allowedPattern = new RegExp(`[^a-zA-Z0-9${allowedChars}\-_]`, 'g');
    sanitized = sanitized.replace(allowedPattern, '');
    return sanitized;
}
export function sanitizeForURL(value) {
    let sanitized = encodeURIComponent(value);
    sanitized = sanitized.replace(/%(2[3-9a-fA-F]|[4-6][0-9a-fA-F]|7[0-9a-eA-E])/g, '');
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.~]/g, '');
    return sanitized;
}
//# sourceMappingURL=xssProtection.js.map
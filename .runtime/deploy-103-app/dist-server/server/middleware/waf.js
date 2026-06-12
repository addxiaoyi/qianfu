const suspiciousPatterns = [
    /union\s+select/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+set/i,
    /drop\s+table/i,
    /truncate\s+table/i,
    /exec\s*\(/i,
    /xp_/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /\.\.\//i, // Path traversal
    /\/\.\./i, // Path traversal
    /\$where/i, // NoSQL injection
    /\{\s*\$ne\s*:/i, // NoSQL injection
    /\{\s*\$gt\s*:/i, // NoSQL injection
    /\{\s*\$gte\s*:/i, // NoSQL injection
    /\{\s*\$lt\s*:/i, // NoSQL injection
    /\{\s*\$lte\s*:/i, // NoSQL injection
    /\{\s*\$in\s*:/i, // NoSQL injection
    /\{\s*\$nin\s*:/i, // NoSQL injection
    /\{\s*\$exists\s*:/i, // NoSQL injection
    /\{\s*\$regex\s*:/i, // NoSQL injection
    /\{\s*\$mod\s*:/i, // NoSQL injection
    /\{\s*\$all\s*:/i, // NoSQL injection
    /\{\s*\$size\s*:/i, // NoSQL injection
    /\{\s*\$elemMatch\s*:/i, // NoSQL injection
    /\{\s*\$not\s*:/i, // NoSQL injection
    /\{\s*\$type\s*:/i, // NoSQL injection
    /\{\s*\$options\s*:/i, // NoSQL injection
    /\{\s*\$search\s*:/i, // NoSQL injection
    /\{\s*\$text\s*:/i, // NoSQL injection
    /\{\s*\$language\s*:/i, // NoSQL injection
    /\{\s*\$caseSensitive\s*:/i, // NoSQL injection
    /\{\s*\$diacriticSensitive\s*:/i, // NoSQL injection
    /\{\s*\$index\s*:/i, // NoSQL injection
    // Additional security patterns
    /log4j/i, // Log4j patterns
    /\$\{jndi:/i, // Log4j JNDI
    /base64\s*,/i, // Potential base64 encoded payloads in unusual places
    /union\s+all\s+select/i,
    /select\s+.*\s+from\s+information_schema/i,
    /sys\.user_tables/i, // Oracle/SQL Server
    /waitfor\s+delay/i, // Time-based SQLi
    /benchmark\s*\(/i, // Time-based SQLi
    /pg_sleep\s*\(/i, // Postgres sleep
    /sleep\s*\(\s*\d+\s*\)/i, // MySQL sleep
    /0x[0-9a-f]+/i, // Hex encoded strings often used in SQLi
    /char\s*\(\s*\d+\s*\)/i, // Char encoding
    /unhex\s*\(/i,
    /eval\s*\(/i,
    /exec\s+sp_executesql/i,
    /<%|%>|<\?|\?>/i, // Scripting tags
    /\{\{.*\}\}/i, // SSTI (Server Side Template Injection)
    /\$\{.*\}|#\{.*\}/i, // Expression language injection
    /\[\s*\]\s*=\s*/i, // Potential array-based bypasses
    /__proto__/i, // Prototype pollution
    /constructor\s*\[\s*prototype\s*\]/i, // Prototype pollution
    /process\.env/i, // Environment variable access
    /child_process/i, // Remote code execution
    /fs\.read/i, // Local file inclusion
    /require\s*\(/i, // Node.js require
    /eval\s*\(/i, // JS eval
    /spawn\s*\(/i, // Child process spawn
    /execSync\s*\(/i, // Child process execSync
    /String\.fromCharCode/i, // Obfuscated payloads
    /atob\s*\(/i, // Base64 decoding
    /btoa\s*\(/i, // Base64 encoding
    /unescape\s*\(/i, // Unescape payloads
    /decodeURIComponent\s*\(/i, // URI decoding payloads
    /Reflect\./i, // Reflect API abuse
    /Object\.assign/i, // Prototype pollution
    /Object\.create/i, // Prototype pollution
    /hasOwnProperty/i, // Prototype pollution
    /propertyIsEnumerable/i, // Prototype pollution
    /isPrototypeOf/i, // Prototype pollution
    /valueOf/i, // Prototype pollution
    /toString/i, // Prototype pollution
    /constructor/i, // Prototype pollution
    /\.prototype\./i, // Prototype pollution
    /(\.\.\/|\.\.\\)/i, // Path traversal with backslashes
    /%2e%2e%2f|%2e%2e%5c/i, // URL encoded path traversal
    /etc\/passwd/i, // LFI common targets
    /etc\/shadow/i, // LFI common targets
    /etc\/group/i, // LFI common targets
    /etc\/hosts/i, // LFI common targets
    /proc\/self/i, // LFI common targets
    /win\.ini/i, // LFI common targets (Windows)
    /system32/i, // LFI common targets (Windows)
    /cmd\.exe/i, // LFI common targets (Windows)
    /powershell/i, // LFI common targets (Windows)
    /bash\s+-i/i, // Reverse shell
    /nc\s+-e/i, // Reverse shell
    /python\s+-c/i, // Reverse shell
    /perl\s+-e/i, // Reverse shell
    /ruby\s+-e/i, // Reverse shell
    /php\s+-r/i, // Reverse shell
    /socat\s+/i, // Reverse shell
    /curl\s+.*\|/i, // Pipe to shell
    /wget\s+.*\|/i, // Pipe to shell
    /lynx\s+.*\|/i, // Pipe to shell
    /fetch\s+.*\|/i, // Pipe to shell
    /busybox\s+/i, // Reverse shell
    /telnet\s+.*\|/i, // Reverse shell
    /openssl\s+s_client/i, // Reverse shell
    /zsh\s+-i/i, // Reverse shell
    /sh\s+-i/i, // Reverse shell
    /rm\s+-rf\s+\//i, // Malicious commands
    /:\(\)\{:\|:&\};:/i, // Fork bomb
    /chmod\s+777/i, // Malicious commands
    /chown\s+/i, // Malicious commands
    /useradd/i, // Malicious commands
    /groupadd/i, // Malicious commands
    /visudo/i, // Malicious commands
    /iptables\s+-F/i, // Malicious commands
    /ufw\s+disable/i, // Malicious commands
    /systemctl\s+stop/i, // Malicious commands
    /service\s+stop/i, // Malicious commands
    /crontab\s+-r/i, // Malicious commands
    /docker\s+exec/i, // Container escape
    /kubectl\s+exec/i, // Kubernetes escape
];
const whitelistedPaths = [
    '/api/csrf-token',
    '/api/v1/csrf-token',
    '/api/auth/csrf-token',
    '/api/v1/auth/csrf-token',
    '/api/health',
];
const sensitivePaths = [
    '/auth',
    '/api/payment/create',
    '/api/admin/setup', // Added sensitive path
];
const badUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /dirbuster/i,
    /gobuster/i,
    /nmap/i,
    /hydra/i,
    /metasploit/i,
    /zgrab/i,
    /censys/i,
    /shodan/i,
    /masscan/i,
    /acunetix/i,
    /burp/i,
    /w3af/i,
    /vega/i,
    /arachni/i,
    /openvas/i,
    /nessus/i,
    /qualys/i,
    /havij/i,
    /pangolin/i,
    /sql-injection/i,
    /scanner/i,
    /vulnerability/i,
    /exploit/i,
    /payload/i,
];
const badHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'client-ip',
    'true-client-ip',
    'x-client-ip',
    'x-host',
    'x-forwarded-host',
    'x-forwarded-proto',
];
import { redisService } from '../services/redisService.js';
import { logger } from '../utils/logger.js';
import { logAction } from '../services/auditService.js';
import { buildErrorEnvelope } from '../contracts/responseEnvelope.js';
const BAN_CACHE_PREFIX = 'ban:ip:';
const BAN_DURATION = 3600; // 1 hour
const WAF_VIOLATION_PREFIX = 'waf:violation:';
const MAX_VIOLATIONS = 5;
export function createWAFMiddleware(config) {
    return async (req, res, next) => {
        if (!config.enabled)
            return next();
        const clientIP = req.ip || req.socket.remoteAddress || '';
        if (!clientIP)
            return next();
        const recordViolation = async () => {
            try {
                const violations = await redisService.incr(WAF_VIOLATION_PREFIX + clientIP, 3600);
                if (violations >= MAX_VIOLATIONS) {
                    await redisService.set(BAN_CACHE_PREFIX + clientIP, 'true', BAN_DURATION);
                    logger.security(`[WAF] IP ${clientIP} banned for 1 hour after ${violations} violations`, { ip: clientIP, violations });
                }
            }
            catch (err) {
                logger.error(`[WAF] Error recording violation for ${clientIP}:`, err);
            }
        };
        const deny = (statusCode, message, code) => res.status(statusCode).json(buildErrorEnvelope({
            message,
            code,
            statusCode,
            requestId: req.requestId,
        }));
        // 1. Check if IP is banned
        const isBanned = await redisService.get(BAN_CACHE_PREFIX + clientIP);
        if (isBanned) {
            logger.security(`[WAF] Access attempt from banned IP: ${clientIP}`, { ip: clientIP, path: req.path });
            try {
                const uid = req.user?.id ?? null;
                const rid = req.requestId ?? '';
                await logAction(uid, 'WAF_BLOCK', 'ip_ban', req, { request_id: rid, ip: clientIP, path: req.path });
            }
            catch { }
            return deny(403, 'Your IP has been temporarily blocked due to suspicious activity.', 'WAF_IP_BANNED');
        }
        // 1.1 Mark graylist if violations recently occurred
        try {
            const vStr = await redisService.get(WAF_VIOLATION_PREFIX + clientIP);
            const vNum = vStr ? parseInt(vStr, 10) : 0;
            if (vNum >= 2) {
                req.graylisted = true;
                res.setHeader('X-Graylisted', '1');
            }
        }
        catch (e) {
            // ignore
        }
        // 2. Check for malicious user agents
        const userAgent = req.headers['user-agent'] || '';
        for (const pattern of badUserAgents) {
            if (pattern.test(userAgent)) {
                await recordViolation();
                logger.security(`[WAF] Blocked suspicious user agent: ${userAgent}`, { ip: clientIP, userAgent, path: req.path });
                try {
                    const uid = req.user?.id ?? null;
                    const rid = req.requestId ?? '';
                    await logAction(uid, 'WAF_BLOCK', 'bad_user_agent', req, { request_id: rid, ip: clientIP, userAgent, path: req.path });
                }
                catch { }
                return deny(403, 'Access denied.', 'WAF_BAD_USER_AGENT');
            }
        }
        // 3. Check for suspicious headers
        for (const header of badHeaders) {
            const value = req.headers[header];
            if (value && typeof value === 'string') {
                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(value)) {
                        await recordViolation();
                        const headerName = String(header);
                        const lowerHeader = headerName.toLowerCase();
                        const isSensitiveHeader = lowerHeader === 'authorization' || lowerHeader === 'cookie' || lowerHeader === 'set-cookie';
                        const loggedValue = isSensitiveHeader ? '[REDACTED]' : value;
                        logger.security(`[WAF] Blocked suspicious header ${headerName}: ${loggedValue}`, { ip: clientIP, header: headerName, path: req.path });
                        try {
                            const uid = req.user?.id ?? null;
                            const rid = req.requestId ?? '';
                            await logAction(uid, 'WAF_BLOCK', 'bad_header', req, { request_id: rid, ip: clientIP, header: headerName, path: req.path });
                        }
                        catch { }
                        return deny(403, 'Suspicious request blocked by WAF.', 'WAF_SUSPICIOUS_HEADER');
                    }
                }
            }
        }
        const isWhitelisted = whitelistedPaths.some(path => req.path.startsWith(path));
        const isSensitive = sensitivePaths.some(path => req.path.startsWith(path));
        if (config.blockSuspiciousIPs) {
            const globalKey = `waf:rate:${clientIP}`;
            const count = await redisService.incr(globalKey, Math.floor(config.rateLimitWindow / 1000));
            if (count > config.maxRequestsPerWindow) {
                logger.security(`[WAF] Rate limit exceeded for ${clientIP}`, { ip: clientIP });
                try {
                    const uid = req.user?.id ?? null;
                    const rid = req.requestId ?? '';
                    await logAction(uid, 'WAF_RATE_LIMIT', 'global', req, { request_id: rid, ip: clientIP });
                }
                catch { }
                return deny(429, 'Too many requests, please retry later.', 'WAF_RATE_LIMIT_GLOBAL');
            }
            if (isSensitive) {
                const sensitiveKey = `waf:sensitive:${clientIP}`;
                const sensitiveCount = await redisService.incr(sensitiveKey, 300); // 5 mins
                const maxSensitiveRequests = 10; // Increased slightly for production
                if (sensitiveCount > maxSensitiveRequests) {
                    await recordViolation();
                    logger.security(`[WAF] Sensitive rate limit exceeded for ${clientIP} on ${req.path}`, { ip: clientIP, path: req.path });
                    try {
                        const uid = req.user?.id ?? null;
                        const rid = req.requestId ?? '';
                        await logAction(uid, 'WAF_RATE_LIMIT', 'sensitive', req, { request_id: rid, ip: clientIP, path: req.path });
                    }
                    catch { }
                    return deny(429, 'Sensitive endpoint access is temporarily limited.', 'WAF_RATE_LIMIT_SENSITIVE');
                }
            }
        }
        // Optimization: Check suspicious patterns in path/url first (fast)
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(req.path) || pattern.test(req.url)) {
                await recordViolation();
                logger.security(`[WAF] Blocked suspicious path/url: ${req.url}`, { ip: clientIP, path: req.path, url: req.url });
                try {
                    const uid = req.user?.id ?? null;
                    const rid = req.requestId ?? '';
                    await logAction(uid, 'WAF_BLOCK', 'path_or_url', req, { request_id: rid, ip: clientIP, path: req.path, url: req.url });
                }
                catch { }
                return deny(403, 'Suspicious request blocked by WAF.', 'WAF_SUSPICIOUS_PATH');
            }
        }
        // Body check (more expensive, only for non-GET and non-whitelisted)
        if (!isWhitelisted && req.method !== 'GET' && req.body && typeof req.body === 'object') {
            try {
                const bodyStr = JSON.stringify(req.body);
                // Only check first 10KB of body for performance
                const checkStr = bodyStr.length > 10240 ? bodyStr.slice(0, 10240) : bodyStr;
                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(checkStr)) {
                        await recordViolation();
                        logger.security(`[WAF] Blocked suspicious body content`, { ip: clientIP, path: req.path });
                        try {
                            const uid = req.user?.id ?? null;
                            const rid = req.requestId ?? '';
                            await logAction(uid, 'WAF_BLOCK', 'body_content', req, { request_id: rid, ip: clientIP, path: req.path });
                        }
                        catch { }
                        return deny(403, 'Suspicious request body blocked by WAF.', 'WAF_SUSPICIOUS_BODY');
                    }
                }
            }
            catch (e) {
                // Ignore JSON stringify errors
            }
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
    };
}
export async function getWAFStats() {
    // This is now harder with Redis but we can return basic info if needed
    return {
        redisEnabled: redisService.getStatus(),
        activeBans: 'Check Redis ban:* keys'
    };
}
//# sourceMappingURL=waf.js.map
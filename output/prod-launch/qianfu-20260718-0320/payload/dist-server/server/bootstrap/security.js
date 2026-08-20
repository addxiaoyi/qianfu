import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import { logger } from '../utils/logger.js';
export function registerSecurityHeaders(app) {
    const isProdEnv = process.env.NODE_ENV === 'production';
    logger.info('Initializing Helmet with custom CSP...');
    app.use(helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
        originAgentCluster: true,
        dnsPrefetchControl: { allow: false },
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                imgSrc: ["'self'", "blob:", "data:", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://dysmsapi.aliyuncs.com", "https://graph.qq.com", "https://wpa.qq.com", "https://www.bilibili.com", "https://www.tiny.cloud"],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                scriptSrc: ["'self'", 'https://*.tinymce.com', 'https://*.tiny.cloud'],
                scriptSrcAttr: ["'none'"],
                connectSrc: ["'self'", 'https:', 'wss:'],
                frameSrc: ["'self'", 'https://*.bilibili.com', 'https://*.youtube.com', 'https://*.youku.com'],
                mediaSrc: ["'self'", 'https:', 'blob:'],
                workerSrc: ["'self'", 'blob:'],
                manifestSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: isProdEnv ? [] : null,
                frameAncestors: ["'none'"],
                reportUri: process.env.CSP_REPORT_URI || null,
            },
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        hsts: isProdEnv
            ? {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
            }
            : false,
        xContentTypeOptions: true,
        xFrameOptions: { action: 'deny' },
    }));
    app.use((_req, res, next) => {
        if (process.env.NODE_ENV === 'production') {
            res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
        }
        next();
    });
}
export function registerCors(app) {
    const allowedOrigins = getAllowedOrigins();
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.has(origin)) {
                callback(null, true);
            }
            else if (process.env.NODE_ENV === 'production') {
                logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
                // Do not throw middleware errors for CORS mismatch, otherwise clients receive 500.
                // Returning "false" lets browser enforce CORS policy without masking real API health.
                callback(null, false);
            }
            else {
                logger.debug(`[CORS] Allowing unknown origin in development: ${origin}`);
                callback(null, true);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: [
            'Content-Type',
            'X-CSRF-Token',
            'Authorization',
            'x-csrf-token',
            'anti-csrf',
            'fdi-version',
            'rid',
            'st-auth-mode',
        ],
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
        maxAge: 86400,
        optionsSuccessStatus: 204,
    }));
}
export function registerHpp(app) {
    app.use(hpp({
        whitelist: ['page', 'limit', 'sortBy', 'order', 'tags', 'category', 'status'],
    }));
}
function getAllowedOrigins() {
    const origins = new Set();
    const envOrigins = [
        ...(process.env.CORS_ALLOWED_ORIGINS?.split(',') ?? []),
        ...(process.env.CORS_ORIGIN?.split(',') ?? []),
    ]
        .map((o) => o.trim())
        .filter(Boolean);
    for (const origin of envOrigins)
        origins.add(origin);
    if (process.env.FRONTEND_URL)
        origins.add(process.env.FRONTEND_URL);
    if (process.env.PREVIEW_URL)
        origins.add(process.env.PREVIEW_URL);
    if (process.env.NODE_ENV !== 'production') {
        const localPorts = ['4123', '4137', '4173', '4177', '5173'];
        for (const port of localPorts) {
            origins.add(`http://localhost:${port}`);
            origins.add(`http://127.0.0.1:${port}`);
        }
    }
    return origins;
}
//# sourceMappingURL=security.js.map
import { logger } from '../utils/logger.js';
import { getTrustedRedirectHosts, isTrustedHost } from '../utils/securityConfig.js';
export function registerApiAccessLog(app) {
    app.use((req, _res, next) => {
        if (req.path.startsWith('/api')) {
            const isPublicRoute = req.path.startsWith('/api/public/servers') ||
                req.path.startsWith('/api/csrf-token') ||
                req.path.startsWith('/api/v1/csrf-token') ||
                req.path.startsWith('/api/auth/csrf-token') ||
                req.path.startsWith('/api/v1/auth/csrf-token') ||
                req.path.startsWith('/api/health');
            if (process.env.NODE_ENV !== 'production' || !isPublicRoute) {
                const fullUrl = req.originalUrl || req.url;
                logger.info(`[API Request] ${req.method} ${fullUrl}`, {
                    origin: req.headers.origin,
                    cookie: req.headers.cookie ? 'present' : 'missing',
                    csrf: req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'] ? 'present' : 'missing',
                    auth: req.headers.authorization ? 'present' : 'missing',
                });
            }
        }
        next();
    });
}
export function registerHttpsRedirect(app) {
    if (process.env.TRUST_PROXY === 'true') {
        app.enable('trust proxy');
    }
    app.use((req, res, next) => {
        const forceHttps = process.env.FORCE_HTTPS === 'true';
        if (forceHttps && !req.secure) {
            const host = String(req.headers.host || '').trim();
            if (!host || !isTrustedHost(host)) {
                logger.warn('[HTTPS Redirect] blocked untrusted host header', {
                    host,
                    trustedHosts: Array.from(getTrustedRedirectHosts()),
                    path: req.url,
                });
                return res.status(400).send('Invalid Host header');
            }
            const httpsUrl = `https://${host}${req.url}`;
            return res.redirect(301, httpsUrl);
        }
        return next();
    });
}
//# sourceMappingURL=httpGuards.js.map
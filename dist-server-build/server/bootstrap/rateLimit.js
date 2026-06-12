import { globalLimiter, serversLimiter, ddosBurstLimiter } from '../middleware/rateLimiter.js';
export function registerRateLimiters(app) {
    app.use('/api', ddosBurstLimiter);
    app.use('/api/public/servers', serversLimiter);
    app.use((req, res, next) => {
        const isPublicRoute = req.path.startsWith('/api/public/servers') || req.path.startsWith('/api/csrf-token') || req.path.startsWith('/auth');
        if (isPublicRoute)
            return next();
        return globalLimiter(req, res, next);
    });
}
//# sourceMappingURL=rateLimit.js.map
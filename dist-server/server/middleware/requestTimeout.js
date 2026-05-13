import { buildErrorEnvelope } from '../contracts/responseEnvelope';
import { ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
export function createRequestTimeoutMiddleware(options = {}) {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const excludePaths = options.excludePaths ?? ['/api/health'];
    return (req, res, next) => {
        const fullPath = `${req.baseUrl}${req.path}`;
        if (excludePaths.some((path) => fullPath.startsWith(path) || req.path.startsWith(path))) {
            return next();
        }
        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            req.timedout = true;
            if (res.headersSent)
                return;
            logger.warn('[RequestTimeout] request exceeded timeout threshold', {
                requestId: req.requestId,
                method: req.method,
                path: req.originalUrl || fullPath,
                timeoutMs,
            });
            res.status(504).json(buildErrorEnvelope({
                message: 'Request timed out. Please retry with a narrower scope.',
                code: ErrorCode.GATEWAY_TIMEOUT,
                statusCode: 504,
                requestId: req.requestId,
            }));
        }, timeoutMs);
        const cleanup = () => clearTimeout(timeoutId);
        res.on('finish', cleanup);
        res.on('close', cleanup);
        // Guard against downstream handlers continuing work after timeout.
        if (timedOut)
            return;
        next();
    };
}
//# sourceMappingURL=requestTimeout.js.map
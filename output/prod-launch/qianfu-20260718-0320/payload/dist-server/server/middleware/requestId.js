import { randomUUID } from 'node:crypto';
export function requestIdMiddleware(req, res, next) {
    const id = randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}
//# sourceMappingURL=requestId.js.map
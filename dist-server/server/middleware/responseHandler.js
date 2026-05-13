import { buildSuccessEnvelope, getRequestId } from '../contracts/responseEnvelope';
/**
 * API response interceptor
 * Standardizes API response format
 */
export const unifiedResponseHandler = (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
        if (data && (data.success !== undefined || !req.path.startsWith('/api'))) {
            return originalJson.call(this, data);
        }
        return originalJson.call(this, buildSuccessEnvelope(data, 'Success', getRequestId(req)));
    };
    next();
};
//# sourceMappingURL=responseHandler.js.map
// Response envelope types for the application
/**
 * Generate a request ID from a header, or fall back to a random string.
 */
export function getRequestId(reqHeader) {
    if (typeof reqHeader === 'string' && reqHeader.length > 0) {
        return reqHeader;
    }
    // Fallback to a simple random ID
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
export function buildSuccessEnvelope(data, message = 'Success', requestId, meta) {
    const payload = {
        success: true,
        message,
        data,
        requestId,
        timestamp: new Date().toISOString(),
    };
    if (meta) {
        payload.meta = meta;
    }
    return payload;
}
export function buildErrorEnvelope(input) {
    return {
        success: false,
        error: {
            message: input.message,
            code: input.code,
            statusCode: input.statusCode,
            details: input.details ?? null,
            requestId: input.requestId,
        },
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=responseEnvelope.js.map
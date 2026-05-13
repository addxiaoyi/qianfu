export function getRequestId(req) {
    return req?.requestId;
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
import { getRequestId } from './responseEnvelope';
/**
 * Standard Success Response envelope
 * Returns a plain object ready to be JSON-stringified by the caller.
 */
export function successResponse(data, message = 'Success', meta) {
    const requestId = getRequestId(undefined);
    const response = {
        success: true,
        message,
        data,
        requestId,
        timestamp: new Date().toISOString(),
    };
    if (meta) {
        response.meta = meta;
    }
    return response;
}
/**
 * Paginated Success Response envelope
 */
export function paginatedResponse(data, total, page, limit, message = 'Success') {
    const totalNum = typeof total === 'bigint' ? Number(total) : total;
    const totalPages = Math.ceil(totalNum / limit);
    return successResponse(data, message, {
        total: totalNum,
        page,
        limit,
        totalPages,
    });
}
//# sourceMappingURL=response.js.map
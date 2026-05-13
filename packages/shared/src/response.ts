import { getRequestId } from './responseEnvelope';

/**
 * Standard Success Response envelope
 * Returns a plain object ready to be JSON-stringified by the caller.
 */
export function successResponse<T>(
  data: T,
  message: string = 'Success',
  meta?: Record<string, unknown>,
): Record<string, unknown> {
  const requestId = getRequestId(undefined);
  const response: Record<string, unknown> = {
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
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message: string = 'Success',
): Record<string, unknown> {
  const totalNum = typeof total === 'bigint' ? Number(total) : total;
  const totalPages = Math.ceil(totalNum / limit);

  return successResponse<T[]>(data, message, {
    total: totalNum,
    page,
    limit,
    totalPages,
  });
}

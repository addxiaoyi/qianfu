// Response envelope types for the application

export interface ApiErrorPayload {
  message: string;
  code: string;
  statusCode: number;
  requestId?: string;
  details?: unknown;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  requestId?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorPayload;
  timestamp: string;
}

/**
 * Generate a request ID from a header, or fall back to a random string.
 */
export function getRequestId(reqHeader?: string | string[] | undefined): string {
  if (typeof reqHeader === 'string' && reqHeader.length > 0) {
    return reqHeader;
  }
  // Fallback to a simple random ID
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildSuccessEnvelope<T>(
  data: T,
  message: string = 'Success',
  requestId?: string,
  meta?: Record<string, unknown>,
): ApiSuccessEnvelope<T> {
  const payload: ApiSuccessEnvelope<T> = {
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

export function buildErrorEnvelope(
  input: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    requestId?: string;
  },
): ApiErrorEnvelope {
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

// Type aliases for convenience
export type SuccessResponse<T = unknown> = ApiSuccessEnvelope<T>;
export type ApiResponse<T = unknown> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
export type PaginatedData<T = unknown> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
export type PaginatedResponse<T = unknown> = ApiSuccessEnvelope<PaginatedData<T>>;

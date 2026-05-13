import type { Request } from 'express';

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

export function getRequestId(req?: Request): string | undefined {
  return req?.requestId;
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

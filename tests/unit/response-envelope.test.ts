import { describe, expect, it } from 'vitest';
import { buildErrorEnvelope, buildSuccessEnvelope, getRequestId } from '../../server/contracts/responseEnvelope';

describe('responseEnvelope', () => {
  it('buildSuccessEnvelope should return the unified success shape', () => {
    const payload = buildSuccessEnvelope({ id: 1 }, 'OK', 'req-1', { page: 1 });

    expect(payload.success).toBe(true);
    expect(payload.message).toBe('OK');
    expect(payload.data).toEqual({ id: 1 });
    expect(payload.requestId).toBe('req-1');
    expect(payload.meta).toEqual({ page: 1 });
    expect(typeof payload.timestamp).toBe('string');
  });

  it('buildErrorEnvelope should return the unified error shape', () => {
    const payload = buildErrorEnvelope({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      requestId: 'req-2',
      details: [{ field: 'name', message: 'required' }],
    });

    expect(payload.success).toBe(false);
    expect(payload.error.message).toBe('Validation failed');
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.statusCode).toBe(400);
    expect(payload.error.requestId).toBe('req-2');
    expect(payload.error.details).toEqual([{ field: 'name', message: 'required' }]);
    expect(typeof payload.timestamp).toBe('string');
  });

  it('getRequestId should read the express request id when present', () => {
    expect(getRequestId({ requestId: 'req-3' } as any)).toBe('req-3');
    expect(getRequestId()).toBeUndefined();
  });
});

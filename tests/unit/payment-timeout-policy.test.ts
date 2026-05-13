import { describe, expect, it } from 'vitest';
import { getPaymentExpiredBefore, resolvePaymentTimeoutMinutes } from '../../server/services/paymentTimeoutPolicy';

describe('payment timeout policy', () => {
  it('should parse positive timeout minutes from env', () => {
    expect(resolvePaymentTimeoutMinutes('30')).toBe(30);
  });

  it('should fallback to default when env value is invalid', () => {
    expect(resolvePaymentTimeoutMinutes(undefined)).toBe(15);
    expect(resolvePaymentTimeoutMinutes('0')).toBe(15);
    expect(resolvePaymentTimeoutMinutes('-8')).toBe(15);
    expect(resolvePaymentTimeoutMinutes('abc')).toBe(15);
  });

  it('should calculate expired cutoff from now and timeout', () => {
    const now = new Date('2026-04-28T10:00:00.000Z');
    const cutoff = getPaymentExpiredBefore(now, 15);
    expect(cutoff.toISOString()).toBe('2026-04-28T09:45:00.000Z');
  });
});

import { describe, expect, it } from 'vitest';
import { resolvePaymentCancelAction } from '../../server/services/paymentCancelPolicy';

describe('payment cancel policy', () => {
  it('should allow cancel when status is PENDING', () => {
    expect(resolvePaymentCancelAction('PENDING')).toBe('CANCEL');
  });

  it('should block cancel when status is COMPLETED', () => {
    expect(resolvePaymentCancelAction('COMPLETED')).toBe('ALREADY_COMPLETED');
  });

  it('should treat FAILED and EXPIRED as already processed', () => {
    expect(resolvePaymentCancelAction('FAILED')).toBe('ALREADY_PROCESSED');
    expect(resolvePaymentCancelAction('EXPIRED')).toBe('ALREADY_PROCESSED');
  });
});

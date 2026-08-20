import { describe, expect, it } from 'vitest';
import { validateCustomPaymentAmount } from '../../qianfu-liandeng/src/utils/paymentAmount';

describe('custom payment amount validation', () => {
  it('rejects amounts outside the payment page range before submission', () => {
    expect(validateCustomPaymentAmount(0.09)).toBe('自定义金额必须在 ¥0.1 至 ¥10000 之间。');
    expect(validateCustomPaymentAmount(0.1)).toBeNull();
    expect(validateCustomPaymentAmount(10000)).toBeNull();
    expect(validateCustomPaymentAmount(10000.01)).toBe('自定义金额必须在 ¥0.1 至 ¥10000 之间。');
    expect(validateCustomPaymentAmount(Number.NaN)).toBe('自定义金额必须在 ¥0.1 至 ¥10000 之间。');
  });
});

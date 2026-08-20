import { describe, expect, it } from 'vitest';

import { resolveHttpErrorMessage } from '../../qianfu-liandeng/src/api/errorMessage';

describe('frontend payment error messages', () => {
  it('keeps the payment provider diagnosis for a failed order', () => {
    expect(resolveHttpErrorMessage(
      502,
      'PAYMENT_FAILED',
      'V免签 create order failed: 监控端状态异常，请检查',
    )).toBe('V免签 create order failed: 监控端状态异常，请检查');
  });

  it('hides the internal QiuPay provider name from users', () => {
    expect(resolveHttpErrorMessage(
      502,
      'PAYMENT_FAILED',
      'QiuPay create order failed: 没有找到可用支付账号',
    )).toBe('码支付通道暂不可用，请稍后重试或联系管理员');
  });
});

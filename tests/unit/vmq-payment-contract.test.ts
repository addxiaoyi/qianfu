import { describe, expect, it } from 'vitest';
import { buildVmqCallbackSign, buildVmqOrderParams, verifyVmqCallback } from '../../server/services/vmqPayment';

describe('V免签 payment protocol', () => {
  it('builds the documented order payload for WeChat and Alipay', () => {
    const params = buildVmqOrderParams({
      payId: 'payment-123',
      type: 'wechat',
      price: 10,
      param: 'payment-123',
      key: 'test-key',
      notifyUrl: 'https://mc-u.top/api/v1/payment/qiupay/notify',
      returnUrl: 'https://mc-u.top/payment/success',
    });

    expect(params).toEqual(expect.objectContaining({
      payId: 'payment-123',
      type: '1',
      price: '10.00',
      param: 'payment-123',
      notifyUrl: 'https://mc-u.top/api/v1/payment/qiupay/notify',
      returnUrl: 'https://mc-u.top/payment/success',
    }));
    expect(params.sign).toMatch(/^[a-f0-9]{32}$/);

    const alipay = buildVmqOrderParams({
      payId: 'payment-124',
      type: 'alipay',
      price: 10,
      param: 'payment-124',
      key: 'test-key',
    });
    expect(alipay.type).toBe('2');
  });

  it('accepts only callbacks with the documented signature', () => {
    const callback = {
      payId: 'payment-123',
      param: 'payment-123',
      type: '1',
      price: '10.00',
      reallyPrice: '10.00',
    };
    const valid = buildVmqCallbackSign(callback, 'test-key');

    expect(verifyVmqCallback({ ...callback, sign: valid }, 'test-key')).toBe(true);
    expect(verifyVmqCallback({ ...callback, sign: 'bad' }, 'test-key')).toBe(false);
  });
});

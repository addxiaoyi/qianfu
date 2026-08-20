import { describe, expect, it } from 'vitest';

import {
  buildPaypalOrderPayload,
  extractPaypalWebhookPaymentId,
  parsePaypalCapture,
  resolvePaypalAmount,
} from '../../server/services/paypalPaymentService';

describe('PayPal payment service', () => {
  it('converts internal CNY fen to a fixed USD checkout amount', () => {
    expect(resolvePaypalAmount(700, 7)).toEqual({
      currency: 'USD',
      value: '1.00',
      amountFen: 700,
    });
  });

  it('rejects amounts that round to zero USD cents', () => {
    expect(() => resolvePaypalAmount(1, 7)).toThrow('too small');
  });

  it('builds a capture order tied to the internal payment id', () => {
    expect(buildPaypalOrderPayload({
      paymentId: 'qianfu_pay_1',
      amount: { currency: 'USD', value: '10.00', amountFen: 7000 },
      returnUrl: 'https://mc-u.top/api/v1/payment/paypal/return',
      cancelUrl: 'https://mc-u.top/payment/fail?orderId=qianfu_pay_1',
      description: 'mc-U wallet top-up',
    })).toEqual({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: 'qianfu_pay_1',
        custom_id: 'qianfu_pay_1',
        invoice_id: 'qianfu_pay_1',
        description: 'mc-U wallet top-up',
        amount: { currency_code: 'USD', value: '10.00' },
      }],
      application_context: {
        return_url: 'https://mc-u.top/api/v1/payment/paypal/return',
        cancel_url: 'https://mc-u.top/payment/fail?orderId=qianfu_pay_1',
        user_action: 'PAY_NOW',
      },
    });
  });

  it('accepts only a completed capture with the expected amount and order id', () => {
    expect(parsePaypalCapture({
      id: 'order_1',
      status: 'COMPLETED',
      purchase_units: [{
        reference_id: 'qianfu_pay_1',
        custom_id: 'qianfu_pay_1',
        payments: {
          captures: [{
            id: 'capture_1',
            status: 'COMPLETED',
            amount: { currency_code: 'USD', value: '10.00' },
          }],
        },
      }],
    }, 'qianfu_pay_1', { currency: 'USD', value: '10.00', amountFen: 7000 })).toEqual({
      orderId: 'order_1',
      captureId: 'capture_1',
      amountFen: 7000,
      currency: 'USD',
    });
  });

  it('extracts the local payment id from a completed capture webhook', () => {
    expect(extractPaypalWebhookPaymentId({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        custom_id: 'qianfu_pay_1',
        invoice_id: 'qianfu_pay_1',
        status: 'COMPLETED',
      },
    })).toBe('qianfu_pay_1');
  });

  it('rejects capture webhooks without a local payment id', () => {
    expect(() => extractPaypalWebhookPaymentId({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { status: 'COMPLETED' },
    })).toThrow('payment id');
  });
});

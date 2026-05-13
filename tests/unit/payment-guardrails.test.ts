import { describe, expect, it } from 'vitest';
import { evaluatePaymentGuardrails } from '../../server/services/paymentGuardrails';

const baseConfig = {
  maxPendingOrders: 3,
  dailyLimitFen: 5000,
  dailyWechatLimitFen: 3000,
  dailyAlipayLimitFen: 4000,
};

describe('payment guardrails', () => {
  it('should bypass guardrails for balance payment', () => {
    const violation = evaluatePaymentGuardrails(
      baseConfig,
      { paymentMethod: 'balance', amountFen: 500 },
      { pendingExternalOrders: 99, dailyExternalUsedFen: 99999, dailyMethodUsedFen: 99999 },
    );
    expect(violation).toBeNull();
  });

  it('should reject when pending order count reaches max', () => {
    const violation = evaluatePaymentGuardrails(
      baseConfig,
      { paymentMethod: 'wechat', amountFen: 500 },
      { pendingExternalOrders: 3, dailyExternalUsedFen: 0, dailyMethodUsedFen: 0 },
    );
    expect(violation?.type).toBe('MAX_PENDING_ORDERS');
  });

  it('should reject when total daily amount exceeds limit', () => {
    const violation = evaluatePaymentGuardrails(
      baseConfig,
      { paymentMethod: 'alipay', amountFen: 2000 },
      { pendingExternalOrders: 0, dailyExternalUsedFen: 3500, dailyMethodUsedFen: 1000 },
    );
    expect(violation?.type).toBe('DAILY_TOTAL_LIMIT');
  });

  it('should reject when method daily amount exceeds limit', () => {
    const violation = evaluatePaymentGuardrails(
      baseConfig,
      { paymentMethod: 'wechat', amountFen: 1200 },
      { pendingExternalOrders: 0, dailyExternalUsedFen: 1200, dailyMethodUsedFen: 1900 },
    );
    expect(violation?.type).toBe('DAILY_METHOD_LIMIT');
  });

  it('should pass when all limits are satisfied', () => {
    const violation = evaluatePaymentGuardrails(
      baseConfig,
      { paymentMethod: 'alipay', amountFen: 1000 },
      { pendingExternalOrders: 1, dailyExternalUsedFen: 2000, dailyMethodUsedFen: 1500 },
    );
    expect(violation).toBeNull();
  });
});

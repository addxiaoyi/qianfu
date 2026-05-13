export type ExternalPaymentMethod = 'wechat' | 'alipay';
export type PaymentMethod = ExternalPaymentMethod | 'balance';

export interface PaymentGuardrailConfig {
  maxPendingOrders: number;
  dailyLimitFen: number;
  dailyWechatLimitFen: number;
  dailyAlipayLimitFen: number;
}

export interface PaymentGuardrailUsage {
  pendingExternalOrders: number;
  dailyExternalUsedFen: number;
  dailyMethodUsedFen: number;
}

export interface PaymentGuardrailInput {
  paymentMethod: PaymentMethod;
  amountFen: number;
}

export type PaymentGuardrailViolationType =
  | 'MAX_PENDING_ORDERS'
  | 'DAILY_TOTAL_LIMIT'
  | 'DAILY_METHOD_LIMIT';

export interface PaymentGuardrailViolation {
  type: PaymentGuardrailViolationType;
  details: Record<string, number | string>;
}

export const EXTERNAL_PAYMENT_METHODS: ExternalPaymentMethod[] = ['wechat', 'alipay'];

export const isExternalPaymentMethod = (paymentMethod: PaymentMethod): paymentMethod is ExternalPaymentMethod => {
  return paymentMethod === 'wechat' || paymentMethod === 'alipay';
};

export const evaluatePaymentGuardrails = (
  config: PaymentGuardrailConfig,
  input: PaymentGuardrailInput,
  usage: PaymentGuardrailUsage,
): PaymentGuardrailViolation | null => {
  if (!isExternalPaymentMethod(input.paymentMethod)) {
    return null;
  }

  if (config.maxPendingOrders > 0 && usage.pendingExternalOrders >= config.maxPendingOrders) {
    return {
      type: 'MAX_PENDING_ORDERS',
      details: {
        pendingCount: usage.pendingExternalOrders,
        maxPending: config.maxPendingOrders,
      },
    };
  }

  if (config.dailyLimitFen > 0 && usage.dailyExternalUsedFen + input.amountFen > config.dailyLimitFen) {
    return {
      type: 'DAILY_TOTAL_LIMIT',
      details: {
        usedFen: usage.dailyExternalUsedFen,
        amountFen: input.amountFen,
        limitFen: config.dailyLimitFen,
      },
    };
  }

  const methodLimitFen = input.paymentMethod === 'wechat'
    ? config.dailyWechatLimitFen
    : config.dailyAlipayLimitFen;

  if (methodLimitFen > 0 && usage.dailyMethodUsedFen + input.amountFen > methodLimitFen) {
    return {
      type: 'DAILY_METHOD_LIMIT',
      details: {
        paymentMethod: input.paymentMethod,
        usedFen: usage.dailyMethodUsedFen,
        amountFen: input.amountFen,
        limitFen: methodLimitFen,
      },
    };
  }

  return null;
};

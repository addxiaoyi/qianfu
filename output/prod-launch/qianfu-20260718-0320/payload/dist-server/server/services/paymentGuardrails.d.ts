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
export type PaymentGuardrailViolationType = 'MAX_PENDING_ORDERS' | 'DAILY_TOTAL_LIMIT' | 'DAILY_METHOD_LIMIT';
export interface PaymentGuardrailViolation {
    type: PaymentGuardrailViolationType;
    details: Record<string, number | string>;
}
export declare const EXTERNAL_PAYMENT_METHODS: ExternalPaymentMethod[];
export declare const isExternalPaymentMethod: (paymentMethod: PaymentMethod) => paymentMethod is ExternalPaymentMethod;
export declare const evaluatePaymentGuardrails: (config: PaymentGuardrailConfig, input: PaymentGuardrailInput, usage: PaymentGuardrailUsage) => PaymentGuardrailViolation | null;
//# sourceMappingURL=paymentGuardrails.d.ts.map
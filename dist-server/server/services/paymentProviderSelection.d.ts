export type PaymentProvider = 'paypro' | 'xpay' | 'tpay' | 'hupijiao' | 'creem' | 'qiupay' | 'paypal';
export type PaymentMethod = 'wechat' | 'alipay' | 'paypal';
export interface PaymentProviderSelectionInput {
    paymentMethod: PaymentMethod;
    requestedProvider?: PaymentProvider;
    primaryProvider?: PaymentProvider;
    backupProvider?: PaymentProvider;
}
export declare const resolvePaymentProviderCandidates: ({ paymentMethod, primaryProvider, }: PaymentProviderSelectionInput) => PaymentProvider[];
//# sourceMappingURL=paymentProviderSelection.d.ts.map
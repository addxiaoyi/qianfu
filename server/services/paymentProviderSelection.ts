export type PaymentProvider = 'paypro' | 'xpay' | 'tpay' | 'hupijiao' | 'creem' | 'qiupay' | 'paypal';
export type PaymentMethod = 'wechat' | 'alipay' | 'paypal';

export interface PaymentProviderSelectionInput {
  paymentMethod: PaymentMethod;
  requestedProvider?: PaymentProvider;
  primaryProvider?: PaymentProvider;
  backupProvider?: PaymentProvider;
}

export const resolvePaymentProviderCandidates = ({
  paymentMethod,
  primaryProvider,
}: PaymentProviderSelectionInput): PaymentProvider[] => {
  if (paymentMethod === 'paypal') {
    return ['paypal'];
  }

  // A failed primary route must be visible to the operator, not silently turn
  // a WeChat/Alipay order into a different merchant channel.
  if (!primaryProvider || primaryProvider === 'paypal') return [];
  return [primaryProvider];
};

export const resolvePaymentProviderCandidates = ({ paymentMethod, primaryProvider, }) => {
    if (paymentMethod === 'paypal') {
        return ['paypal'];
    }
    // A failed primary route must be visible to the operator, not silently turn
    // a WeChat/Alipay order into a different merchant channel.
    if (!primaryProvider || primaryProvider === 'paypal')
        return [];
    return [primaryProvider];
};
//# sourceMappingURL=paymentProviderSelection.js.map
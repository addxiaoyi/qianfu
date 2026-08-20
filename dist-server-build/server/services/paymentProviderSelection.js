export const resolvePaymentProviderCandidates = ({ paymentMethod, requestedProvider, primaryProvider, backupProvider, }) => {
    if (paymentMethod === 'paypal') {
        return ['paypal'];
    }
    const candidates = [];
    for (const provider of [requestedProvider, primaryProvider, backupProvider]) {
        if (provider === 'paypal')
            continue;
        if (provider && !candidates.includes(provider)) {
            candidates.push(provider);
        }
    }
    return candidates;
};
//# sourceMappingURL=paymentProviderSelection.js.map
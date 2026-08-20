const DEFAULT_PAYMENT_TIMEOUT_MINUTES = 15;
export const resolvePaymentTimeoutMinutes = (rawTimeoutMinutes, fallback = DEFAULT_PAYMENT_TIMEOUT_MINUTES) => {
    const parsed = Number.parseInt(rawTimeoutMinutes || '', 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return fallback;
};
export const getPaymentExpiredBefore = (now, timeoutMinutes) => {
    return new Date(now.getTime() - timeoutMinutes * 60 * 1000);
};
//# sourceMappingURL=paymentTimeoutPolicy.js.map
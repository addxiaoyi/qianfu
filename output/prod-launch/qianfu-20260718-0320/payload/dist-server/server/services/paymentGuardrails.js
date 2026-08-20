export const EXTERNAL_PAYMENT_METHODS = ['wechat', 'alipay'];
export const isExternalPaymentMethod = (paymentMethod) => {
    return paymentMethod === 'wechat' || paymentMethod === 'alipay';
};
export const evaluatePaymentGuardrails = (config, input, usage) => {
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
//# sourceMappingURL=paymentGuardrails.js.map
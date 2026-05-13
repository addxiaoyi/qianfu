export const resolvePaymentCancelAction = (status) => {
    if (status === 'PENDING') {
        return 'CANCEL';
    }
    if (status === 'COMPLETED') {
        return 'ALREADY_COMPLETED';
    }
    return 'ALREADY_PROCESSED';
};
//# sourceMappingURL=paymentCancelPolicy.js.map
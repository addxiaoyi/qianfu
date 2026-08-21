const MIN_CUSTOM_PAYMENT_AMOUNT = 0.1;
const MAX_CUSTOM_PAYMENT_AMOUNT = 10000;
const INVALID_CUSTOM_PAYMENT_AMOUNT_MESSAGE = '自定义金额必须在 ¥0.1 至 ¥10000 之间。';

export const validateCustomPaymentAmount = (amount: number): string | null => {
  return !Number.isFinite(amount)
    || amount < MIN_CUSTOM_PAYMENT_AMOUNT
    || amount > MAX_CUSTOM_PAYMENT_AMOUNT
    ? INVALID_CUSTOM_PAYMENT_AMOUNT_MESSAGE
    : null;
};

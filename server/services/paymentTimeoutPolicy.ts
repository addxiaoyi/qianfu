const DEFAULT_PAYMENT_TIMEOUT_MINUTES = 15;

export const resolvePaymentTimeoutMinutes = (
  rawTimeoutMinutes: string | undefined,
  fallback: number = DEFAULT_PAYMENT_TIMEOUT_MINUTES,
): number => {
  const parsed = Number.parseInt(rawTimeoutMinutes || '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

export const getPaymentExpiredBefore = (now: Date, timeoutMinutes: number): Date => {
  return new Date(now.getTime() - timeoutMinutes * 60 * 1000);
};

export type PaymentCancelAction = 'CANCEL' | 'ALREADY_COMPLETED' | 'ALREADY_PROCESSED';

export const resolvePaymentCancelAction = (status: string): PaymentCancelAction => {
  if (status === 'PENDING') {
    return 'CANCEL';
  }
  if (status === 'COMPLETED') {
    return 'ALREADY_COMPLETED';
  }
  return 'ALREADY_PROCESSED';
};

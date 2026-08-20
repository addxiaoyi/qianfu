const GENERIC_502_MESSAGE = '后端服务未就绪，请稍后再试';
const QIUPAY_ERROR_MESSAGE = '码支付通道暂不可用，请稍后重试或联系管理员';

export const resolveHttpErrorMessage = (
  status: number,
  code: string | undefined,
  fallbackMessage: string,
): string => {
  if (status === 502 && code !== 'PAYMENT_FAILED') {
    return GENERIC_502_MESSAGE;
  }

  if (code === 'PAYMENT_FAILED' && /^QiuPay create order failed:/i.test(fallbackMessage)) {
    return QIUPAY_ERROR_MESSAGE;
  }

  return fallbackMessage;
};

import crypto from 'node:crypto';

export type VmqPaymentType = 'wechat' | 'alipay';

type VmqOrderInput = {
  payId: string;
  type: VmqPaymentType;
  price: number | string;
  param: string;
  key: string;
  notifyUrl?: string;
  returnUrl?: string;
};

type VmqCallback = {
  payId?: string;
  param?: string;
  type?: string;
  price?: string;
  reallyPrice?: string;
  sign?: string;
};

const md5 = (value: string) => crypto.createHash('md5').update(value).digest('hex');

export const buildVmqOrderParams = ({ payId, type, price, param, key, notifyUrl, returnUrl }: VmqOrderInput) => {
  const typeCode = type === 'wechat' ? '1' : '2';
  const priceText = Number(price).toFixed(2);
  const params: Record<string, string> = {
    payId,
    type: typeCode,
    price: priceText,
    param,
    sign: md5(`${payId}${param}${typeCode}${priceText}${key}`),
    isHtml: '0',
  };
  if (notifyUrl?.trim()) params.notifyUrl = notifyUrl.trim();
  if (returnUrl?.trim()) params.returnUrl = returnUrl.trim();
  return params;
};

export const verifyVmqCallback = (callback: VmqCallback, key: string) => {
  const { payId, param, type, price, reallyPrice, sign } = callback;
  if (!payId || param === undefined || !type || !price || !reallyPrice || !sign || !key) return false;
  const expected = md5(`${payId}${param}${type}${price}${reallyPrice}${key}`);
  const actual = Buffer.from(sign.toLowerCase());
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
};

export const buildVmqCallbackSign = (callback: Omit<VmqCallback, 'sign'>, key: string) => {
  const { payId, param, type, price, reallyPrice } = callback;
  return md5(`${payId || ''}${param || ''}${type || ''}${price || ''}${reallyPrice || ''}${key}`);
};

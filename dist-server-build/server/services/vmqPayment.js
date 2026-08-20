import crypto from 'node:crypto';
const md5 = (value) => crypto.createHash('md5').update(value).digest('hex');
export const buildVmqOrderParams = ({ payId, type, price, param, key, notifyUrl, returnUrl }) => {
    const typeCode = type === 'wechat' ? '1' : '2';
    const priceText = Number(price).toFixed(2);
    const params = {
        payId,
        type: typeCode,
        price: priceText,
        param,
        sign: md5(`${payId}${param}${typeCode}${priceText}${key}`),
        isHtml: '0',
    };
    if (notifyUrl?.trim())
        params.notifyUrl = notifyUrl.trim();
    if (returnUrl?.trim())
        params.returnUrl = returnUrl.trim();
    return params;
};
export const verifyVmqCallback = (callback, key) => {
    const { payId, param, type, price, reallyPrice, sign } = callback;
    if (!payId || param === undefined || !type || !price || !reallyPrice || !sign || !key)
        return false;
    const expected = md5(`${payId}${param}${type}${price}${reallyPrice}${key}`);
    const actual = Buffer.from(sign.toLowerCase());
    const wanted = Buffer.from(expected);
    return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
};
export const buildVmqCallbackSign = (callback, key) => {
    const { payId, param, type, price, reallyPrice } = callback;
    return md5(`${payId || ''}${param || ''}${type || ''}${price || ''}${reallyPrice || ''}${key}`);
};
//# sourceMappingURL=vmqPayment.js.map
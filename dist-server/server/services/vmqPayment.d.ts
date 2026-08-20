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
export declare const buildVmqOrderParams: ({ payId, type, price, param, key, notifyUrl, returnUrl }: VmqOrderInput) => Record<string, string>;
export declare const verifyVmqCallback: (callback: VmqCallback, key: string) => boolean;
export declare const buildVmqCallbackSign: (callback: Omit<VmqCallback, "sign">, key: string) => string;
export {};
//# sourceMappingURL=vmqPayment.d.ts.map
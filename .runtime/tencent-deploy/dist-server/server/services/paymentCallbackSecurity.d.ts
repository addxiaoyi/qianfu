import { Request } from 'express';
export declare const normalizeClientIp: (raw: string | null | undefined) => string | null;
export declare const parseNotifyIpAllowlist: (raw?: string) => Set<string>;
export declare const resolveNotifyIpAllowlist: (providerRaw?: string, globalRaw?: string) => Set<string>;
export declare const extractRequestClientIp: (req: Request) => string | null;
export declare const isNotifyIpAllowed: (clientIp: string | null, allowlist: Set<string>) => boolean;
export declare const buildXpayNotifyReplayKey: (params: {
    mark: string;
    dt: string;
    money: string | number;
    sign: string;
}) => string;
export declare const buildPayProNotifyReplayKey: (params: {
    orderNo: string;
    payNum: string;
    amount: string | number;
    sign: string;
}) => string;
export declare const buildQianFuNotifyReplayKey: (params: {
    outTradeNo: string;
    tradeNo?: string;
    payType?: string;
    amount?: string | number;
    money?: string | number;
    dt?: string;
    status?: string;
    payTime?: number;
    sign?: string;
}) => string;
export declare const buildTpayNotifyReplayKey: (params: {
    orderNo: string;
    xddpayOrder: string;
    money: string | number;
    result: string;
    sign: string;
}) => string;
export declare const buildHupijiaoNotifyReplayKey: (params: {
    tradeOrderId: string;
    transactionId: string;
    totalFee: string | number;
    status: string;
    hash: string;
}) => string;
//# sourceMappingURL=paymentCallbackSecurity.d.ts.map
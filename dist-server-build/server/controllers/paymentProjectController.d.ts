import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth';
declare const buildProviderReadiness: (config: any) => {
    paypro: boolean;
    xpay: boolean;
    xpayMode: "none" | "legacy" | "tenant-gateway";
    tpay: boolean;
    hupijiao: boolean;
    creem: boolean;
    paypal: boolean;
    qiupay: boolean;
};
export { buildProviderReadiness };
export declare const buildGlobalStatus: (env?: NodeJS.ProcessEnv) => {
    supportedProviders: ("paypro" | "xpay" | "tpay" | "hupijiao" | "creem" | "qiupay" | "paypal")[];
    defaults: {
        projectKey: string;
        upstreamProvider: string;
        backupUpstreamProvider: string | null;
    };
    paypro: {
        configured: boolean;
        notifyUrl: string | null;
    };
    xpay: {
        tenantGatewayConfigured: boolean;
        legacyConfigured: boolean;
        officialAlipayEnabled: boolean;
        officialWechatEnabled: boolean;
        officialAlipayVerifyEnabled: boolean;
        officialWechatVerifyEnabled: boolean;
    };
    tpay: {
        configured: boolean;
        queryConfigured: boolean;
    };
    hupijiao: {
        configured: boolean;
        backupGatewayConfigured: boolean;
        notifyConfigured: boolean;
    };
    creem: {
        configured: boolean;
        apiBaseUrl: string | null;
        returnUrl: string | null;
    };
    qiupay: {
        configured: boolean;
        notifyUrl: string | null;
        returnUrl: string | null;
    };
    paypal: {
        configured: boolean;
        returnUrl: string | null;
        mode: string;
    };
};
export declare const buildPaymentProjectConfig: (projectKey: string, body: Record<string, unknown>) => {
    key: string;
    displayName: string;
    upstreamProvider: string;
    backupUpstreamProvider: string | undefined;
    downstreamNotifyUrl: string | undefined;
    downstreamNotifySecret: string | undefined;
    bridgeNotifySecret: string | undefined;
    personalQrListenerSecret: string | undefined;
    payProApiUrl: string | undefined;
    payProOpenApiSecret: string | undefined;
    payProNotifyUrl: string | undefined;
    xpayApiUrl: string | undefined;
    xpayToken: string | undefined;
    xpayNotifyUrl: string | undefined;
    xpayGatewayBaseUrl: string | undefined;
    xpayGatewayNotifySecret: string | undefined;
    xpayTenantKey: string | undefined;
    xpayTenantCallbackSecret: string | undefined;
    creemApiBaseUrl: string | undefined;
    creemApiKey: string | undefined;
    creemWebhookSecret: string | undefined;
    creemProductId: string | undefined;
    creemReturnUrl: string | undefined;
    creemMode: string | undefined;
    creemProductMap: string | undefined;
    paypalClientId: string | undefined;
    paypalClientSecret: string | undefined;
    paypalMode: string | undefined;
    paypalApiBaseUrl: string | undefined;
    paypalReturnUrl: string | undefined;
    paypalCancelUrl: string | undefined;
    paypalExchangeRateCnyPerUsd: number | undefined;
    qiupayBaseUrl: string | undefined;
    qiupayPid: string | undefined;
    qiupayKey: string | undefined;
    qiupayNotifyUrl: string | undefined;
    qiupayReturnUrl: string | undefined;
    tpayGatewayUrl: string | undefined;
    tpayAppId: string | undefined;
    tpayAppSecret: string | undefined;
    tpayQueryUrl: string | undefined;
    hupijiaoGatewayUrl: string | undefined;
    hupijiaoBackupGatewayUrl: string | undefined;
    hupijiaoAppId: string | undefined;
    hupijiaoAppSecret: string | undefined;
    hupijiaoNotifyUrl: string | undefined;
    hupijiaoReturnUrl: string | undefined;
    hupijiaoPlugins: string | undefined;
    hupijiaoVersion: string | undefined;
};
export declare const buildQiuPayDiagnosticTests: (config: Record<string, unknown>) => {
    name: string;
    ok: boolean;
    detail: string;
}[];
export declare const listPaymentProjects: (_req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const upsertPaymentProject: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deletePaymentProject: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPaymentProjectDiagnostics: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPaymentProjectXpayTenant: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const syncPaymentProjectXpayTenant: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const uploadPaymentProjectXpayTenantQr: (req: Request & {
    file?: Express.Multer.File;
}, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createPaymentProjectTestOrder: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPaymentProjectOrder: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const simulatePaymentProjectOrderSuccess: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=paymentProjectController.d.ts.map
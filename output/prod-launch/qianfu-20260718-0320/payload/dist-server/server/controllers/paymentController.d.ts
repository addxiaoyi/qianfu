import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const PLAN_PRICES_FEN: Record<string, number>;
export declare const normalizePlanId: (planId: string) => string;
export declare const buildProjectScopedPaymentId: (projectKey: string) => string;
export declare const parseProjectKeyFromPaymentId: (paymentId: string) => string | null;
type UpstreamProvider = 'paypro' | 'xpay' | 'tpay' | 'hupijiao' | 'creem' | 'qiupay';
export declare const getPaymentProjectConfig: (projectKeyRaw?: string) => Promise<PaymentProjectConfig>;
interface PayProCreateResult {
    paymentUrl: string;
    payNum?: string;
    provider?: 'paypro';
}
interface PaymentProjectConfig {
    key: string;
    displayName: string;
    upstreamProvider: UpstreamProvider;
    backupUpstreamProvider?: UpstreamProvider;
    downstreamNotifyUrl?: string;
    downstreamNotifySecret?: string;
    bridgeNotifySecret?: string;
    personalQrListenerSecret?: string;
    payProApiUrl?: string;
    payProOpenApiSecret?: string;
    payProNotifyUrl?: string;
    xpayApiUrl?: string;
    xpayToken?: string;
    xpayNotifyUrl?: string;
    xpayGatewayBaseUrl?: string;
    xpayGatewayNotifySecret?: string;
    xpayTenantKey?: string;
    xpayTenantCallbackSecret?: string;
    creemApiBaseUrl?: string;
    creemApiKey?: string;
    creemWebhookSecret?: string;
    creemProductId?: string;
    creemReturnUrl?: string;
    qiupayBaseUrl?: string;
    qiupayPid?: string;
    qiupayKey?: string;
    qiupayNotifyUrl?: string;
    qiupayReturnUrl?: string;
    tpayGatewayUrl?: string;
    tpayAppId?: string;
    tpayAppSecret?: string;
    tpayQueryUrl?: string;
    hupijiaoGatewayUrl?: string;
    hupijiaoBackupGatewayUrl?: string;
    hupijiaoAppId?: string;
    hupijiaoAppSecret?: string;
    hupijiaoNotifyUrl?: string;
    hupijiaoReturnUrl?: string;
    hupijiaoPlugins?: string;
    hupijiaoVersion?: string;
}
type ExternalNotifyResult = 'COMPLETED' | 'ALREADY_COMPLETED' | 'NOT_FOUND' | 'AMOUNT_MISMATCH';
interface CompleteExternalPaymentOptions {
    expectedAmountFen?: number;
    metadata?: Record<string, unknown>;
    projectConfig?: PaymentProjectConfig;
}
interface TpayCreateResult {
    paymentUrl: string;
    provider: 'tpay';
    upstreamOrderId?: string;
    qrImagePath?: string;
}
interface QiuPayCreateResult {
    paymentUrl: string;
    provider: 'qiupay';
    paymentQrContent?: string;
    upstreamOrderId?: string;
    qrImagePath?: string;
}
interface CreemCreateResult {
    paymentUrl: string;
    provider: 'creem';
    upstreamOrderId?: string;
}
interface HupijiaoCreateResult {
    paymentUrl: string;
    provider: 'hupijiao';
    qrImagePath?: string;
    upstreamOrderId?: string;
}
interface XpayCreateResult {
    paymentUrl: string;
    provider: 'xpay' | 'xpay-tenant';
    tenantKey?: string;
    upstreamOrderId?: string;
    qrImagePath?: string;
    paymentQrContent?: string;
}
type ExternalCreateResult = PayProCreateResult | XpayCreateResult | TpayCreateResult | HupijiaoCreateResult | CreemCreateResult | QiuPayCreateResult;
export declare const createExternalPaymentByProvider: (req: AuthRequest, payment: {
    id: string;
    plan_id: string;
}, projectConfig: PaymentProjectConfig, amount: number, paymentMethod: "wechat" | "alipay", provider: UpstreamProvider) => Promise<ExternalCreateResult>;
/** Complete an external payment and notify configured downstream projects. */
export declare const completeExternalPayment: (paymentId: string, options?: CompleteExternalPaymentOptions) => Promise<ExternalNotifyResult>;
export declare const createPayment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const xpayNotify: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const xpayTenantNotify: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const creemWebhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const creemReturn: (req: Request, res: Response) => Promise<void>;
export declare const qiuPayNotify: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const payProNotify: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const tpayNotify: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const hupijiaoNotify: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getPaymentStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const cancelPayment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getUserPayments: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get all payments (Admin only)
 */
export declare const getAllPayments: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Manually complete a payment (Admin only)
 */
export declare const manualCompletePayment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get payment statistics (Admin only)
 */
export declare const getPaymentStats: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=paymentController.d.ts.map
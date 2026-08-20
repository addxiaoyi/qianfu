export type CreemMode = 'test' | 'production';
export type CreemProductKind = 'one_time' | 'subscription';
export interface CreemRuntimeConfig {
    projectKey: string;
    apiKey: string;
    webhookSecret: string;
    mode: CreemMode;
    returnUrl: string;
    apiBaseUrl?: string;
    productId?: string;
    productMap?: string | Record<string, unknown>;
}
export interface CreemInternalPayment {
    id: string;
    user_id: number;
    plan_id: string;
    amount: number;
    currency: string;
    status?: string;
}
export interface CreemProductSnapshot {
    id: string;
    mode: string;
    price: number;
    currency: string;
    billingType: string;
    kind: CreemProductKind;
    status: string;
}
export interface CreemCheckoutTerms {
    productId: string;
    checkoutAmount: number;
    checkoutCurrency: string;
    walletCreditAmount: number;
    walletCreditCurrency: string;
}
export interface CreemCheckoutResult {
    paymentUrl: string;
    checkoutUrl: string;
    checkout_url: string;
    provider: 'creem';
    upstreamOrderId: string;
    productId: string;
    productKind: CreemProductKind;
    mode: CreemMode;
}
export interface CreemWebhookResult {
    duplicate: boolean;
    eventId: string;
    eventType: string;
    paymentId?: string;
    status: string;
}
export interface CreemCompletionResult {
    status: string;
}
export declare const normalizeCreemMode: (value: unknown) => CreemMode | undefined;
export declare const resolveCreemApiBaseUrl: (config: CreemRuntimeConfig) => string;
export declare const resolveCreemCheckoutTerms: (config: CreemRuntimeConfig, payment: Pick<CreemInternalPayment, "plan_id" | "amount" | "currency">) => CreemCheckoutTerms;
export declare const resolveCreemWalletReversal: (input: {
    refundAmount: number;
    expectedCheckoutAmount: number;
    walletCreditAmount: number;
    reversedCheckoutAmount: number;
    reversedWalletCreditAmount: number;
}) => {
    checkoutAmount: number;
    walletCreditAmount: number;
};
export declare const resolveCreemProductId: (config: CreemRuntimeConfig, payment: Pick<CreemInternalPayment, "plan_id" | "amount" | "currency">) => string;
export declare const fetchCreemProduct: (config: CreemRuntimeConfig, productId: string) => Promise<CreemProductSnapshot>;
export declare const createCreemCheckoutSession: (input: {
    payment: CreemInternalPayment;
    userEmail: string;
    userRole: string;
    userPermissions: string;
    config: CreemRuntimeConfig;
}) => Promise<CreemCheckoutResult>;
export declare const verifyCreemWebhookSignature: (rawBody: Buffer, signature: string, secret: string) => boolean;
export declare const processCreemWebhook: (input: {
    rawBody: Buffer;
    signature: string;
    resolveConfig: (projectKey: string) => Promise<CreemRuntimeConfig>;
    completePayment: (paymentId: string, expectedAmountFen: number, config: CreemRuntimeConfig, metadata: Record<string, unknown>) => Promise<CreemCompletionResult>;
}) => Promise<CreemWebhookResult>;
export declare const cancelCreemSubscription: (input: {
    subscriptionId: string;
    userId: number;
    config: CreemRuntimeConfig;
}) => Promise<{
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEndAt: string | null;
}>;
export declare const reconcileExpiredCreemSubscriptions: () => Promise<number>;
//# sourceMappingURL=creemPaymentService.d.ts.map
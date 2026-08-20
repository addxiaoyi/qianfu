export interface PaypalRuntimeConfig {
    clientId: string;
    clientSecret: string;
    mode?: 'live' | 'sandbox';
    apiBaseUrl?: string;
    exchangeRateCnyPerUsd?: number;
    returnUrl: string;
    cancelUrl: string;
    webhookId?: string;
}
export interface PaypalAmount {
    currency: 'USD';
    value: string;
    amountFen: number;
}
interface PaypalCaptureResponse {
    id?: string;
    status?: string;
    purchase_units?: Array<{
        reference_id?: string;
        custom_id?: string;
        payments?: {
            captures?: Array<{
                id?: string;
                status?: string;
                amount?: {
                    currency_code?: string;
                    value?: string;
                };
            }>;
        };
    }>;
}
export interface PaypalWebhookEvent {
    id?: string;
    event_type?: string;
    resource?: {
        id?: string;
        custom_id?: string;
        invoice_id?: string;
        status?: string;
        amount?: {
            currency_code?: string;
            value?: string;
        };
        supplementary_data?: {
            related_ids?: {
                order_id?: string;
            };
        };
    };
}
export declare const extractPaypalWebhookPaymentId: (event: PaypalWebhookEvent) => string;
export interface PaypalCaptureResult {
    orderId: string;
    captureId: string;
    amountFen: number;
    currency: 'USD';
}
export declare const resolvePaypalAmount: (amountFen: number, exchangeRateCnyPerUsd: number) => PaypalAmount;
export declare const buildPaypalOrderPayload: (input: {
    paymentId: string;
    amount: PaypalAmount;
    returnUrl: string;
    cancelUrl: string;
    description: string;
}) => {
    intent: string;
    purchase_units: {
        reference_id: string;
        custom_id: string;
        invoice_id: string;
        description: string;
        amount: {
            currency_code: "USD";
            value: string;
        };
    }[];
    application_context: {
        return_url: string;
        cancel_url: string;
        user_action: string;
    };
};
export declare const parsePaypalCapture: (response: PaypalCaptureResponse, paymentId: string, expectedAmount: PaypalAmount) => PaypalCaptureResult;
export declare const verifyPaypalWebhookSignature: (input: {
    config: PaypalRuntimeConfig;
    webhookId: string;
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
    webhookEvent: PaypalWebhookEvent;
}) => Promise<boolean>;
export declare const createPaypalOrder: (input: {
    paymentId: string;
    amountFen: number;
    description: string;
    config: PaypalRuntimeConfig;
}) => Promise<{
    paymentUrl: string;
    upstreamOrderId: string;
    amount: PaypalAmount;
}>;
export declare const capturePaypalOrder: (input: {
    orderId: string;
    paymentId: string;
    expectedAmount: PaypalAmount;
    config: PaypalRuntimeConfig;
}) => Promise<PaypalCaptureResult>;
export {};
//# sourceMappingURL=paypalPaymentService.d.ts.map
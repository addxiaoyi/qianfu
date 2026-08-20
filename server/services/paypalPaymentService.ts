import { Buffer } from 'node:buffer';

import { AppError, ErrorCode } from '../utils/errors';

const LIVE_API_BASE_URL = 'https://api-m.paypal.com';
const SANDBOX_API_BASE_URL = 'https://api-m.sandbox.paypal.com';

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

interface PaypalOrderResponse {
  id?: string;
  status?: string;
  links?: Array<{ href?: string; rel?: string }>;
  details?: Array<{ issue?: string; description?: string }>;
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
        amount?: { currency_code?: string; value?: string };
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
    amount?: { currency_code?: string; value?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}

export const extractPaypalWebhookPaymentId = (event: PaypalWebhookEvent): string => {
  const resource = event.resource;
  const paymentId = [resource?.custom_id, resource?.invoice_id]
    .map((value) => String(value || '').trim())
    .find(Boolean);
  if (!paymentId) {
    throw new AppError('PayPal webhook payment id is missing', 400, ErrorCode.VALIDATION_ERROR);
  }
  return paymentId;
};

export interface PaypalCaptureResult {
  orderId: string;
  captureId: string;
  amountFen: number;
  currency: 'USD';
}

const parseJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
};

const resolveApiBaseUrl = (config: PaypalRuntimeConfig): string => {
  const configured = config.apiBaseUrl?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return config.mode === 'sandbox' ? SANDBOX_API_BASE_URL : LIVE_API_BASE_URL;
};

const paypalError = (operation: string, response: Response, payload: PaypalOrderResponse | null): AppError => {
  const detail = payload?.details?.[0];
  const message = detail?.description || detail?.issue || `HTTP ${response.status}`;
  return new AppError(`PayPal ${operation} failed: ${message}`, 502, ErrorCode.PAYMENT_FAILED);
};

export const resolvePaypalAmount = (amountFen: number, exchangeRateCnyPerUsd: number): PaypalAmount => {
  if (!Number.isSafeInteger(amountFen) || amountFen <= 0) {
    throw new AppError('PayPal amount must be a positive integer in fen', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (!Number.isFinite(exchangeRateCnyPerUsd) || exchangeRateCnyPerUsd <= 0) {
    throw new AppError('PayPal exchange rate is invalid', 503, ErrorCode.SERVICE_UNAVAILABLE);
  }

  const usdCents = Math.round(amountFen / exchangeRateCnyPerUsd);
  if (usdCents < 1) {
    throw new AppError('PayPal amount is too small for one USD cent', 400, ErrorCode.VALIDATION_ERROR);
  }

  return {
    currency: 'USD',
    value: (usdCents / 100).toFixed(2),
    amountFen,
  };
};

export const buildPaypalOrderPayload = (input: {
  paymentId: string;
  amount: PaypalAmount;
  returnUrl: string;
  cancelUrl: string;
  description: string;
}) => ({
  intent: 'CAPTURE',
  purchase_units: [{
    reference_id: input.paymentId,
    custom_id: input.paymentId,
    invoice_id: input.paymentId,
    description: input.description,
    amount: {
      currency_code: input.amount.currency,
      value: input.amount.value,
    },
  }],
  application_context: {
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    user_action: 'PAY_NOW',
  },
});

const parseAmountFen = (value: string): number => {
  const match = /^\d+\.\d{2}$/.exec(value);
  if (!match) throw new AppError('PayPal returned an invalid amount', 502, ErrorCode.PAYMENT_FAILED);
  const [whole, cents] = value.split('.');
  const usdCents = Number(whole) * 100 + Number(cents);
  if (!Number.isSafeInteger(usdCents)) throw new AppError('PayPal returned an invalid amount', 502, ErrorCode.PAYMENT_FAILED);
  return usdCents;
};

export const parsePaypalCapture = (
  response: PaypalCaptureResponse,
  paymentId: string,
  expectedAmount: PaypalAmount,
): PaypalCaptureResult => {
  if (response.status !== 'COMPLETED') {
    throw new AppError('PayPal order was not completed', 409, ErrorCode.PAYMENT_FAILED);
  }

  const unit = response.purchase_units?.find((item) =>
    item.reference_id === paymentId || item.custom_id === paymentId);
  const capture = unit?.payments?.captures?.find((item) => item.status === 'COMPLETED');
  const currency = capture?.amount?.currency_code;
  const value = capture?.amount?.value;
  if (!response.id || !unit || !capture?.id || currency !== expectedAmount.currency || value !== expectedAmount.value) {
    throw new AppError('PayPal capture does not match the payment', 409, ErrorCode.PAYMENT_FAILED);
  }

  parseAmountFen(value);
  return {
    orderId: response.id,
    captureId: capture.id,
    amountFen: expectedAmount.amountFen,
    currency: expectedAmount.currency,
  };
};

const getPaypalAccessToken = async (config: PaypalRuntimeConfig): Promise<string> => {
  const response = await fetch(`${resolveApiBaseUrl(config)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const payload = await parseJson<{ access_token?: string }>(response);
  if (!response.ok || !payload?.access_token) {
    throw paypalError('OAuth', response, payload as PaypalOrderResponse | null);
  }
  return payload.access_token;
};

export const verifyPaypalWebhookSignature = async (input: {
  config: PaypalRuntimeConfig;
  webhookId: string;
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookEvent: PaypalWebhookEvent;
}): Promise<boolean> => {
  const accessToken = await getPaypalAccessToken(input.config);
  const response = await fetch(`${resolveApiBaseUrl(input.config)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: input.authAlgo,
      cert_url: input.certUrl,
      transmission_id: input.transmissionId,
      transmission_sig: input.transmissionSig,
      transmission_time: input.transmissionTime,
      webhook_event: input.webhookEvent,
      webhook_id: input.webhookId,
    }),
  });
  const payload = await parseJson<{ verification_status?: string }>(response);
  if (!response.ok) throw paypalError('verify webhook signature', response, payload as PaypalOrderResponse | null);
  return payload?.verification_status === 'SUCCESS';
};

export const createPaypalOrder = async (input: {
  paymentId: string;
  amountFen: number;
  description: string;
  config: PaypalRuntimeConfig;
}): Promise<{ paymentUrl: string; upstreamOrderId: string; amount: PaypalAmount }> => {
  const amount = resolvePaypalAmount(input.amountFen, input.config.exchangeRateCnyPerUsd || 7);
  const accessToken = await getPaypalAccessToken(input.config);
  const payload = buildPaypalOrderPayload({
    paymentId: input.paymentId,
    amount,
    returnUrl: input.config.returnUrl,
    cancelUrl: input.config.cancelUrl,
    description: input.description,
  });
  const response = await fetch(`${resolveApiBaseUrl(input.config)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      'PayPal-Request-Id': input.paymentId,
    },
    body: JSON.stringify(payload),
  });
  const order = await parseJson<PaypalOrderResponse>(response);
  if (!response.ok || !order?.id) throw paypalError('create order', response, order);
  const approvalUrl = order.links?.find((link) => link.rel === 'approve')?.href;
  if (!approvalUrl) throw new AppError('PayPal did not return an approval URL', 502, ErrorCode.PAYMENT_FAILED);
  return { paymentUrl: approvalUrl, upstreamOrderId: order.id, amount };
};

export const capturePaypalOrder = async (input: {
  orderId: string;
  paymentId: string;
  expectedAmount: PaypalAmount;
  config: PaypalRuntimeConfig;
}): Promise<PaypalCaptureResult> => {
  const accessToken = await getPaypalAccessToken(input.config);
  const response = await fetch(`${resolveApiBaseUrl(input.config)}/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      'PayPal-Request-Id': `${input.paymentId}:capture`,
    },
    body: '{}',
  });
  const capture = await parseJson<PaypalCaptureResponse>(response);
  if (!response.ok || !capture) throw paypalError('capture order', response, capture as PaypalOrderResponse | null);
  return parsePaypalCapture(capture, input.paymentId, input.expectedAmount);
};

const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const LISTENER_URL = process.env.PERSONAL_QR_LISTENER_URL || 'http://127.0.0.1:3001/api/v1/payment/personal-qr/notify';
const PROJECT_KEY = process.env.PERSONAL_QR_PROJECT_KEY || process.env.XPAY_BRIDGE_PROJECT_KEY || process.env.DEFAULT_PAYMENT_PROJECT_KEY || 'qianfu';
const LISTENER_SECRET = process.env.PERSONAL_QR_LISTENER_SECRET || process.env.XPAY_BRIDGE_NOTIFY_SECRET || '';
const PROVIDER = process.env.PERSONAL_QR_PROVIDER || 'alipay';

const buildSignBase = (params) =>
  Object.keys(params)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => `${key}=${String(params[key] ?? '').trim()}`)
    .join('&');

const hmacHex = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

async function main() {
  const orderId = process.argv[2];
  const amountRaw = process.argv[3] || '1.00';
  const tradeNo = process.argv[4] || `PQR-${PROVIDER.toUpperCase()}-${Date.now()}`;

  if (!orderId) {
    console.log('Usage: node scripts/simulate-personal-qr-listener.cjs <orderId> [amount] [tradeNo]');
    console.log('Example: node scripts/simulate-personal-qr-listener.cjs qianfu_xxx 1.00 ALI-20260515-001');
    process.exit(1);
  }
  if (!LISTENER_SECRET) {
    throw new Error('PERSONAL_QR_LISTENER_SECRET or XPAY_BRIDGE_NOTIFY_SECRET is required');
  }

  const amount = Number(amountRaw).toFixed(2);
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const signPayload = {
    projectKey: PROJECT_KEY,
    orderId,
    amount,
    tradeNo,
    timestamp,
    nonce,
    status: 'SUCCESS',
    provider: PROVIDER,
  };

  const payload = {
    ...signPayload,
    remark: `order ${orderId}`,
    paidAt: new Date().toISOString(),
    listenerId: 'simulate-personal-qr-listener',
    sign: hmacHex(buildSignBase(signPayload), LISTENER_SECRET),
  };

  console.log('[personal-qr-sim] POST', LISTENER_URL);
  console.log(JSON.stringify(payload, null, 2));

  const response = await fetch(LISTENER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  console.log('[personal-qr-sim] HTTP', response.status);
  console.log(body);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[personal-qr-sim] Error:', error.message);
  process.exit(1);
});

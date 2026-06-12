const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BRIDGE_URL = process.env.XPAY_BRIDGE_NOTIFY_URL || 'http://127.0.0.1:3001/api/v1/payment/xpay-bridge/notify';
const PROJECT_KEY = process.env.XPAY_BRIDGE_PROJECT_KEY || 'qianfu';
const BRIDGE_NOTIFY_SECRET = process.env.XPAY_BRIDGE_NOTIFY_SECRET || 'replace-with-your-bridge-secret';
const DEFAULT_PROVIDER = process.env.XPAY_BRIDGE_PROVIDER || 'alipay';

const buildSignBase = (params) =>
  Object.keys(params)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => `${key}=${String(params[key] ?? '').trim()}`)
    .join('&');

const generateHexHmac = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

async function simulateBridgeNotify(orderId, amount = '10.00', tradeNo, provider = DEFAULT_PROVIDER) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(6).toString('hex');
  const safeTradeNo = tradeNo || `SIM-${provider.toUpperCase()}-${timestamp}`;
  const normalizedAmount = Number(amount).toFixed(2);

  const payload = {
    projectKey: PROJECT_KEY,
    orderId,
    amount: normalizedAmount,
    tradeNo: safeTradeNo,
    timestamp,
    nonce,
    status: 'SUCCESS',
    provider,
  };

  payload.sign = generateHexHmac(buildSignBase(payload), BRIDGE_NOTIFY_SECRET);

  console.log('--- Simulating XPay Bridge Notify ---');
  console.log('Target URL:', BRIDGE_URL);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('------------------------------------');

  const response = await fetch(BRIDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  console.log('Response status:', response.status);
  console.log('Response body:', body);
}

const orderId = process.argv[2];
const amount = process.argv[3] || '10.00';
const tradeNo = process.argv[4];
const provider = process.argv[5] || DEFAULT_PROVIDER;

if (!orderId) {
  console.log('Usage: node scripts/simulate-xpay-bridge.cjs <orderId> [amount] [tradeNo] [provider]');
  console.log('Example: node scripts/simulate-xpay-bridge.cjs tenant-order-1003 28.00 ALI-SIM-001 alipay');
  process.exit(1);
}

simulateBridgeNotify(orderId, amount, tradeNo, provider).catch((error) => {
  console.error('[xpay-bridge] Error:', error.message);
  process.exit(1);
});

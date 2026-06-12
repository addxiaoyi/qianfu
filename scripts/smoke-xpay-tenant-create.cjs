const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const XPAY_GATEWAY_BASE_URL = (process.env.XPAY_GATEWAY_BASE_URL || 'http://127.0.0.1:8888').replace(/\/+$/, '');
const XPAY_TENANT_KEY = process.env.XPAY_TENANT_KEY || 'qianfu';
const XPAY_TOKEN = process.env.XPAY_TOKEN || '';
const PAY_TYPE = process.env.XPAY_SMOKE_PAY_TYPE || 'alipay';

async function main() {
  if (!XPAY_TOKEN) {
    throw new Error('XPAY_TOKEN is required');
  }

  const orderId = `smoke_${Date.now()}`;
  const url = `${XPAY_GATEWAY_BASE_URL}/open/tenants/${encodeURIComponent(XPAY_TENANT_KEY)}/orders`;
  const payload = {
    orderId,
    outOrderId: orderId,
    payType: PAY_TYPE,
    amount: '1.00',
    subject: 'XPay tenant smoke order',
    body: 'Created by scripts/smoke-xpay-tenant-create.cjs',
    metadata: {
      source: 'qianfu-smoke',
    },
  };

  console.log('[xpay-smoke] POST', url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XPAY_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  console.log('[xpay-smoke] HTTP', response.status);
  console.log(JSON.stringify(parsed, null, 2));

  const result = parsed.data || parsed.result;
  if (!response.ok || !result?.orderId || !result?.payUrl) {
    throw new Error('XPay tenant create smoke failed');
  }

  console.log('[xpay-smoke] paymentUrl:', `${XPAY_GATEWAY_BASE_URL}${result.payUrl}`);
  if (result.paymentMethod?.qrImagePath) {
    console.log('[xpay-smoke] qrImagePath:', `${XPAY_GATEWAY_BASE_URL}${result.paymentMethod.qrImagePath}`);
  }
}

main().catch((error) => {
  console.error('[xpay-smoke] Error:', error.message);
  process.exit(1);
});

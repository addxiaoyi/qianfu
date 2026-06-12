const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const HUPIJIAO_NOTIFY_URL = process.env.HUPIJIAO_NOTIFY_URL || 'http://127.0.0.1:3000/api/v1/payment/hupijiao/notify';
const HUPIJIAO_APP_ID = process.env.HUPIJIAO_APP_ID || '';
const HUPIJIAO_APP_SECRET = process.env.HUPIJIAO_APP_SECRET || '';
const HUPIJIAO_PLUGINS = process.env.HUPIJIAO_PLUGINS || 'alipay';

const md5Lower = (value) => crypto.createHash('md5').update(value).digest('hex').toLowerCase();

const buildHash = (params, secret) => {
  const signBase = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]])
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .join('&');
  return md5Lower(`${signBase}&${secret}`);
};

async function main() {
  const tradeOrderId = process.argv[2];
  const totalFee = Number(process.argv[3] || '1').toFixed(2);
  const transactionId = process.argv[4] || `HUPI-${Date.now()}`;

  if (!tradeOrderId) {
    console.log('Usage: node scripts/simulate-hupijiao-notify.cjs <tradeOrderId> [totalFee] [transactionId]');
    process.exit(1);
  }
  if (!HUPIJIAO_APP_ID || !HUPIJIAO_APP_SECRET) {
    throw new Error('HUPIJIAO_APP_ID and HUPIJIAO_APP_SECRET are required');
  }

  const payload = {
    trade_order_id: tradeOrderId,
    total_fee: totalFee,
    transaction_id: transactionId,
    open_order_id: '',
    order_title: 'HuPiJiao simulated order',
    status: 'OD',
    plugins: HUPIJIAO_PLUGINS,
    attach: tradeOrderId,
    appid: HUPIJIAO_APP_ID,
    time: String(Math.floor(Date.now() / 1000)),
    nonce_str: crypto.randomBytes(8).toString('hex'),
  };
  payload.hash = buildHash(payload, HUPIJIAO_APP_SECRET);

  const response = await fetch(HUPIJIAO_NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log('[simulate-hupijiao-notify] HTTP', response.status);
  console.log(await response.text());
}

main().catch((error) => {
  console.error('[simulate-hupijiao-notify] Error:', error.message);
  process.exit(1);
});

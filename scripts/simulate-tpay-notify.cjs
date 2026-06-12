const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const TPAY_NOTIFY_URL = process.env.TPAY_NOTIFY_URL || 'http://127.0.0.1:3001/api/v1/payment/tpay/notify';
const TPAY_APP_ID = process.env.TPAY_APP_ID || '';
const TPAY_APP_SECRET = process.env.TPAY_APP_SECRET || '';
const TPAY_PAY_TYPE = process.env.TPAY_SIM_PAY_TYPE || '43';

const md5Upper = (value) => crypto.createHash('md5').update(value).digest('hex').toUpperCase();

const buildSign = ({ orderNo, subject, payType, money, appId, extra }, secret) =>
  md5Upper(`order_no=${orderNo}&subject=${subject}&pay_type=${payType}&money=${money}&app_id=${appId}&extra=${extra}&${secret}`);

async function main() {
  const orderNo = process.argv[2];
  const amount = Number(process.argv[3] || '1').toFixed(2);
  const xddpayOrder = process.argv[4] || `XDD-${Date.now()}`;

  if (!orderNo) {
    console.log('Usage: node scripts/simulate-tpay-notify.cjs <orderNo> [amount] [xddpayOrder]');
    process.exit(1);
  }
  if (!TPAY_APP_ID || !TPAY_APP_SECRET) {
    throw new Error('TPAY_APP_ID and TPAY_APP_SECRET are required');
  }

  const payload = {
    order_no: orderNo,
    subject: 'Tpay simulated order',
    pay_type: TPAY_PAY_TYPE,
    money: amount,
    realmoney: amount,
    result: 'success',
    xddpay_order: xddpayOrder,
    app_id: TPAY_APP_ID,
    extra: orderNo,
  };
  payload.sign = buildSign({
    orderNo: payload.order_no,
    subject: payload.subject,
    payType: payload.pay_type,
    money: payload.money,
    appId: payload.app_id,
    extra: payload.extra,
  }, TPAY_APP_SECRET);

  const response = await fetch(TPAY_NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log('[simulate-tpay-notify] HTTP', response.status);
  console.log(await response.text());
}

main().catch((error) => {
  console.error('[simulate-tpay-notify] Error:', error.message);
  process.exit(1);
});

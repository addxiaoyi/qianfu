const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const XPAY_TOKEN = process.env.XPAY_TOKEN || 'your_local_xpay_token';
const NOTIFY_URL = process.env.XPAY_NOTIFY_URL || 'http://localhost:3000/api/payment/xpay/notify';

const simulateCallback = async (orderId, amount = '10.00', type = 'wechat') => {
  const dt = Date.now().toString();
  
  // Signature logic: md5(type + money + mark + dt + token)
  const str = `${type}${amount}${orderId}${dt}${XPAY_TOKEN}`;
  const sign = crypto.createHash('md5').update(str).digest('hex');

  const payload = {
    type,
    money: amount,
    mark: orderId,
    dt,
    sign,
    account: 'test@example.com'
  };

  console.log('--- Simulating XPay Callback ---');
  console.log('Target URL:', NOTIFY_URL);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('-------------------------------');

  try {
    const response = await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', body);
    
    if (body === 'success') {
      console.log('\n[XPay] Success! Payment completed.');
    } else {
      console.log('\n[XPay] Failed! Server response:', body);
    }
  } catch (error) {
    console.error('\n[XPay] Error connecting to server:');
    console.error(error.message);
    console.log('\n[XPay] Make sure your backend server is running.');
  }
};

// Get orderId from command line
const orderId = process.argv[2];
const amount = process.argv[3] || '10.00';

if (!orderId) {
  console.log('Usage: node scripts/simulate-xpay.js <orderId> [amount]');
  console.log('Example: node scripts/simulate-xpay.js cly123456789 50.00');
  process.exit(1);
}

simulateCallback(orderId, amount);

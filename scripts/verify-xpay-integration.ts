import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function verifyXPayIntegration() {
  console.log('[XPay] Starting integration verification...');

  try {
    // Setup test user
    let user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found, creating a test user...');
      user = await prisma.user.create({
        data: {
          username: 'test_pay_user',
          email: 'test_pay@example.com',
          password_hash: 'dummy',
          display_name: 'Test Pay User'
        }
      });
    }

    // Wallet check
    let wallet = await prisma.wallet.findUnique({
      where: { user_id: user.id }
    });
    if (!wallet) {
      console.log('Creating wallet for user...');
      wallet = await prisma.wallet.create({
        data: {
          user_id: user.id,
          balance: 0
        }
      });
    }

    const initialBalance = wallet.balance;
    console.log(`Initial balance: ${initialBalance}`);

    // Create pending payment
    const amount = 10.00;
    const payment = await prisma.payment.create({
      data: {
        user_id: user.id,
        amount,
        plan_id: 'basic',
        payment_method: 'wechat',
        currency: 'CNY',
        status: 'PENDING'
      }
    });
    console.log(`Created PENDING payment: ${payment.id}`);

    // Simulate XPay Callback
    const XPAY_TOKEN = process.env.XPAY_TOKEN || 'your_local_xpay_token';
    const type = 'wechat';
    const money = amount.toFixed(2);
    const mark = payment.id;
    const dt = Date.now().toString();
    
    // Signature: md5(type + money + mark + dt + token)
    const str = `${type}${money}${mark}${dt}${XPAY_TOKEN}`;
    const sign = crypto.createHash('md5').update(str).digest('hex');

    console.log('Simulating callback to /api/payment/xpay/notify...');
    const response = await fetch('http://localhost:3000/api/payment/xpay/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        money,
        mark,
        dt,
        sign,
        account: 'test@example.com'
      })
    });

    const result = await response.text();
    console.log(`Callback response: ${result}`);

    if (result !== 'success') {
      throw new Error(`Callback failed with response: ${result}`);
    }

    // Verify integration
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id }
    });
    console.log(`Updated payment status: ${updatedPayment?.status}`);

    const updatedWallet = await prisma.wallet.findUnique({
      where: { user_id: user.id }
    });
    const finalBalance = updatedWallet?.balance || 0;
    console.log(`Final balance: ${finalBalance}`);

    if (finalBalance === initialBalance + amount) {
      console.log('[XPay] Verification successful');
    } else {
      console.error('[XPay] Verification failed: Balance not updated correctly');
    }
  } catch (error: any) {
    console.error('[XPay] Verification failed with error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyXPayIntegration();

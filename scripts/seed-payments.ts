import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding payment data...');
  
  const now = new Date();
  const days = 7;
  
  // Clear existing payments for testing
  // await prisma.payment.deleteMany();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Create 3-5 successful payments per day
    const count = Math.floor(Math.random() * 3) + 3;
    for (let j = 0; j < count; j++) {
      await prisma.payment.create({
        data: {
          user_id: 1, // Assuming user ID 1 exists
          amount: Math.floor(Math.random() * 100) + 10,
          plan_id: 'premium',
          payment_method: Math.random() > 0.5 ? 'wechat' : 'alipay',
          currency: 'CNY',
          status: 'COMPLETED',
          created_at: date,
          updated_at: date
        }
      });
    }
    
    // Create 1-2 failed/pending payments per day
    const pendingCount = Math.floor(Math.random() * 2) + 1;
    for (let j = 0; j < pendingCount; j++) {
      await prisma.payment.create({
        data: {
          user_id: 1,
          amount: Math.floor(Math.random() * 100) + 10,
          plan_id: 'basic',
          payment_method: 'wechat',
          currency: 'CNY',
          status: Math.random() > 0.5 ? 'PENDING' : 'FAILED',
          created_at: date,
          updated_at: date
        }
      });
    }
  }
  
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

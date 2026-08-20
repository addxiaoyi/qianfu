import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.USER_SERVICE_SEED_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log('user_service_seed=skipped reason=USER_SERVICE_SEED_EMAIL_not_set');
    return;
  }

  const username = process.env.USER_SERVICE_SEED_USERNAME?.trim()
    || email.split('@')[0]
    || 'seed-user';
  const role = process.env.USER_SERVICE_SEED_ROLE?.trim() || 'user';

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      username,
      role,
      is_active: true,
    },
    create: {
      email,
      username,
      role,
      email_verified: true,
      is_active: true,
      profile: { create: {} },
    },
  });

  await prisma.profile.upsert({
    where: { user_id: user.id },
    update: {},
    create: { user_id: user.id },
  });
  console.log(`user_service_seed=passed user_id=${user.id} email=${user.email}`);
}

main()
  .catch((error: unknown) => {
    console.error('user_service_seed=failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

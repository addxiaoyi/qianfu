import { pathToFileURL } from 'node:url';

const dbUrl = pathToFileURL(`${process.cwd()}/dist-server/server/db.js`).href;
const { default: prisma } = await import(dbUrl);
const email = 'smoke_owner_ui_0718@example.invalid';

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    process.stdout.write(JSON.stringify({ removed: true, alreadyAbsent: true }));
    process.exit(0);
  }

  const claims = await prisma.promoClaimRecord.findMany({
    where: { user_id: user.id },
    select: { id: true },
  });
  const claimIds = claims.map((claim) => claim.id);
  const wallet = await prisma.wallet.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.promoVerifyLog.deleteMany({
      where: {
        OR: [
          { user_id: user.id },
          ...(claimIds.length > 0 ? [{ claim_id: { in: claimIds } }] : []),
        ],
      },
    });
    await tx.promoWalletTransaction.deleteMany({ where: { user_id: user.id } });
    await tx.promoClaimRecord.deleteMany({ where: { user_id: user.id } });
    await tx.promoPlatformBinding.deleteMany({ where: { user_id: user.id } });
    if (wallet) {
      await tx.transaction.deleteMany({ where: { wallet_id: wallet.id } });
      await tx.wallet.delete({ where: { id: wallet.id } });
    }
    await tx.session.deleteMany({ where: { user_id: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  const remaining = await prisma.user.count({ where: { email } });
  process.stdout.write(JSON.stringify({ removed: remaining === 0, remaining }));
} finally {
  await prisma.$disconnect();
}

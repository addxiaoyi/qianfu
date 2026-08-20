import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
const bcrypt = require('bcrypt');

const raw = [];
for await (const chunk of process.stdin) raw.push(chunk);
const input = JSON.parse(Buffer.concat(raw).toString('utf8'));
const marker = String(input.marker ?? '');

if (!/^qfqa_[a-z0-9]{8,32}$/.test(marker)) {
  throw new Error('Invalid fixture marker');
}

const dbUrl = pathToFileURL(`${process.cwd()}/dist-server/server/db.js`).href;
const { default: prisma } = await import(dbUrl);

const emails = {
  owner: `${marker}_owner@example.invalid`,
  seller: `${marker}_seller@example.invalid`,
  buyer: `${marker}_buyer@example.invalid`,
};

const getUsers = () => prisma.user.findMany({
  where: { email: { in: Object.values(emails) } },
  select: { id: true, email: true },
});

async function cleanup() {
  const users = await getUsers();
  const userIds = users.map(({ id }) => id);
  const products = userIds.length > 0
    ? await prisma.marketplaceProduct.findMany({
        where: { creator_id: { in: userIds } },
        select: { id: true },
      })
    : [];
  const productIds = products.map(({ id }) => id);
  const orders = productIds.length > 0 || userIds.length > 0
    ? await prisma.marketplaceOrder.findMany({
        where: {
          OR: [
            ...(productIds.length > 0 ? [{ product_id: { in: productIds } }] : []),
            ...(userIds.length > 0 ? [{ buyer_id: { in: userIds } }] : []),
          ],
        },
        select: { id: true, payment_id: true },
      })
    : [];
  const orderIds = orders.map(({ id }) => id);
  const paymentIds = orders.flatMap(({ payment_id: id }) => id ? [id] : []);
  const tasks = await prisma.promoTask.findMany({
    where: {
      OR: [
        { target_id: { startsWith: marker } },
        ...(userIds.length > 0 ? [{ created_by: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const taskIds = tasks.map(({ id }) => id);
  const claims = userIds.length > 0 || taskIds.length > 0
    ? await prisma.promoClaimRecord.findMany({
        where: {
          OR: [
            ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
            ...(taskIds.length > 0 ? [{ task_id: { in: taskIds } }] : []),
          ],
        },
        select: { id: true },
      })
    : [];
  const claimIds = claims.map(({ id }) => id);
  const wallets = userIds.length > 0
    ? await prisma.wallet.findMany({ where: { user_id: { in: userIds } }, select: { id: true } })
    : [];
  const walletIds = wallets.map(({ id }) => id);

  await prisma.$transaction(async (tx) => {
    if (claimIds.length > 0 || userIds.length > 0 || taskIds.length > 0) {
      await tx.promoVerifyLog.deleteMany({
        where: {
          OR: [
            ...(claimIds.length > 0 ? [{ claim_id: { in: claimIds } }] : []),
            ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
            ...(taskIds.length > 0 ? [{ task_id: { in: taskIds } }] : []),
          ],
        },
      });
    }
    if (userIds.length > 0) {
      await tx.promoWalletTransaction.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.promoPlatformBinding.deleteMany({ where: { user_id: { in: userIds } } });
    }
    if (claimIds.length > 0) {
      await tx.promoClaimRecord.deleteMany({ where: { id: { in: claimIds } } });
    }
    if (taskIds.length > 0) {
      await tx.promoTask.deleteMany({ where: { id: { in: taskIds } } });
    }
    if (userIds.length > 0 || productIds.length > 0 || orderIds.length > 0) {
      await tx.report.deleteMany({
        where: {
          OR: [
            ...(userIds.length > 0 ? [{ reporter_id: { in: userIds } }, { handler_id: { in: userIds } }] : []),
            ...(productIds.length > 0 ? [{ target_ref: { in: productIds } }] : []),
            ...(orderIds.length > 0 ? [{ target_ref: { in: orderIds } }] : []),
          ],
        },
      });
    }
    if (orderIds.length > 0) {
      await tx.marketplaceFulfillmentLog.deleteMany({ where: { order_id: { in: orderIds } } });
      await tx.marketplaceOrder.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (productIds.length > 0) {
      await tx.marketplaceReview.deleteMany({ where: { product_id: { in: productIds } } });
      await tx.marketplaceFavorite.deleteMany({ where: { product_id: { in: productIds } } });
      await tx.marketplaceProduct.deleteMany({ where: { id: { in: productIds } } });
    }
    if (userIds.length > 0) {
      await tx.notification.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.auditLog.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.session.deleteMany({ where: { user_id: { in: userIds } } });
    }
    if (paymentIds.length > 0 || userIds.length > 0) {
      await tx.payment.deleteMany({
        where: {
          OR: [
            ...(paymentIds.length > 0 ? [{ id: { in: paymentIds } }] : []),
            ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
          ],
        },
      });
    }
    if (walletIds.length > 0) {
      await tx.transaction.deleteMany({ where: { wallet_id: { in: walletIds } } });
      await tx.wallet.deleteMany({ where: { id: { in: walletIds } } });
    }
    if (userIds.length > 0) {
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  return {
    users: await prisma.user.count({ where: { email: { in: Object.values(emails) } } }),
    products: await prisma.marketplaceProduct.count({ where: { id: { in: productIds } } }),
    orders: await prisma.marketplaceOrder.count({ where: { id: { in: orderIds } } }),
    tasks: await prisma.promoTask.count({ where: { id: { in: taskIds } } }),
    claims: await prisma.promoClaimRecord.count({ where: { id: { in: claimIds } } }),
  };
}

async function seed() {
  await cleanup();
  const roles = ['owner', 'seller', 'buyer'];
  const hashes = await Promise.all(roles.map(async (role) => {
    const password = String(input.passwords?.[role] ?? '');
    if (password.length < 20) throw new Error(`Fixture ${role} password is too short`);
    return bcrypt.hash(password, 12);
  }));

  const created = {};
  for (const [index, role] of roles.entries()) {
    const user = await prisma.user.create({
      data: {
        email: emails[role],
        username: `${marker}_${role}`,
        display_name: `Production QA ${role}`,
        password_hash: hashes[index],
        role: role === 'owner' ? 'OWNER' : 'NORMAL',
        email_verified: true,
        marketplace_seller_status: 'ACTIVE',
      },
      select: { id: true, email: true, role: true },
    });
    created[role] = user;
  }
  return created;
}

async function markPaid() {
  const orderId = String(input.orderId ?? '');
  const order = await prisma.marketplaceOrder.findUnique({ where: { id: orderId } });
  if (!order || !order.payment_id) throw new Error('Fixture order or payment is missing');
  await prisma.$transaction([
    prisma.payment.update({ where: { id: order.payment_id }, data: { status: 'COMPLETED' } }),
    prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: { status: 'PAID', payment_status: 'PAID', fulfillment_status: 'PENDING' },
    }),
  ]);
  return { orderId: order.id, paymentStatus: 'PAID' };
}

async function inspect() {
  const buyer = await prisma.user.findUnique({ where: { email: emails.buyer } });
  if (!buyer) throw new Error('Fixture buyer is missing');
  const wallet = await prisma.wallet.findUnique({ where: { user_id: buyer.id } });
  const claims = await prisma.promoClaimRecord.findMany({ where: { user_id: buyer.id } });
  const claimIds = claims.map(({ id }) => id);
  return {
    walletBalance: wallet?.balance ?? 0,
    promoTransactions: await prisma.promoWalletTransaction.count({
      where: { user_id: buyer.id, ref_id: { in: claimIds } },
    }),
    claims: claims.map(({ id, claim_status, reward_status }) => ({ id, claim_status, reward_status })),
  };
}

try {
  const actions = { cleanup, seed, 'mark-paid': markPaid, inspect };
  const action = actions[input.action];
  if (!action) throw new Error('Unknown fixture action');
  process.stdout.write(JSON.stringify(await action()));
} finally {
  await prisma.$disconnect();
}

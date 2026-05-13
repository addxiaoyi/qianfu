import prisma from '../server/db';
import { logger } from '../server/utils/logger';

async function main() {
  logger.info('[MigrateJsonFields] Starting JSON field normalization...');

  const users = await prisma.user.findMany({
    select: { id: true, permissions: true, preferences: true },
  });

  for (const user of users) {
    const updates: Record<string, unknown> = {};

    if (typeof user.permissions === 'string') {
      try {
        updates.permissions = JSON.parse(user.permissions);
      } catch {
        updates.permissions = [];
      }
    }

    if (typeof user.preferences === 'string') {
      try {
        updates.preferences = JSON.parse(user.preferences);
      } catch {
        updates.preferences = {};
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
    }
  }

  const servers = await prisma.server.findMany({
    select: { id: true, tags: true, supported_versions: true, network_env: true },
  });

  for (const server of servers) {
    const updates: Record<string, unknown> = {};

    if (typeof server.tags === 'string') {
      try {
        updates.tags = JSON.parse(server.tags);
      } catch {
        updates.tags = [];
      }
    }

    if (typeof server.supported_versions === 'string') {
      try {
        updates.supported_versions = JSON.parse(server.supported_versions);
      } catch {
        updates.supported_versions = [];
      }
    }

    if (typeof server.network_env === 'string') {
      try {
        updates.network_env = JSON.parse(server.network_env);
      } catch {
        updates.network_env = [];
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.server.update({
        where: { id: server.id },
        data: updates,
      });
    }
  }

  const transactions = await prisma.transaction.findMany({
    select: { id: true, metadata: true },
  });

  for (const tx of transactions) {
    if (typeof tx.metadata === 'string') {
      try {
        const parsed = JSON.parse(tx.metadata);
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { metadata: parsed },
        });
      } catch {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { metadata: null },
        });
      }
    }
  }

  logger.info('[MigrateJsonFields] JSON field normalization completed');
}

main()
  .catch((error) => {
    logger.error('[MigrateJsonFields] Failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

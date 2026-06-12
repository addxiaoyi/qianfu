import prisma from '../db';
import { logger } from '../utils/logger';
import { cleanupOldTickets } from '../controllers/ticketController';
import { cleanupCsrfCache } from '../middleware/csrf';
import { getPaymentExpiredBefore, resolvePaymentTimeoutMinutes } from './paymentTimeoutPolicy';

const SERVER_STATUS_HISTORY_RETENTION_DAYS = 7;
const PAYMENT_ORDER_TIMEOUT_MINUTES = resolvePaymentTimeoutMinutes(process.env.PAYMENT_ORDER_TIMEOUT_MINUTES);

type CleanupVictim = {
  id: number;
  email: string;
};

function isForeignKeyConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === 'P2003';
}

async function cleanupKnownUserDependencies(userId: number): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    const wallets = await tx.wallet.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const walletIds = wallets.map((row: { id: number }) => row.id);
    if (walletIds.length > 0) {
      await tx.transaction.deleteMany({
        where: { wallet_id: { in: walletIds } },
      });
      await tx.wallet.deleteMany({
        where: { id: { in: walletIds } },
      });
    }

    const ownedServerRows = await tx.server.findMany({
      where: { owner_id: userId },
      select: { id: true },
    });
    const ownedServerIds = ownedServerRows.map((row: { id: number }) => row.id);
    if (ownedServerIds.length > 0) {
      await tx.serverStatusHistory.deleteMany({ where: { server_id: { in: ownedServerIds } } });
      await tx.serverComment.deleteMany({ where: { server_id: { in: ownedServerIds } } });
      await tx.serverLike.deleteMany({ where: { server_id: { in: ownedServerIds } } });
      await tx.serverVersion.deleteMany({ where: { server_id: { in: ownedServerIds } } });
      await tx.serverStatus.deleteMany({ where: { serverId: { in: ownedServerIds } } });
      await tx.reviewHistory.deleteMany({ where: { server_id: { in: ownedServerIds } } });
      await tx.report.deleteMany({
        where: {
          target_type: 'SERVER',
          target_id: { in: ownedServerIds },
        },
      });
      await tx.server.deleteMany({ where: { id: { in: ownedServerIds } } });
    }

    const ownedTicketRows = await tx.ticket.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const ownedTicketIds = ownedTicketRows.map((row: { id: number }) => row.id);
    if (ownedTicketIds.length > 0) {
      await tx.ticketMessage.deleteMany({
        where: { ticket_id: { in: ownedTicketIds } },
      });
      await tx.ticket.deleteMany({
        where: { id: { in: ownedTicketIds } },
      });
    }

    await tx.ticketMessage.updateMany({
      where: { sender_id: userId },
      data: { sender_id: null },
    });
    await tx.auditLog.updateMany({
      where: { user_id: userId },
      data: { user_id: null },
    });
    await tx.moderationLog.updateMany({
      where: { user_id: userId },
      data: { user_id: null },
    });
    await tx.server.updateMany({
      where: { reviewed_by: userId },
      data: { reviewed_by: null },
    });
    await tx.report.updateMany({
      where: { handler_id: userId },
      data: { handler_id: null },
    });

    await tx.apiKey.deleteMany({ where: { user_id: userId } });
    await tx.session.deleteMany({ where: { user_id: userId } });
    await tx.notification.deleteMany({ where: { user_id: userId } });
    await tx.userBioVersion.deleteMany({ where: { user_id: userId } });
    await tx.serverComment.deleteMany({ where: { user_id: userId } });
    await tx.serverLike.deleteMany({ where: { user_id: userId } });
    await tx.reviewHistory.deleteMany({ where: { reviewer_id: userId } });
    await tx.permissionHistory.deleteMany({ where: { user_id: userId } });
    await tx.report.deleteMany({ where: { reporter_id: userId } });

    await tx.promoVerifyLog.deleteMany({ where: { user_id: userId } });
    await tx.promoWalletTransaction.deleteMany({ where: { user_id: userId } });
    await tx.promoClaimRecord.deleteMany({ where: { user_id: userId } });
    await tx.promoPlatformBinding.deleteMany({ where: { user_id: userId } });
  });
}

async function deleteVictimSafely(victim: CleanupVictim): Promise<boolean> {
  try {
    await prisma.user.delete({ where: { id: victim.id } });
    return true;
  } catch (error) {
    if (!isForeignKeyConstraintError(error)) {
      throw error;
    }
  }

  await cleanupKnownUserDependencies(victim.id);
  await prisma.user.delete({ where: { id: victim.id } });
  return true;
}

export async function cleanupExpiredUnverified(): Promise<number> {
  const now = new Date();
  const victims = await prisma.user.findMany({
    where: {
      email_verified: false,
      token_expiry: { lt: now },
    },
    select: { id: true, email: true, created_at: true, token_expiry: true },
  });
  if (victims.length === 0) return 0;

  let deletedCount = 0;
  let skippedCount = 0;
  const ts = new Date().toISOString();

  for (const v of victims) {
    try {
      await deleteVictimSafely(v);
      deletedCount += 1;
      logger.info(`[CLEANUP ${ts}] deleted unverified user id=${v.id} email=${logger.maskData(v.email)}`);
    } catch (error) {
      skippedCount += 1;
      if (isForeignKeyConstraintError(error)) {
        logger.warn(
          `[CLEANUP ${ts}] skipped unverified user id=${v.id} due to unresolved foreign-key dependencies`
        );
        continue;
      }
      logger.error(`[CLEANUP ${ts}] cleanup failed for unverified user id=${v.id}`, error);
    }
  }

  if (skippedCount > 0) {
    logger.warn(`[CLEANUP ${ts}] skipped ${skippedCount} expired-unverified users in this run`);
  }

  return deletedCount;
}

export async function cleanupExpiredPayments(): Promise<number> {
  const now = new Date();
  const expiredBefore = getPaymentExpiredBefore(now, PAYMENT_ORDER_TIMEOUT_MINUTES);
  
  const result = await prisma.payment.updateMany({
    where: {
      status: 'PENDING',
      created_at: { lt: expiredBefore },
    },
    data: {
      status: 'EXPIRED',
      updated_at: now
    }
  });
  
  if (result.count > 0) {
    logger.info(`[CLEANUP ${now.toISOString()}] marked ${result.count} expired payments as EXPIRED (timeout=${PAYMENT_ORDER_TIMEOUT_MINUTES}m)`);
  }
  return result.count;
}

export async function cleanupServerStatusHistory(): Promise<number> {
  const cutoff = new Date(Date.now() - SERVER_STATUS_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.serverStatusHistory.deleteMany({
    where: { sampled_at: { lt: cutoff } },
  });
  if (result.count > 0) {
    logger.info(
      `[CLEANUP ${new Date().toISOString()}] removed ${result.count} server status history rows older than ${SERVER_STATUS_HISTORY_RETENTION_DAYS} days`
    );
  }
  return result.count;
}

export function startCleanupScheduler(intervalMs = 60000): NodeJS.Timeout {
  return setInterval(async () => {
    cleanupExpiredUnverified().catch((err) => {
      logger.error('[CLEANUP] cleanupExpiredUnverified failed', err);
    });
    cleanupOldTickets().catch((err) => {
      logger.error('[CLEANUP] cleanupOldTickets failed', err);
    });
    cleanupExpiredPayments().catch((err) => {
      logger.error('[CLEANUP] cleanupExpiredPayments failed', err);
    });
    try {
      const removed = await cleanupCsrfCache();
      if (removed > 0) {
        logger.info(`[CLEANUP] removed ${removed} CSRF attack records from cache`);
      }
    } catch (err) {
      logger.error('[CLEANUP] cleanupCsrfCache failed', err);
    }

    cleanupServerStatusHistory().catch((err) => {
      logger.error('[CLEANUP] cleanupServerStatusHistory failed', err);
    });
  }, intervalMs);
}

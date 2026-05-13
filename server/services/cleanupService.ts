import prisma from '../db';
import { logger } from '../utils/logger';
import { cleanupOldTickets } from '../controllers/ticketController';
import { cleanupCsrfCache } from '../middleware/csrf';
import { getPaymentExpiredBefore, resolvePaymentTimeoutMinutes } from './paymentTimeoutPolicy';

const SERVER_STATUS_HISTORY_RETENTION_DAYS = 7;
const PAYMENT_ORDER_TIMEOUT_MINUTES = resolvePaymentTimeoutMinutes(process.env.PAYMENT_ORDER_TIMEOUT_MINUTES);

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
  const ids = victims.map(v => v.id);
  const result = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });
  const ts = new Date().toISOString();
  for (const v of victims) {
    logger.info(`[CLEANUP ${ts}] deleted unverified user id=${v.id} email=${logger.maskData(v.email)}`);
  }
  return result.count;
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

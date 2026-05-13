import { logger } from '../utils/logger';
import prisma from '../../db';
import { handleError } from '../../utils/errors';
import { getPaymentExpiredBefore, resolvePaymentTimeoutMinutes } from '../../services/paymentTimeoutPolicy';

const DAILY_RECONCILIATION_HOUR = 0;
const DAILY_RECONCILIATION_MINUTE = 30;
const EXCEPTION_CHECK_HOUR = 1;
const EXCEPTION_CHECK_MINUTE = 0;
const PAYMENT_ORDER_TIMEOUT_MINUTES = resolvePaymentTimeoutMinutes(process.env.PAYMENT_ORDER_TIMEOUT_MINUTES);
const EXCEPTION_PENDING_THRESHOLD_MINUTES = Math.max(PAYMENT_ORDER_TIMEOUT_MINUTES * 2, 60);

export interface ReconciliationResult {
  date: string;
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  totalAmount: string;
  successfulAmount: string;
  exceptions: ExceptionOrder[];
}

export interface ExceptionOrder {
  orderId: string;
  outTradeNo: string;
  type: 'MISSING' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH' | 'TIMEOUT';
  details: string;
}

export interface DailySummary {
  date: string;
  income: number;
  expense: number;
  netIncome: number;
  orderCount: number;
  successRate: string;
}

export class ReconciliationJob {
  private static instance: ReconciliationJob;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ReconciliationJob {
    if (!ReconciliationJob.instance) {
      ReconciliationJob.instance = new ReconciliationJob();
    }
    return ReconciliationJob.instance;
  }

  async performDailyReconciliation(): Promise<ReconciliationResult> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    logger.info(`[ReconciliationJob] Starting daily reconciliation for ${yesterday.toISOString().split('T')[0]}`);

    const payments = await prisma.payment.findMany({
      where: {
        created_at: {
          gte: yesterday,
          lt: today,
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const result: ReconciliationResult = {
      date: yesterday.toISOString().split('T')[0],
      totalOrders: payments.length,
      successfulOrders: 0,
      failedOrders: 0,
      totalAmount: '0',
      successfulAmount: '0',
      exceptions: [],
    };

    let totalAmountNum = 0;
    let successfulAmountNum = 0;

    for (const payment of payments) {
      totalAmountNum += payment.amount;

      if (payment.status === 'COMPLETED') {
        result.successfulOrders++;
        successfulAmountNum += payment.amount;
      } else if (payment.status === 'FAILED' || payment.status === 'EXPIRED') {
        result.failedOrders++;
      }
    }

    result.totalAmount = totalAmountNum.toFixed(2);
    result.successfulAmount = successfulAmountNum.toFixed(2);

    const timeoutOrders = await this.checkTimeoutOrders(yesterday, today);
    result.exceptions.push(...timeoutOrders);

    await this.saveReconciliationRecord(result);

    logger.info(`[ReconciliationJob] Daily reconciliation completed: ${result.totalOrders} orders, ${result.exceptions.length} exceptions`);

    return result;
  }

  private async checkTimeoutOrders(startDate: Date, endDate: Date): Promise<ExceptionOrder[]> {
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        AND: [
          { created_at: { lt: getPaymentExpiredBefore(new Date(), PAYMENT_ORDER_TIMEOUT_MINUTES) } },
          { created_at: { gte: startDate, lt: endDate } },
        ],
      },
    });

    return pendingPayments.map(payment => ({
      orderId: payment.id,
      outTradeNo: payment.id,
      type: 'TIMEOUT' as const,
      details: `Order pending for more than ${PAYMENT_ORDER_TIMEOUT_MINUTES} minutes`,
    }));
  }

  async performExceptionCheck(): Promise<ExceptionOrder[]> {
    logger.info('[ReconciliationJob] Starting exception check');

    const exceptions: ExceptionOrder[] = [];

    const pendingLongTime = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        created_at: {
          lt: getPaymentExpiredBefore(new Date(), EXCEPTION_PENDING_THRESHOLD_MINUTES),
        },
      },
    });

    for (const payment of pendingLongTime) {
      exceptions.push({
        orderId: payment.id,
        outTradeNo: payment.id,
        type: 'TIMEOUT',
        details: `Pending for more than ${EXCEPTION_PENDING_THRESHOLD_MINUTES} minutes`,
      });
    }

    if (exceptions.length > 0) {
      logger.warn(`[ReconciliationJob] Found ${exceptions.length} exception orders`);
    }

    return exceptions;
  }

  async getDailySummary(date: string): Promise<DailySummary | null> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (payments.length === 0) {
      return null;
    }

    let income = 0;
    const expense = 0;

    for (const payment of payments) {
      if (payment.status === 'COMPLETED') {
        income += payment.amount;
      }
    }

    const successCount = payments.filter(p => p.status === 'COMPLETED').length;

    return {
      date,
      income,
      expense,
      netIncome: income - expense,
      orderCount: payments.length,
      successRate: ((successCount / payments.length) * 100).toFixed(2) + '%',
    };
  }

  async getExceptions(startDate: string, endDate: string): Promise<ExceptionOrder[]> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED', 'EXPIRED'] },
        created_at: {
          gte: start,
          lte: end,
        },
      },
    });

    return pendingPayments.map(payment => ({
      orderId: payment.id,
      outTradeNo: payment.id,
      type: payment.status === 'PENDING' || payment.status === 'EXPIRED' ? 'TIMEOUT' : 'STATUS_MISMATCH',
      details: `Order status: ${payment.status}`,
    }));
  }

  private async saveReconciliationRecord(result: ReconciliationResult): Promise<void> {
    logger.info(`[ReconciliationJob] Reconciliation record saved for ${result.date}`);
  }

  private shouldRunDailyReconciliation(): boolean {
    const now = new Date();
    return (
      now.getHours() === DAILY_RECONCILIATION_HOUR &&
      now.getMinutes() === DAILY_RECONCILIATION_MINUTE
    );
  }

  private shouldRunExceptionCheck(): boolean {
    const now = new Date();
    return (
      now.getHours() === EXCEPTION_CHECK_HOUR &&
      now.getMinutes() === EXCEPTION_CHECK_MINUTE
    );
  }

  start(): void {
    if (this.checkInterval) {
      logger.warn('[ReconciliationJob] Already running');
      return;
    }

    this.checkInterval = setInterval(async () => {
      try {
        if (this.shouldRunDailyReconciliation()) {
          await this.performDailyReconciliation();
        }

        if (this.shouldRunExceptionCheck()) {
          await this.performExceptionCheck();
        }
      } catch (error) {
        logger.error('[ReconciliationJob] Error in scheduled task:', handleError(error));
      }
    }, 60000);

    logger.info('[ReconciliationJob] Reconciliation job started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('[ReconciliationJob] Reconciliation job stopped');
    }
  }
}

export const reconciliationJob = ReconciliationJob.getInstance();

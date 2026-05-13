import crypto from 'crypto';
import prisma from '../db';
import { fenToYuanNumber } from '../utils/currency';

// SECURITY: WALLET_SECRET is critical for transaction integrity
// In production, this MUST be set via environment variable
const HMAC_SECRET = (() => {
  const secret = process.env.WALLET_SECRET;
  if (secret) return secret;

  // Development fallback: generate a random secret so each restart has a different key
  // This prevents accidental reuse of a known default value
  const fallback = crypto.randomBytes(32).toString('hex');
  console.warn(`[Wallet] WARNING: Using randomly-generated WALLET_SECRET fallback in development. Set WALLET_SECRET in production!`);
  return fallback;
})();

/**
 * Generates an HMAC signature for a transaction to ensure integrity.
 */
export function generateTransactionSignature(transaction: {
  id: number;
  walletId: number;
  amount: number;
  type: string;
  status: string;
  createdAt: Date;
}): string {
  // Amount is stored internally in fen; keep the raw integer string in signatures
  const amountStr = String(transaction.amount);
  // Use timestamp instead of full ISO string to avoid format inconsistencies
  const timestamp = Math.floor(transaction.createdAt.getTime() / 1000);
  const data = `${transaction.id}:${transaction.walletId}:${amountStr}:${transaction.type}:${transaction.status}:${timestamp}`;
  return crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}

/**
 * Verifies if a transaction has been tampered with.
 */
export function verifyTransactionIntegrity(transaction: any): boolean {
  if (!transaction.signature) return false;
  const expectedSignature = generateTransactionSignature(transaction);
  return expectedSignature === transaction.signature;
}

/**
 * Ensures a wallet exists for the user.
 */
export async function ensureWallet(userId: number) {
  let wallet = await prisma.wallet.findUnique({
    where: { user_id: userId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        user_id: userId,
        balance: 0, // Int (fen)
        currency: 'CNY',
      },
    });
  }
  return wallet;
}

export type WalletBalanceBreakdown = {
  totalBalance: number;
  withdrawableBalance: number;
  nonWithdrawableBalance: number;
  currency: string;
};

/**
 * 计算钱包余额拆分：
 * - nonWithdrawableBalance: 签到奖励累计（当前规则不可提现）
 * - withdrawableBalance: total - nonWithdrawable
 * Note: Returns yuan values for API responses, internal storage is in fen
 */
export async function getWalletBalanceBreakdown(userId: number): Promise<WalletBalanceBreakdown> {
  const wallet = await ensureWallet(userId);

  const aggregate = await prisma.transaction.aggregate({
    where: {
      wallet_id: wallet.id,
      status: 'COMPLETED',
      type: 'CHECKIN_REWARD',
      amount: { gt: 0 },
    },
    _sum: {
      amount: true,
    },
  });

  // Internal values are in fen, convert to yuan for API response
  const totalBalance = fenToYuanNumber(wallet.balance);
  const nonWithdrawableRaw = fenToYuanNumber(aggregate._sum.amount ?? 0);
  const nonWithdrawableBalance = Math.min(totalBalance, Math.max(0, nonWithdrawableRaw));
  const withdrawableBalance = fenToYuanNumber(Math.max(0, wallet.balance - (aggregate._sum.amount ?? 0)));

  return {
    totalBalance,
    withdrawableBalance,
    nonWithdrawableBalance,
    currency: wallet.currency,
  };
}

import { redisService } from '../services/redisService';

/**
 * Deposits funds into a user's wallet.
 * Creates a transaction record and updates balance atomically.
 * @param amount Amount in yuan (will be converted to fen for storage)
 */
export async function deposit(
  userId: number,
  amount: number,
  description: string = 'Recharge',
  options?: { type?: 'DEPOSIT' | 'CHECKIN_REWARD' | 'REDEEM_CODE'; metadata?: Record<string, unknown> }
) {
  if (amount <= 0) throw new Error('Amount must be positive');
  // Convert yuan to fen for storage
  const amountFen = Math.round(amount * 100);

  return await redisService.withLock(`wallet:deposit:${userId}`, async () => {
    return await prisma.$transaction(async (tx) => {
      // 1. Ensure wallet exists then get wallet
      await tx.wallet.upsert({
        where: { user_id: userId },
        create: { user_id: userId, balance: 0, currency: 'CNY' },
        update: {},
      });
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { user_id: userId },
      });

      // 2. Create Transaction (Pending)
      const transaction = await tx.transaction.create({
        data: {
          wallet_id: wallet.id,
          amount: amountFen, // Int (fen)
          type: options?.type ?? 'DEPOSIT',
          status: 'PENDING',
          description,
          metadata: options?.metadata ? JSON.stringify(options.metadata) : undefined,
        },
      });

      // 3. Update Balance (increment by fen amount)
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amountFen },
        },
      });

      // 4. Update Transaction to Completed and Sign
      const completedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
        },
      });

      // 5. Generate Signature
      const signature = generateTransactionSignature({
        id: completedTransaction.id,
        walletId: completedTransaction.wallet_id,
        amount: completedTransaction.amount,
        type: completedTransaction.type,
        status: completedTransaction.status,
        createdAt: completedTransaction.created_at,
      });

      // 6. Save Signature
      await tx.transaction.update({
        where: { id: completedTransaction.id },
        data: { signature },
      });

      return updatedWallet;
    });
  });
}

/**
 * Deducts funds from a user's wallet.
 * Ensures sufficient balance.
 * @param amount Amount in yuan (will be converted to fen for storage)
 */
export async function pay(userId: number, amount: number, description: string = 'Payment') {
  if (amount <= 0) throw new Error('Amount must be positive');
  // Convert yuan to fen for storage
  const amountFen = Math.round(amount * 100);

  return await redisService.withLock(`wallet:pay:${userId}`, async () => {
    return await prisma.$transaction(async (tx) => {
      // 1. Get wallet
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { user_id: userId },
      });

      const nonWithdrawableAgg = await tx.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          status: 'COMPLETED',
          type: 'CHECKIN_REWARD',
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      });
      // Balance is in fen, nonWithdrawableAgg._sum.amount is also in fen
      const nonWithdrawable = nonWithdrawableAgg._sum.amount ?? 0;
      const withdrawable = Math.max(0, wallet.balance - nonWithdrawable);

      if (withdrawable < amountFen) {
        throw new Error('Insufficient withdrawable balance');
      }

      // 2. Create Transaction (Pending)
      const transaction = await tx.transaction.create({
        data: {
          wallet_id: wallet.id,
          amount: -amountFen, // Negative for deduction (in fen)
          type: 'PAYMENT',
          status: 'PENDING',
          description,
        },
      });

      // 3. Update Balance safely
      // Use updateMany to ensure atomicity with condition
      const updateResult = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          balance: { gte: amountFen } // Ensure sufficient balance at moment of update (in fen)
        },
        data: {
          balance: { decrement: amountFen },
        },
      });

      if (updateResult.count === 0) {
        throw new Error('Insufficient balance or wallet not found');
      }

      // Fetch updated wallet to return
      const updatedWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id }
      });

      // 4. Update Transaction to Completed and Sign
      const completedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
        },
      });

      // 5. Generate Signature
      const signature = generateTransactionSignature({
        id: completedTransaction.id,
        walletId: completedTransaction.wallet_id,
        amount: completedTransaction.amount,
        type: completedTransaction.type,
        status: completedTransaction.status,
        createdAt: completedTransaction.created_at,
      });

      // 6. Save Signature
      await tx.transaction.update({
        where: { id: completedTransaction.id },
        data: { signature },
      });

      return updatedWallet;
    });
  });
}

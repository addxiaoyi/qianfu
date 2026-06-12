import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  generateTransactionSignature,
  verifyTransactionIntegrity,
  ensureWallet,
  deposit,
  pay,
} from '../../server/lib/wallet.js';
import { redisService } from '../../server/services/redisService.js';
import prisma from '../../server/db';

// Mock modules
vi.mock('../../server/db', () => ({
  default: {
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../server/services/redisService', () => ({
  redisService: {
    withLock: vi.fn(async (_, fn) => fn()),
  },
}));

// Re-import after mocking
const mockPrisma = prisma as any;
const mockWithLock = redisService.withLock as any;

// ============================================================
// generateTransactionSignature
// ============================================================

describe('generateTransactionSignature', () => {
  it('should produce a consistent hex signature', () => {
    const tx = {
      id: 1,
      walletId: 100,
      amount: 5000,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    const sig = generateTransactionSignature(tx);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('should differ for different transactions', () => {
    const tx1 = {
      id: 1,
      walletId: 100,
      amount: 5000,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    const tx2 = {
      id: 2,
      walletId: 100,
      amount: 5000,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    expect(generateTransactionSignature(tx1)).not.toBe(generateTransactionSignature(tx2));
  });
});

// ============================================================
// verifyTransactionIntegrity
// ============================================================

describe('verifyTransactionIntegrity', () => {
  it('should return true for a valid transaction with signature', () => {
    const tx = {
      id: 1,
      walletId: 100,
      amount: 5000,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      signature: generateTransactionSignature({
        id: 1,
        walletId: 100,
        amount: 5000,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }),
    };
    expect(verifyTransactionIntegrity(tx)).toBe(true);
  });

  it('should return false when signature is missing', () => {
    const tx = {
      id: 1,
      walletId: 100,
      amount: 5000,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    expect(verifyTransactionIntegrity(tx)).toBe(false);
  });

  it('should return false when signature is tampered', () => {
    const tx = {
      id: 1,
      walletId: 100,
      amount: 5000,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      signature: 'tampered_signature_value',
    };
    expect(verifyTransactionIntegrity(tx)).toBe(false);
  });
});

// ============================================================
// ensureWallet
// ============================================================

describe('ensureWallet', () => {
  afterEach(() => vi.clearAllMocks());

  it('should return existing wallet when it exists', async () => {
    const existingWallet = { id: 1, user_id: 42, balance: 1000, currency: 'CNY' };
    mockPrisma.wallet.findUnique.mockResolvedValue(existingWallet);

    const result = await ensureWallet(42);

    expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
      where: { user_id: 42 },
    });
    expect(result).toBe(existingWallet);
    expect(mockPrisma.wallet.create).not.toHaveBeenCalled();
  });

  it('should create wallet when user does not have one', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(null);
    const newWallet = { id: 99, user_id: 42, balance: 0, currency: 'CNY' };
    mockPrisma.wallet.create.mockResolvedValue(newWallet);

    const result = await ensureWallet(42);

    expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
      where: { user_id: 42 },
    });
    expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
      data: { user_id: 42, balance: 0, currency: 'CNY' },
    });
    expect(result).toBe(newWallet);
  });
});

// ============================================================
// deposit
// ============================================================

describe('deposit', () => {
  afterEach(() => vi.clearAllMocks());

  it('should throw for non-positive amount', async () => {
    await expect(deposit(1, 0)).rejects.toThrow('Amount must be positive');
    await expect(deposit(1, -10)).rejects.toThrow('Amount must be positive');
  });

  it('should deposit with lock and transaction', async () => {
    mockWithLock.mockImplementation(async (_, fn) => fn());

    const updatedWallet = { id: 1, user_id: 1, balance: 10000, currency: 'CNY' };
    mockPrisma.$transaction.mockImplementation(async (_fn: any) => {
      // Simulate the transaction flow
      mockPrisma.wallet.upsert.mockResolvedValue({ id: 1, user_id: 1, balance: 0, currency: 'CNY' });
      mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue({ id: 1, user_id: 1, balance: 0, currency: 'CNY' });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 1, wallet_id: 1, amount: 5000, type: 'DEPOSIT', status: 'PENDING',
        description: 'Recharge', created_at: new Date(),
      });
      mockPrisma.wallet.update.mockResolvedValue(updatedWallet);

      return updatedWallet;
    });

    const result = await deposit(1, 50, 'Recharge');

    expect(mockWithLock).toHaveBeenCalledWith('wallet:deposit:1', expect.any(Function));
    expect(result).toBe(updatedWallet);
  });

  it('should support optional type and metadata', async () => {
    mockWithLock.mockImplementation(async (_, fn) => fn());

    const updatedWallet = { id: 1, user_id: 1, balance: 10000, currency: 'CNY' };
    mockPrisma.$transaction.mockImplementation(async (_fn: any) => {
      mockPrisma.wallet.upsert.mockResolvedValue({ id: 1, user_id: 1, balance: 0, currency: 'CNY' });
      mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue({ id: 1, user_id: 1, balance: 0, currency: 'CNY' });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 1, wallet_id: 1, amount: 1000, type: 'CHECKIN_REWARD', status: 'PENDING',
        description: 'Daily check-in', created_at: new Date(),
        metadata: JSON.stringify({ day: 5 }),
      });
      mockPrisma.wallet.update.mockResolvedValue(updatedWallet);
      mockPrisma.transaction.update.mockResolvedValue({
        id: 1, wallet_id: 1, amount: 1000, type: 'CHECKIN_REWARD', status: 'COMPLETED',
        description: 'Daily check-in', created_at: new Date(), signature: 'sig123',
      });

      return updatedWallet;
    });

    await deposit(1, 10, 'Daily check-in', {
      type: 'CHECKIN_REWARD',
      metadata: { day: 5 },
    });

    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CHECKIN_REWARD',
          metadata: JSON.stringify({ day: 5 }),
        }),
      })
    );
  });
});

// ============================================================
// pay
// ============================================================

describe('pay', () => {
  afterEach(() => vi.clearAllMocks());

  it('should throw for non-positive amount', async () => {
    await expect(pay(1, 0)).rejects.toThrow('Amount must be positive');
    await expect(pay(1, -5)).rejects.toThrow('Amount must be positive');
  });

  it('should pay with sufficient withdrawable balance', async () => {
    mockWithLock.mockImplementation(async (_, fn) => fn());

    const wallet = { id: 1, user_id: 1, balance: 10000, currency: 'CNY' };
    const updatedWallet = { ...wallet, balance: 5000 };
    const completedTx = {
      id: 1, wallet_id: 1, amount: -5000, type: 'PAYMENT', status: 'COMPLETED',
      description: 'Payment', created_at: new Date(), signature: 'sig123',
    };

    mockPrisma.$transaction.mockImplementation(async (_fn: any) => {
      mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue(wallet);
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 1, wallet_id: 1, amount: -5000, type: 'PAYMENT', status: 'PENDING',
        description: 'Payment', created_at: new Date(),
      });
      mockPrisma.wallet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue(updatedWallet);
      mockPrisma.transaction.update.mockResolvedValue(completedTx);

      return updatedWallet;
    });

    const result = await pay(1, 50, 'Payment');

    expect(result).toBe(updatedWallet);
    expect(mockPrisma.wallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          balance: { gte: 5000 },
        }),
      })
    );
  });

  it('should throw when withdrawable balance is insufficient', async () => {
    mockWithLock.mockImplementation(async (_, fn) => fn());

    const wallet = { id: 1, user_id: 1, balance: 1000, currency: 'CNY' };
    mockPrisma.$transaction.mockImplementation(async (_fn: any) => {
      mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue(wallet);
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 1, wallet_id: 1, amount: -5000, type: 'PAYMENT', status: 'PENDING',
        description: 'Payment', created_at: new Date(),
      });
      mockPrisma.wallet.updateMany.mockResolvedValue({ count: 0 });

      return undefined;
    });

    await expect(pay(1, 50, 'Payment')).rejects.toThrow('Insufficient balance or wallet not found');
  });

  it('should respect nonWithdrawable (checkin reward) balance in pay', async () => {
    mockWithLock.mockImplementation(async (_, fn) => fn());

    const wallet = { id: 1, user_id: 1, balance: 10000, currency: 'CNY' };
    // 6000 fen from checkin rewards = nonWithdrawable
    mockPrisma.$transaction.mockImplementation(async (_fn: any) => {
      mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue(wallet);
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 6000 } });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 1, wallet_id: 1, amount: -4000, type: 'PAYMENT', status: 'PENDING',
        description: 'Payment', created_at: new Date(),
      });
      mockPrisma.wallet.updateMany.mockResolvedValue({ count: 0 });

      return undefined;
    });

    // withdrawable = 10000 - 6000 = 4000 fen = 40 yuan
    // paying 41 yuan = 4100 fen > 4000 fen => should fail
    await expect(pay(1, 41, 'Payment')).rejects.toThrow('Insufficient balance or wallet not found');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/lib/wallet', () => ({
  generateTransactionSignature: vi.fn(() => 'a'.repeat(64)),
}));

import { creditCheckinRewardInTransaction } from '../../server/services/checkinRewardSettlementService';

describe('creditCheckinRewardInTransaction', () => {
  it('credits the wallet and stores a completed signed check-in transaction', async () => {
    const createdAt = new Date('2026-08-05T00:00:00.000Z');
    const tx = {
      wallet: {
        upsert: vi.fn().mockResolvedValue(undefined),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 7, user_id: 42, balance: 0, currency: 'CNY' }),
        update: vi.fn().mockResolvedValue({ id: 7, user_id: 42, balance: 58, currency: 'CNY' }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({
          id: 9,
          wallet_id: 7,
          amount: 58,
          type: 'CHECKIN_REWARD',
          status: 'COMPLETED',
          created_at: createdAt,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    const wallet = await creditCheckinRewardInTransaction(tx, {
      userId: 42,
      amountYuan: 0.58,
      checkinDate: '2026-08-05',
      checkinHistoryId: 12,
      metadata: { streakDays: 3 },
    });

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { balance: { increment: 58 } },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        wallet_id: 7,
        amount: 58,
        type: 'CHECKIN_REWARD',
        status: 'COMPLETED',
      }),
    }));
    expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { signature: expect.stringMatching(/^[a-f0-9]{64}$/) },
    }));
    expect(wallet.balance).toBe(58);
  });

  it('rejects rewards that cannot be represented as a positive fen amount', async () => {
    await expect(creditCheckinRewardInTransaction({} as any, {
      userId: 42,
      amountYuan: 0,
      checkinDate: '2026-08-05',
      checkinHistoryId: 12,
      metadata: {},
    })).rejects.toThrow('Check-in reward must be positive');
  });
});

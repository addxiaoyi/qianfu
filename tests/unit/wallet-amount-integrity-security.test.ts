import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({
  default: {
    wallet: {},
    transaction: {},
    $transaction: vi.fn(),
  },
}));

const { withLock } = vi.hoisted(() => ({ withLock: vi.fn() }));
vi.mock('../../server/services/redisService', () => ({
  redisService: { withLock },
}));

import {
  deposit,
  generateTransactionSignature,
  pay,
  verifyTransactionIntegrity,
} from '../../server/lib/wallet';
import { isExactYuanAmount, parseAmount, yuanToFen } from '../../server/utils/currency';
import {
  adminCreateRedeemCodeSchema,
  adminGenerateRedeemCodeSchema,
  paymentCreateSchema,
  walletRechargeSchema,
} from '../../server/utils/validation';

const VALID_TRANSACTION = {
  id: 7,
  walletId: 11,
  amount: 1001,
  type: 'DEPOSIT',
  status: 'COMPLETED',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('wallet integer amount boundary', () => {
  beforeEach(() => {
    withLock.mockReset();
  });

  it('converts exact yuan values to fen without rounding sub-fen input', () => {
    expect(yuanToFen('10.01')).toBe(1001);
    expect(yuanToFen('0.10')).toBe(10);
    expect(yuanToFen(19.99)).toBe(1999);
    expect(yuanToFen(0.1 + 0.2)).toBe(30);
    expect(parseAmount('0.00')).toBe(0);

    expect(() => yuanToFen('1.005')).toThrow('Invalid yuan amount or precision');
    expect(() => yuanToFen(1.005)).toThrow('resolve exactly to fen');
    expect(() => yuanToFen(Number.NaN)).toThrow('Invalid yuan amount');
    expect(() => yuanToFen(Number.POSITIVE_INFINITY)).toThrow('Invalid yuan amount');
    expect(() => yuanToFen('1e2')).toThrow('Invalid yuan amount or precision');
    expect(() => parseAmount('-0.01')).toThrow('Invalid amount');
    expect(isExactYuanAmount('12.34')).toBe(true);
    expect(isExactYuanAmount('12.345')).toBe(false);
  });

  it('rejects invalid wallet amounts before taking a lock or opening a transaction', async () => {
    await expect(deposit(1, 1.005)).rejects.toThrow('resolve exactly to fen');
    await expect(deposit(1, Number.NaN)).rejects.toThrow('Invalid yuan amount');
    await expect(pay(1, 1.005)).rejects.toThrow('resolve exactly to fen');
    await expect(pay(1, Number.POSITIVE_INFINITY)).rejects.toThrow('Invalid yuan amount');
    expect(withLock).not.toHaveBeenCalled();
  });

  it('signs only canonical integer-fen payloads and verifies safely', () => {
    const signature = generateTransactionSignature(VALID_TRANSACTION);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyTransactionIntegrity({ ...VALID_TRANSACTION, signature })).toBe(true);
    expect(verifyTransactionIntegrity({ ...VALID_TRANSACTION, signature: '0'.repeat(64) })).toBe(false);
    expect(verifyTransactionIntegrity({ ...VALID_TRANSACTION, signature: 'not-hex' })).toBe(false);
    expect(verifyTransactionIntegrity({ ...VALID_TRANSACTION, amount: 10.5, signature })).toBe(false);

    expect(() => generateTransactionSignature({ ...VALID_TRANSACTION, amount: 10.5 }))
      .toThrow('Transaction amount must be a safe integer');
    expect(() => generateTransactionSignature({ ...VALID_TRANSACTION, id: Number.MAX_SAFE_INTEGER + 1 }))
      .toThrow('Transaction id must be a safe integer');
    expect(() => generateTransactionSignature({ ...VALID_TRANSACTION, createdAt: new Date('invalid') }))
      .toThrow('Transaction createdAt must be a valid Date');
  });

  it('rejects sub-fen API and redeem-code amounts', () => {
    expect(walletRechargeSchema.safeParse({ amount: 10.01 }).success).toBe(true);
    expect(walletRechargeSchema.safeParse({ amount: 10.001 }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({
      amount: 10.001,
      planId: 'custom',
      paymentMethod: 'wechat',
      currency: 'CNY',
    }).success).toBe(false);
    expect(adminCreateRedeemCodeSchema.safeParse({ code: 'TEST-CODE', amount: 1.001 }).success).toBe(false);
    expect(adminGenerateRedeemCodeSchema.safeParse({ amount: 1.001 }).success).toBe(false);
  });

  it('keeps wallet and payment normalizers on the shared integer conversion path', () => {
    const walletSource = readFileSync(resolve(process.cwd(), 'server/lib/wallet.ts'), 'utf8');
    const paymentSource = readFileSync(resolve(process.cwd(), 'server/controllers/paymentController.ts'), 'utf8');
    const projectPaymentSource = readFileSync(resolve(process.cwd(), 'server/controllers/paymentProjectController.ts'), 'utf8');

    expect(walletSource.match(/positiveYuanToFen\(amount\)/g)).toHaveLength(3);
    expect(walletSource).toContain('const amountFen = yuanToFen(amount)');
    expect(walletSource).not.toContain('Math.round(amount * 100)');
    expect(walletSource).toContain('crypto.timingSafeEqual(expected, supplied)');

    expect(paymentSource).toContain('const amountFen = yuanToFen(raw)');
    expect(paymentSource).toContain('return amountFen === null ? null : fenToYuan(amountFen)');
    expect(paymentSource).not.toContain('return parsed.toFixed(2)');

    expect(projectPaymentSource).toContain("throw new AppError('amount must have at most 2 decimal places', 400");
  });
});

/**
 * Generates an HMAC signature for a transaction to ensure integrity.
 */
export declare function generateTransactionSignature(transaction: {
    id: number;
    walletId: number;
    amount: number;
    type: string;
    status: string;
    createdAt: Date;
}): string;
/**
 * Verifies if a transaction has been tampered with.
 */
export declare function verifyTransactionIntegrity(transaction: any): boolean;
/**
 * Ensures a wallet exists for the user.
 */
export declare function ensureWallet(userId: number): Promise<{
    currency: string;
    id: number;
    user_id: number;
    balance: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}>;
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
export declare function getWalletBalanceBreakdown(userId: number): Promise<WalletBalanceBreakdown>;
/**
 * Deposits funds into a user's wallet.
 * Creates a transaction record and updates balance atomically.
 * @param amount Amount in yuan (will be converted to fen for storage)
 */
export declare function deposit(userId: number, amount: number, description?: string, options?: {
    type?: 'DEPOSIT' | 'CHECKIN_REWARD' | 'REDEEM_CODE';
    metadata?: Record<string, unknown>;
}): Promise<{
    currency: string;
    id: number;
    user_id: number;
    balance: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}>;
/**
 * Deducts funds from a user's wallet.
 * Ensures sufficient balance.
 * @param amount Amount in yuan (will be converted to fen for storage)
 */
export declare function pay(userId: number, amount: number, description?: string): Promise<{
    currency: string;
    id: number;
    user_id: number;
    balance: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}>;
//# sourceMappingURL=wallet.d.ts.map
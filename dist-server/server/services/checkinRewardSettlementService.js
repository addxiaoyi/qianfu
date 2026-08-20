import { generateTransactionSignature } from '../lib/wallet.js';
import { yuanToFen } from '../utils/currency.js';
export async function creditCheckinRewardInTransaction(tx, input) {
    const amountFen = yuanToFen(input.amountYuan);
    if (amountFen <= 0) {
        throw new Error('Check-in reward must be positive');
    }
    await tx.wallet.upsert({
        where: { user_id: input.userId },
        create: { user_id: input.userId, balance: 0, currency: 'CNY' },
        update: {},
    });
    const wallet = await tx.wallet.findUniqueOrThrow({
        where: { user_id: input.userId },
    });
    const transaction = await tx.transaction.create({
        data: {
            wallet_id: wallet.id,
            amount: amountFen,
            type: 'CHECKIN_REWARD',
            status: 'COMPLETED',
            description: '每日签到奖励（不可提现）',
            metadata: JSON.stringify({
                ...input.metadata,
                source: 'daily_checkin',
                nonWithdrawable: true,
                checkinDate: input.checkinDate,
                checkinHistoryId: input.checkinHistoryId,
            }),
        },
    });
    const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amountFen } },
    });
    const signature = generateTransactionSignature({
        id: transaction.id,
        walletId: transaction.wallet_id,
        amount: transaction.amount,
        type: transaction.type,
        status: transaction.status,
        createdAt: transaction.created_at,
    });
    await tx.transaction.update({
        where: { id: transaction.id },
        data: { signature },
    });
    return updatedWallet;
}
//# sourceMappingURL=checkinRewardSettlementService.js.map
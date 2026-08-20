import type { Prisma } from '../db';
export type CheckinRewardInput = {
    userId: number;
    amountYuan: number;
    checkinDate: string;
    checkinHistoryId: number;
    metadata: Record<string, unknown>;
};
export declare function creditCheckinRewardInTransaction(tx: Prisma.TransactionClient, input: CheckinRewardInput): Promise<{
    currency: string;
    id: number;
    user_id: number;
    balance: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}>;
//# sourceMappingURL=checkinRewardSettlementService.d.ts.map
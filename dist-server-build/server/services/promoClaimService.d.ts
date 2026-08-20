import type { Prisma, PrismaClient } from '../../prisma/generated/client/index.js';
export interface PendingPromoClaimInput {
    userId: number;
    taskId: number;
    idempotencyKey: string;
    proof: Record<string, unknown>;
}
export interface PendingPromoClaimResult {
    claim: Awaited<ReturnType<Prisma.TransactionClient['promoClaimRecord']['create']>>;
    created: boolean;
}
export declare const createPendingPromoClaim: (db: PrismaClient, input: PendingPromoClaimInput) => Promise<PendingPromoClaimResult>;
//# sourceMappingURL=promoClaimService.d.ts.map
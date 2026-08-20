import type { Prisma, PrismaClient } from '../../prisma/generated/client/index.js';
export type PaymentCompletionStatus = 'COMPLETED' | 'ALREADY_COMPLETED' | 'NOT_FOUND' | 'AMOUNT_MISMATCH';
export interface PaymentCompletionInput {
    paymentId: string;
    expectedAmountFen?: number;
    metadata?: Record<string, unknown>;
    adminId?: number;
}
export interface PaymentCompletionResult {
    status: PaymentCompletionStatus;
    paymentRecord?: Awaited<ReturnType<Prisma.TransactionClient['payment']['findUnique']>>;
}
export declare const completePaymentWithSideEffectsInTransaction: (tx: Prisma.TransactionClient, input: PaymentCompletionInput) => Promise<PaymentCompletionResult>;
export declare const completePaymentWithSideEffects: (db: Pick<PrismaClient, "$transaction">, input: PaymentCompletionInput) => Promise<PaymentCompletionResult>;
//# sourceMappingURL=paymentCompletionService.d.ts.map
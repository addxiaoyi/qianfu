import { Request } from 'express';
export declare function logAction(userId: number | null, action: string, target: string, req: Request, details?: Record<string, unknown> | unknown): Promise<void>;
/**
 * Data change snapshot logging
 */
export declare function logDataChange(userId: number | null, action: string, target: string, req: Request, before: any, after: any): Promise<void>;
/**
 * Batch audit logging
 */
export declare function logBatchActions(actions: Array<{
    userId?: number;
    action: string;
    target: string;
    ip: string;
    details?: any;
}>): Promise<void>;
/**
 * Verify the integrity of the entire audit log chain
 * Returns the first ID where a mismatch occurs, or null if everything is correct
 */
export declare function verifyAuditChain(): Promise<{
    isValid: boolean;
    corruptedId?: number;
    reason?: string;
}>;
/**
 * Audit statistics retrieval
 */
export declare function getAuditStats(options?: {
    startDate?: Date;
    endDate?: Date;
    userId?: number;
    action?: string;
}): Promise<number>;
//# sourceMappingURL=auditService.d.ts.map
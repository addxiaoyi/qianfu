import { type BusinessLocale } from '../constants/businessMessages';
export type ResponseSemanticOperation = 'list' | 'detail' | 'create' | 'update' | 'delete' | 'delete_hard' | 'batch' | 'empty';
export interface ResponseMessageOptions {
    resource?: string;
    message?: string;
    locale?: BusinessLocale;
}
export declare function resolveResponseMessage(type: ResponseSemanticOperation, options?: ResponseMessageOptions): string;
export interface BatchSummary {
    total: number;
    successful: number;
    failed: number;
}
export declare function buildBatchSummary(results: Array<{
    success: boolean;
}>): BatchSummary;
//# sourceMappingURL=responseSemantics.d.ts.map
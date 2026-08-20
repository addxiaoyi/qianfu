export type SortOrder = 'asc' | 'desc';
export interface PaginationInput {
    page: number;
    limit: number;
}
export interface PaginationResult {
    page: number;
    limit: number;
    skip: number;
    take: number;
}
export interface DateRangeInput {
    startDate?: Date;
    endDate?: Date;
}
export declare function buildPagination(input: PaginationInput): PaginationResult;
export declare function normalizeKeyword(keyword?: string | null): string | undefined;
export declare function buildDateRange(input: DateRangeInput): {
    gte?: Date;
    lte?: Date;
} | undefined;
export declare function resolveSortField<T extends string>(inputField: string | undefined, allowedFields: readonly T[], fallbackField: T): T;
export declare function resolveSortOrder(inputOrder?: string, fallback?: SortOrder): SortOrder;
export declare function buildStringMatch(value: string, fuzzy?: boolean): Record<string, string>;
export declare function buildKeywordOrConditions(fields: string[], keyword: string | undefined, fuzzy?: boolean): Record<string, unknown>[];
//# sourceMappingURL=queryBuilder.d.ts.map
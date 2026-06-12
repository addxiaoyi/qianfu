import type { PrismaClient } from '../../prisma/generated/client';
type PrismaModel = keyof Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '__dirname'>;
interface QueryInfo {
    query: string;
    params: unknown[];
    duration: number;
    timestamp: Date;
}
export declare function getQueryLog(): QueryInfo[];
export declare function clearQueryLog(): void;
export declare function getSlowQueries(thresholdMs?: number): QueryInfo[];
export declare function withTransaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>;
export declare function batchCreate<T>(model: PrismaModel, data: T[], batchSize?: number): Promise<number>;
export declare function batchUpdate<T>(model: PrismaModel, data: {
    where: Partial<T>;
    update: Partial<T>;
}[], batchSize?: number): Promise<number>;
export declare function batchUpsert<T>(model: PrismaModel, data: T[], uniqueField: keyof T, batchSize?: number): Promise<number>;
export declare function paginate<T>(model: PrismaModel, options: {
    where?: Partial<T>;
    page?: number;
    limit?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    include?: Record<string, boolean>;
}): Promise<{
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}>;
export declare function createSearchQuery(searchTerm: string, _searchableFields: string[]): {
    contains: string;
    mode: 'insensitive';
};
export declare function buildWhereClause<T>(filters: Partial<T>, searchTerm?: string, searchFields?: string[]): Record<string, unknown>;
export declare function optimizeDatabaseIndexes(): Promise<({
    index: string;
    status: string;
    error?: undefined;
} | {
    index: string;
    status: string;
    error: string;
})[]>;
export declare function optimizeServerQueries(): Promise<{
    name: string;
    id: number;
    activity: number;
}[]>;
export declare function getServerStats(): Promise<{
    servers: {
        total: number;
        approved: number;
        pending: number;
        rejected: number;
    };
    users: {
        total: number;
        active: number;
    };
}>;
export declare function explainQuery(query: string): string;
export declare function getIndexes(tableName: string): Promise<{
    name: string;
    sql: string;
}[]>;
export declare function analyzeTable(tableName: string): Promise<void>;
export declare function createCompositeIndex(tableName: string, columns: string[], indexName?: string): string;
export declare function createCustomIndex(tableName: string, columns: string[], indexName?: string): Promise<void>;
/**
 * Start periodic database optimization scheduler
 */
export declare function startDbOptimizerScheduler(): void;
export declare function dropIndex(indexName: string): Promise<void>;
export {};
//# sourceMappingURL=dbOptimizer.d.ts.map
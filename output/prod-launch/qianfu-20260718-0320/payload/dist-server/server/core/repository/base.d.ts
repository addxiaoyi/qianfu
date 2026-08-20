/**
 * Repository 基础类型定义
 * 提供统一的数据库访问接口规范
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
}
export interface PaginatedResult<T> {
    items: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface Repository<M extends {
    id: unknown;
}, CreateInput, UpdateInput, _WhereUnique = unknown, WhereMany = unknown> {
    findById(id: M['id']): Promise<M | null>;
    findMany(params?: FindManyParams<M, WhereMany>): Promise<PaginatedResult<M>>;
    create(data: CreateInput): Promise<M>;
    update(id: M['id'], data: UpdateInput): Promise<M>;
    delete(id: M['id']): Promise<void>;
}
export interface FindManyParams<_M, Where = unknown> {
    where?: Where;
    orderBy?: Record<string, 'asc' | 'desc'>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
    pagination?: PaginationParams;
}
export declare abstract class BaseRepository<M extends {
    id: unknown;
}, _CreateInput = unknown, _UpdateInput = unknown> {
    protected readonly prisma: import("@prisma/client").PrismaClient<{
        log: ("error" | "warn" | "query")[];
        errorFormat: "minimal";
        datasources: {
            db: {
                url: string;
            };
        };
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    protected readonly modelName: string;
    constructor(prisma: import("@prisma/client").PrismaClient<{
        log: ("error" | "warn" | "query")[];
        errorFormat: "minimal";
        datasources: {
            db: {
                url: string;
            };
        };
    }, never, import("@prisma/client/runtime/library").DefaultArgs> | undefined, modelName: string);
    protected abstract get model(): unknown;
    findById(id: M['id']): Promise<M | null>;
    findFirst(params: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
    }): Promise<M | null>;
    protected buildPaginationQuery(params: FindManyParams<M>): {
        skip: number;
        take: number;
    };
    protected buildPaginationMeta(total: number, pagination?: PaginationParams): PaginatedResult<M>['meta'];
}
export declare function assertFound<T>(entity: T | null, resource: string, id: unknown): T;
export declare function validatePagination(page?: number, limit?: number): void;
//# sourceMappingURL=base.d.ts.map
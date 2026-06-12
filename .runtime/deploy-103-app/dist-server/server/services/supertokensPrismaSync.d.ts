export interface SyncMeta {
    userId?: string;
    supertokensUserId?: string;
    syncedAt?: Date;
    name?: string;
    picture?: string;
    emailVerified?: boolean;
}
/**
 * 将 SuperTokens 用户与 Prisma User 绑定（按 stUserId 或邮箱去重），并维护登录统计。
 */
export declare function syncPrismaUserFromSuperTokens(stUserId: string, email: string, meta: SyncMeta): Promise<void>;
/** 会话有效但本地无用户行时，用 Core 中的用户信息补一次同步，并清除 Redis 缓存 */
export declare function repairPrismaUserIfMissing(stUserId: string): Promise<void>;
//# sourceMappingURL=supertokensPrismaSync.d.ts.map
/**
 * User Repository - 用户数据访问层
 *
 * 遵循 Repository 模式：
 * - 单一职责：只负责用户数据的 CRUD 操作
 * - 可测试：逻辑与数据库解耦
 * - 可扩展：易于添加缓存、审计等功能
 */
import type { Prisma, User } from '@prisma/client';
import { BaseRepository, PaginatedResult } from './base';
export interface CreateUserInput {
    email: string;
    username?: string;
    display_name?: string;
    password_hash?: string;
    role?: string;
    supabase_id?: string;
    supertokens_user_id?: string;
}
export interface UpdateUserInput {
    email?: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    role?: string;
    bio_html?: string;
    preferences?: string;
    permissions?: string;
}
export interface UserFilters {
    role?: string;
    email_verified?: boolean;
    search?: string;
}
declare class UserRepositoryImpl extends BaseRepository<User, CreateUserInput, UpdateUserInput> {
    constructor();
    protected get model(): Prisma.UserDelegate<import("@prisma/client/runtime/library").DefaultArgs>;
    findById(id: number): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findBySupertokensId(supertokensUserId: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    findMany(params?: {
        filters?: UserFilters;
        pagination?: {
            page?: number;
            limit?: number;
        };
        orderBy?: {
            field: keyof User;
            direction: 'asc' | 'desc';
        };
    }): Promise<PaginatedResult<User>>;
    create(data: CreateUserInput): Promise<User>;
    update(id: number, data: UpdateUserInput): Promise<User>;
    delete(id: number): Promise<void>;
    updateExperience(userId: number, increment: number): Promise<User>;
    incrementLoginCount(userId: number): Promise<void>;
}
export declare const userRepository: UserRepositoryImpl;
export { UserRepositoryImpl };
//# sourceMappingURL=userRepository.d.ts.map
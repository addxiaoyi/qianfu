/**
 * Zod 验证 Schema 库
 *
 * 统一的数据验证层：
 * - 请求参数验证
 * - 响应数据验证
 * - 表单数据验证
 */
import { z } from 'zod';
export declare const idSchema: z.ZodNumber;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const sortSchema: z.ZodObject<{
    sortBy: z.ZodOptional<z.ZodString>;
    order: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
}, z.core.$strip>;
export declare const createUserSchema: z.ZodObject<{
    email: z.ZodString;
    username: z.ZodOptional<z.ZodString>;
    display_name: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<{
        NORMAL: "NORMAL";
        ADMIN: "ADMIN";
        OWNER: "OWNER";
        MODERATOR: "MODERATOR";
    }>>;
}, z.core.$strip>;
export declare const updateUserSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    display_name: z.ZodOptional<z.ZodString>;
    avatar_url: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    bio_html: z.ZodOptional<z.ZodString>;
    preferences: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const userFiltersSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    role: z.ZodOptional<z.ZodEnum<{
        NORMAL: "NORMAL";
        ADMIN: "ADMIN";
        OWNER: "OWNER";
        MODERATOR: "MODERATOR";
    }>>;
    search: z.ZodOptional<z.ZodString>;
    email_verified: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const createServerSchema: z.ZodObject<{
    name: z.ZodString;
    host: z.ZodString;
    port: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    category: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    discord: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, z.core.$strip>;
export declare const updateServerSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    category: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    discord: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, z.core.$strip>;
export declare const serverFiltersSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    tag: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodEnum<{
        java: "java";
        bedrock: "bedrock";
    }>>;
    online: z.ZodOptional<z.ZodBoolean>;
    online_mode: z.ZodOptional<z.ZodEnum<{
        yes: "yes";
        no: "no";
    }>>;
    sortBy: z.ZodDefault<z.ZodEnum<{
        name: "name";
        created_at: "created_at";
        votes: "votes";
        last_online: "last_online";
    }>>;
    order: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    username: z.ZodOptional<z.ZodString>;
    display_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export declare const createReviewSchema: z.ZodObject<{
    server_id: z.ZodNumber;
    rating: z.ZodNumber;
    comment: z.ZodString;
}, z.core.$strip>;
export declare const reviewFiltersSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    server_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const createReportSchema: z.ZodObject<{
    type: z.ZodEnum<{
        user: "user";
        content: "content";
        server: "server";
        comment: "comment";
    }>;
    target_id: z.ZodNumber;
    reason: z.ZodString;
    evidence: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const notificationFiltersSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    is_read: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodOptional<z.ZodEnum<{
        SUCCESS: "SUCCESS";
        INFO: "INFO";
        ERROR: "ERROR";
        WARNING: "WARNING";
    }>>;
}, z.core.$strip>;
export declare class ZodValidationError extends Error {
    readonly errors: Array<{
        field: string;
        message: string;
    }>;
    constructor(message: string, errors: Array<{
        field: string;
        message: string;
    }>);
}
export declare function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserFilters = z.infer<typeof userFiltersSchema>;
export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type ServerFilters = z.infer<typeof serverFiltersSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
//# sourceMappingURL=schemas.d.ts.map
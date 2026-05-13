/**
 * Zod 验证 Schema 库
 *
 * 统一的数据验证层：
 * - 请求参数验证
 * - 响应数据验证
 * - 表单数据验证
 */
import { z } from 'zod';
// ============================================
// 基础类型 Schema
// ============================================
export const idSchema = z.number().int().positive();
export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
});
export const sortSchema = z.object({
    sortBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
});
// ============================================
// User Schema
// ============================================
export const createUserSchema = z.object({
    email: z.string().email('Invalid email address'),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
    display_name: z.string().min(1).max(100).optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(['NORMAL', 'MODERATOR', 'ADMIN', 'OWNER']).optional(),
});
export const updateUserSchema = z.object({
    email: z.string().email('Invalid email address').optional(),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
    display_name: z.string().min(1).max(100).optional(),
    avatar_url: z.string().url().optional().or(z.literal('')),
    bio_html: z.string().max(10000).optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
});
export const userFiltersSchema = paginationSchema.extend({
    role: z.enum(['NORMAL', 'MODERATOR', 'ADMIN', 'OWNER']).optional(),
    search: z.string().max(100).optional(),
    email_verified: z.boolean().optional(),
});
// ============================================
// Server Schema
// ============================================
export const createServerSchema = z.object({
    name: z.string().min(3).max(100),
    host: z.string().min(1).max(255),
    port: z.number().int().min(1).max(65535),
    description: z.string().max(2000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    category: z.string().max(50).optional(),
    version: z.string().max(50).optional(),
    website: z.string().url().optional().or(z.literal('')),
    discord: z.string().url().optional().or(z.literal('')),
});
export const updateServerSchema = z.object({
    name: z.string().min(3).max(100).optional(),
    description: z.string().max(2000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    category: z.string().max(50).optional(),
    version: z.string().max(50).optional(),
    website: z.string().url().optional().or(z.literal('')),
    discord: z.string().url().optional().or(z.literal('')),
});
export const serverFiltersSchema = paginationSchema.extend({
    search: z.string().max(100).optional(),
    tag: z.string().max(50).optional(),
    category: z.string().max(50).optional(),
    version: z.string().max(50).optional(),
    platform: z.enum(['java', 'bedrock']).optional(),
    online: z.boolean().optional(),
    online_mode: z.enum(['yes', 'no']).optional(),
    sortBy: z.enum(['name', 'votes', 'created_at', 'last_online']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
});
// ============================================
// Auth Schema
// ============================================
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});
export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
    display_name: z.string().min(1).max(100).optional(),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});
// ============================================
// Review Schema
// ============================================
export const createReviewSchema = z.object({
    server_id: z.number().int().positive(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(10).max(2000),
});
export const reviewFiltersSchema = paginationSchema.extend({
    server_id: z.number().int().positive().optional(),
    user_id: z.number().int().positive().optional(),
});
// ============================================
// Report Schema
// ============================================
export const createReportSchema = z.object({
    type: z.enum(['server', 'user', 'comment', 'content']),
    target_id: z.number().int().positive(),
    reason: z.string().min(10).max(1000),
    evidence: z.string().max(5000).optional(),
});
// ============================================
// Notification Schema
// ============================================
export const notificationFiltersSchema = paginationSchema.extend({
    is_read: z.boolean().optional(),
    type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).optional(),
});
// ============================================
// 验证辅助函数
// ============================================
export class ZodValidationError extends Error {
    errors;
    constructor(message, errors) {
        super(message);
        this.errors = errors;
        this.name = 'ZodValidationError';
    }
}
export function validateOrThrow(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
        }));
        throw new ZodValidationError('Validation failed', errors);
    }
    return result.data;
}
//# sourceMappingURL=schemas.js.map
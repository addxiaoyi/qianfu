/**
 * User Repository - 用户数据访问层
 *
 * 遵循 Repository 模式：
 * - 单一职责：只负责用户数据的 CRUD 操作
 * - 可测试：逻辑与数据库解耦
 * - 可扩展：易于添加缓存、审计等功能
 */
import prisma from '../../db.js';
import { BaseRepository } from './base.js';
import { NotFoundError, ConflictError } from './errors.js';
// ============================================
// Repository 实现
// ============================================
class UserRepositoryImpl extends BaseRepository {
    constructor() {
        super(prisma, 'User');
    }
    get model() {
        return prisma.user;
    }
    async findById(id) {
        return prisma.user.findUnique({ where: { id } });
    }
    async findByEmail(email) {
        return prisma.user.findUnique({ where: { email } });
    }
    async findBySupertokensId(supertokensUserId) {
        return prisma.user.findUnique({ where: { supertokens_user_id: supertokensUserId } });
    }
    async findByUsername(username) {
        return prisma.user.findFirst({ where: { username } });
    }
    async findMany(params) {
        const { filters, pagination = {}, orderBy = { field: 'created_at', direction: 'desc' } } = params || {};
        const where = {};
        if (filters?.role) {
            where.role = filters.role;
        }
        if (filters?.email_verified !== undefined) {
            where.email_verified = filters.email_verified;
        }
        if (filters?.search) {
            where.OR = [
                { email: { contains: filters.search } },
                { username: { contains: filters.search } },
                { display_name: { contains: filters.search } },
            ];
        }
        const { page = 1, limit = 20 } = pagination;
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [orderBy.field]: orderBy.direction },
            }),
            prisma.user.count({ where }),
        ]);
        return {
            items,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
    async create(data) {
        // 检查邮箱唯一性
        const existing = await this.findByEmail(data.email);
        if (existing) {
            throw new ConflictError(`User with email ${data.email} already exists`);
        }
        // 检查用户名唯一性（如果提供）
        if (data.username) {
            const existingUsername = await this.findByUsername(data.username);
            if (existingUsername) {
                throw new ConflictError(`Username ${data.username} is already taken`);
            }
        }
        return prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                display_name: data.display_name,
                password_hash: data.password_hash,
                role: data.role || 'NORMAL',
                supabase_id: data.supabase_id,
                supertokens_user_id: data.supertokens_user_id,
            },
        });
    }
    async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new NotFoundError(`User ${id}`);
        }
        // 检查邮箱唯一性（如果修改）
        if (data.email && data.email !== existing.email) {
            const emailExists = await this.findByEmail(data.email);
            if (emailExists) {
                throw new ConflictError(`Email ${data.email} is already in use`);
            }
        }
        return prisma.user.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new NotFoundError(`User ${id}`);
        }
        await prisma.user.delete({ where: { id } });
    }
    async updateExperience(userId, increment) {
        return prisma.user.update({
            where: { id: userId },
            data: { experience_points: { increment } },
        });
    }
    async incrementLoginCount(userId) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                login_count: { increment: 1 },
                last_login_at: new Date(),
            },
        });
    }
}
// ============================================
// 单例导出
// ============================================
export const userRepository = new UserRepositoryImpl();
export { UserRepositoryImpl };
//# sourceMappingURL=userRepository.js.map
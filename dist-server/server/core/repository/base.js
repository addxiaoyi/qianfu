/**
 * Repository 基础类型定义
 * 提供统一的数据库访问接口规范
 */
import dbClient from '../../db';
import { NotFoundError, ValidationError } from '../../errors/AppError';
// ============================================
// 基础 Repository 实现
// ============================================
export class BaseRepository {
    prisma;
    modelName;
    constructor(prisma = dbClient, modelName) {
        this.prisma = prisma;
        this.modelName = modelName;
    }
    async findById(id) {
        const model = this.model;
        return model.findUnique({ where: { id } });
    }
    async findFirst(params) {
        const model = this.model;
        return model.findFirst(params);
    }
    buildPaginationQuery(params) {
        const { page = 1, limit = 20 } = params.pagination || {};
        const skip = (page - 1) * limit;
        return { skip, take: limit };
    }
    buildPaginationMeta(total, pagination) {
        const { page = 1, limit = 20 } = pagination || {};
        return {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };
    }
}
// ============================================
// 工具函数
// ============================================
export function assertFound(entity, resource, id) {
    if (!entity) {
        throw new NotFoundError(`${resource} with id ${id}`);
    }
    return entity;
}
export function validatePagination(page, limit) {
    if (page !== undefined && (page < 1 || !Number.isInteger(page))) {
        throw new ValidationError('Page must be a positive integer', [
            { field: 'page', message: 'Page must be >= 1' },
        ]);
    }
    if (limit !== undefined && (limit < 1 || limit > 100 || !Number.isInteger(limit))) {
        throw new ValidationError('Limit must be between 1 and 100', [
            { field: 'limit', message: 'Limit must be 1-100' },
        ]);
    }
}
//# sourceMappingURL=base.js.map
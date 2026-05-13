/**
 * Repository 基础类型定义
 * 提供统一的数据库访问接口规范
 */

import dbClient from '../../db';
import { NotFoundError, ValidationError } from '../../errors/AppError';

// ============================================
// Repository 基类和接口
// ============================================

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

export interface Repository<M extends { id: unknown }, CreateInput, UpdateInput, _WhereUnique = unknown, WhereMany = unknown> {
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

// ============================================
// 基础 Repository 实现
// ============================================

export abstract class BaseRepository<
  M extends { id: unknown },
  _CreateInput = unknown,
  _UpdateInput = unknown,
> {
  constructor(
    protected readonly prisma = dbClient,
    protected readonly modelName: string
  ) {}

  protected abstract get model(): unknown;

  async findById(id: M['id']): Promise<M | null> {
    const model = this.model as {
      findUnique: (args: { where: { id: unknown } }) => Promise<M | null>;
    };
    return model.findUnique({ where: { id } });
  }

  async findFirst(params: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<M | null> {
    const model = this.model as {
      findFirst: (args: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
      }) => Promise<M | null>;
    };
    return model.findFirst(params);
  }

  protected buildPaginationQuery(params: FindManyParams<M>) {
    const { page = 1, limit = 20 } = params.pagination || {};
    const skip = (page - 1) * limit;
    return { skip, take: limit };
  }

  protected buildPaginationMeta(
    total: number,
    pagination?: PaginationParams
  ): PaginatedResult<M>['meta'] {
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

export function assertFound<T>(entity: T | null, resource: string, id: unknown): T {
  if (!entity) {
    throw new NotFoundError(`${resource} with id ${id}`);
  }
  return entity;
}

export function validatePagination(page?: number, limit?: number): void {
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

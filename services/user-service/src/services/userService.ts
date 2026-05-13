/**
 * User Service - 用户服务
 * 处理用户 CRUD、个人资料管理
 */

import { PrismaClient, User } from '@prisma/client';
import { AppError, logger } from '@qianfu/shared';
import { z } from 'zod';

// ============================================================================
// 数据库
// ============================================================================

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ============================================================================
// 验证 Schema
// ============================================================================

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3).max(30),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const updateUserSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// ============================================================================
// 用户服务
// ============================================================================

export class UserService {
  /**
   * 创建用户
   */
  async create(data: z.infer<typeof createUserSchema>): Promise<User> {
    // 检查邮箱是否存在
    const existingByEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingByEmail) {
      throw AppError.conflict('Email already registered');
    }

    // 检查用户名是否存在
    const existingByUsername = await prisma.user.findFirst({
      where: { username: data.username },
    });

    if (existingByUsername) {
      throw AppError.conflict('Username already taken');
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        first_name: data.firstName,
        last_name: data.lastName,
      },
    });

    logger.info(`User created: ${user.id}`, { userId: user.id, email: user.email });

    return user;
  }

  /**
   * 获取用户 by ID
   */
  async getById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });
  }

  /**
   * 获取用户 by Email
   */
  async getByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });
  }

  /**
   * 更新用户
   */
  async update(id: string, data: z.infer<typeof updateUserSchema>): Promise<User> {
    // 检查用户名是否被占用
    if (data.username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id },
        },
      });

      if (existing) {
        throw AppError.conflict('Username already taken');
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        username: data.username,
        first_name: data.firstName,
        last_name: data.lastName,
      },
    });

    logger.info(`User updated: ${id}`);

    return user;
  }

  /**
   * 删除用户（软删除）
   */
  async delete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });

    logger.info(`User deleted: ${id}`);
  }

  /**
   * 列出用户（分页）
   */
  async list(query: z.infer<typeof userQuerySchema>): Promise<{
    users: User[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      deleted_at: null,
      ...(search && {
        OR: [
          { email: { contains: search } },
          { username: { contains: search } },
          { first_name: { contains: search } },
          { last_name: { contains: search } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 统计用户
   */
  async count(where?: { email_verified?: boolean }): Promise<number> {
    return prisma.user.count({ where });
  }
}

export const userService = new UserService();

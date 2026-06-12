/**
 * Server Service - 服务器服务
 * 处理游戏服务器 CRUD、实例管理、玩家追踪
 */

import { PrismaClient } from '@prisma/client';
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

export const createServerSchema = z.object({
  name: z.string().min(3).max(50),
  type: z.string().min(1).max(50).default('minecraft'),
  maxPlayers: z.coerce.number().int().min(1).max(100).default(10),
  config: z.record(z.unknown()).optional(),
  version: z.string().optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  maxPlayers: z.coerce.number().int().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  version: z.string().optional(),
});

export const serverQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  type: z.string().optional(),
  ownerId: z.string().optional(),
});

// ============================================================================
// 服务间通信
// ============================================================================

// ============================================================================
// 服务器服务
// ============================================================================

export class ServerService {
  /**
   * 创建服务器
   */
  async create(ownerId: string, data: z.infer<typeof createServerSchema>): Promise<any> {
    // 检查名称是否已存在
    const existing = await prisma.server.findFirst({
      where: { name: data.name, deletedAt: null },
    });

    if (existing) {
      throw AppError.conflict('Server name already taken');
    }

    const server = await prisma.server.create({
      data: {
        name: data.name,
        ownerId,
        type: data.type,
        maxPlayers: data.maxPlayers,
        config: data.config ? JSON.stringify(data.config) : null,
        version: data.version,
      },
    });

    logger.info(`Server created: ${server.id}`, { serverId: server.id, ownerId });

    return this.formatServer(server);
  }

  /**
   * 获取服务器 by ID
   */
  async getById(id: string): Promise<any | null> {
    const server = await prisma.server.findFirst({
      where: { id, deletedAt: null },
      include: {
        instances: true,
        players: {
          where: { leftAt: null },
          take: 20,
        },
      },
    });

    if (!server) return null;

    return this.formatServer(server);
  }

  /**
   * 更新服务器
   */
  async update(id: string, ownerId: string, data: z.infer<typeof updateServerSchema>): Promise<any> {
    const server = await prisma.server.findFirst({ where: { id, deletedAt: null } });

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    if (server.ownerId !== ownerId) {
      throw AppError.forbidden('Only the owner can update the server');
    }

    // 检查名称冲突
    if (data.name && data.name !== server.name) {
      const existing = await prisma.server.findFirst({ where: { name: data.name, deletedAt: null } });
      if (existing) {
        throw AppError.conflict('Server name already taken');
      }
    }

    const updated = await prisma.server.update({
      where: { id },
      data: {
        name: data.name,
        maxPlayers: data.maxPlayers,
        config: data.config ? JSON.stringify(data.config) : undefined,
        version: data.version,
      },
    });

    logger.info(`Server updated: ${id}`);

    return this.formatServer(updated);
  }

  /**
   * 删除服务器（软删除）
   */
  async delete(id: string, ownerId: string): Promise<void> {
    const server = await prisma.server.findFirst({ where: { id, deletedAt: null } });

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    if (server.ownerId !== ownerId) {
      throw AppError.forbidden('Only the owner can delete the server');
    }

    await prisma.server.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        name: `${server.name}__deleted__${server.id}`,
        status: 'offline',
        currentPlayers: 0,
      },
    });

    logger.info(`Server deleted: ${id}`);
  }

  /**
   * 列出服务器（分页）
   */
  async list(query: z.infer<typeof serverQuerySchema>): Promise<{
    servers: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page, limit, status, type, ownerId } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(type && { type }),
      ...(ownerId && { ownerId }),
    };

    const [servers, total] = await Promise.all([
      prisma.server.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.server.count({ where }),
    ]);

    return {
      servers: servers.map((s) => this.formatServer(s)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 启动服务器实例
   */
  async startInstance(serverId: string, ownerId: string): Promise<any> {
    const server = await prisma.server.findFirst({
      where: { id: serverId, deletedAt: null },
      include: { instances: true },
    });

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    if (server.ownerId !== ownerId) {
      throw AppError.forbidden('Only the owner can start the server');
    }

    // 检查是否已有运行中的实例
    const runningInstance = server.instances.find((i) => i.status === 'running');
    if (runningInstance) {
      throw AppError.conflict('Server is already running');
    }

    // 创建新实例
    const instance = await prisma.serverInstance.create({
      data: {
        serverId,
        status: 'starting',
        startedAt: new Date(),
      },
    });

    // 更新服务器状态
    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'starting' },
    });

    logger.info(`Server instance starting: ${instance.id}`);

    // 模拟启动完成（实际应该调用游戏服务器进程管理）
    setTimeout(async () => {
      try {
        const activeServer = await prisma.server.findFirst({
          where: { id: serverId, deletedAt: null },
          select: { id: true },
        });
        if (!activeServer) {
          await prisma.serverInstance.update({
            where: { id: instance.id },
            data: { status: 'stopped', stoppedAt: new Date() },
          });
          return;
        }
        await prisma.serverInstance.update({
          where: { id: instance.id },
          data: { status: 'running' },
        });
        await prisma.server.updateMany({
          where: { id: serverId, deletedAt: null },
          data: { status: 'online' },
        });
      } catch (error) {
        logger.error('Failed to finalize server start', { serverId, instanceId: instance.id, error });
      }
    }, 2000);

    return {
      id: instance.id,
      serverId,
      status: 'starting',
      message: 'Server is starting...',
    };
  }

  /**
   * 停止服务器实例
   */
  async stopInstance(serverId: string, ownerId: string): Promise<any> {
    const server = await prisma.server.findFirst({
      where: { id: serverId, deletedAt: null },
      include: { instances: true },
    });

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    if (server.ownerId !== ownerId) {
      throw AppError.forbidden('Only the owner can stop the server');
    }

    const runningInstance = server.instances.find((i) => i.status === 'running' || i.status === 'starting');
    if (!runningInstance) {
      throw AppError.notFound('No running instance found');
    }

    await prisma.serverInstance.update({
      where: { id: runningInstance.id },
      data: { status: 'stopped', stoppedAt: new Date() },
    });

    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'offline', currentPlayers: 0 },
    });

    logger.info(`Server instance stopped: ${runningInstance.id}`);

    return { message: 'Server stopped successfully' };
  }

  /**
   * 获取服务器玩家列表
   */
  async getPlayers(serverId: string): Promise<any[]> {
    const server = await prisma.server.findFirst({
      where: { id: serverId, deletedAt: null },
      select: { id: true },
    });

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    const players = await prisma.player.findMany({
      where: {
        serverId,
        leftAt: null,
      },
      orderBy: { joinedAt: 'desc' },
    });

    return players.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      username: p.username,
      joinedAt: p.joinedAt,
    }));
  }

  /**
   * 添加玩家到服务器
   */
  async addPlayer(serverId: string, playerId: string, username?: string): Promise<void> {
    const server = await prisma.server.findFirst({
      where: { id: serverId, deletedAt: null },
      select: { id: true },
    });

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    await prisma.player.create({
      data: {
        serverId,
        playerId,
        username,
      },
    });

    await prisma.server.updateMany({
      where: { id: serverId, deletedAt: null },
      data: { currentPlayers: { increment: 1 } },
    });

    logger.info(`Player ${playerId} joined server ${serverId}`);
  }

  /**
   * 移除玩家（离开服务器）
   */
  async removePlayer(serverId: string, playerId: string): Promise<void> {
    const server = await prisma.server.findFirst({
      where: { id: serverId, deletedAt: null },
      select: { id: true },
    });

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    const updatedPlayers = await prisma.player.updateMany({
      where: { serverId, playerId, leftAt: null },
      data: { leftAt: new Date() },
    });

    if (updatedPlayers.count > 0) {
      await prisma.server.updateMany({
        where: { id: serverId, deletedAt: null },
        data: { currentPlayers: { decrement: 1 } },
      });
    }

    logger.info(`Player ${playerId} left server ${serverId}`);
  }

  /**
   * 格式化服务器数据
   */
  private formatServer(server: any): any {
    return {
      id: server.id,
      name: server.name,
      ownerId: server.ownerId,
      type: server.type,
      status: server.status,
      maxPlayers: server.maxPlayers,
      currentPlayers: server.currentPlayers,
      config: server.config ? JSON.parse(server.config) : null,
      version: server.version,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  }
}

export const serverService = new ServerService();

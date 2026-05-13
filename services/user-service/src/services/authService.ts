/**
 * User Service - 认证服务
 * 处理用户认证、注册、会话管理
 */

import { PrismaClient } from '@prisma/client';
import { } from '@qianfu/shared';
import { z } from 'zod';
import crypto from 'crypto';

// ============================================================================
// 数据库
// ============================================================================

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ============================================================================
// 验证 Schema
// ============================================================================

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain lowercase')
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/\d/, 'Password must contain a number'),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1),
});

// ============================================================================
// 认证服务
// ============================================================================

export class AuthService {
  /**
   * 验证用户凭证
   */
  async verifyCredentials(email: string, password: string): Promise<{ userId: string } | null> {
    // 实际项目中应使用 SuperTokens，这里简化处理
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        password_hash: true,
      },
    });

    if (!user || !user.password_hash) {
      return null;
    }

    // 简单的密码验证（生产环境应使用 bcrypt）
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== user.password_hash) {
      return null;
    }

    return { userId: user.id };
  }

  /**
   * 创建会话
   */
  async createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天

    await prisma.session.create({
      data: {
        id: sessionId,
        user_id: userId,
        expires_at: expiresAt,
      },
    });

    return { sessionId, expiresAt };
  }

  /**
   * 验证会话
   */
  async verifySession(sessionId: string): Promise<{ userId: string } | null> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.expires_at < new Date()) {
      // 删除过期会话
      if (session) {
        await prisma.session.delete({ where: { id: sessionId } });
      }
      return null;
    }

    return { userId: session.user_id };
  }

  /**
   * 撤销会话
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.delete({ where: { id: sessionId } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 撤销用户所有会话
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        user_id: userId,
        ...(exceptSessionId && { id: { not: exceptSessionId } }),
      },
    });

    return result.count;
  }

  /**
   * 获取用户所有会话
   */
  async getUserSessions(userId: string): Promise<Array<{ id: string; expiresAt: Date; createdAt: Date }>> {
    const sessions = await prisma.session.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        expires_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      expiresAt: s.expires_at,
      createdAt: s.created_at,
    }));
  }
}

export const authService = new AuthService();

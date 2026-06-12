import { Request, Response, NextFunction } from 'express';
import localPrisma from '../localDb';
import { AuthRequest } from '../middleware/auth';
import { AppError, ErrorCode } from '../utils/errors';
import {
  sendCreatedResponse,
  sendDeletedResponse,
  sendDetailResponse,
  sendListResponse,
  sendUpdatedResponse,
} from '../utils/response';
import {
  idParamSchema,
  serverCommentBodySchema,
  playerHistoryQuerySchema,
  paginationQuerySchema,
} from '../utils/validation';
import {
  listServerStatusHistory,
  aggregateHistoryPoints,
} from '../services/serverStatusHistoryService';
import { ModerationService } from '../services/moderationService';
import { clearPublicServersCache } from '../services/publicServerCache';
import { logger } from '../utils/logger';
import {
  applyExperience,
  publicTierBadgeFromXp,
  XP_COMMENT,
  XP_LIKE,
} from '../services/userLevelService';

export const getPlayerHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idVal = idParamSchema.safeParse(req.params);
    if (!idVal.success) {
      throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: idVal.error.issues,
      });
    }
    const qVal = playerHistoryQuerySchema.safeParse(req.query);
    if (!qVal.success) {
      throw new AppError('Invalid query', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: qVal.error.issues,
      });
    }
    const serverId = idVal.data.id;
    const { range } = qVal.data;

    const server = await localPrisma.server.findFirst({
      where: { id: serverId, review_status: 'APPROVED' },
      select: { id: true },
    });
    if (!server) {
      throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
    }

    const ms = range === '7d' ? 7 * 86400000 : 86400000;
    const since = new Date(Date.now() - ms);
    const rows = await listServerStatusHistory(serverId, since);
    const bucketMs = range === '7d' ? 6 * 3600000 : 3600000;
    const points = aggregateHistoryPoints(rows, bucketMs);

    return sendDetailResponse(res, {
      range,
      points,
      rawCount: rows.length,
      sampledFrom: since.toISOString(),
    }, { resource: 'Server player history' });
  } catch (e) {
    next(e);
  }
};

export const listServerComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idVal = idParamSchema.safeParse(req.params);
    if (!idVal.success) {
      throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: idVal.error.issues,
      });
    }
    const pageVal = paginationQuerySchema.safeParse(req.query);
    if (!pageVal.success) {
      throw new AppError('Invalid query', 400, ErrorCode.VALIDATION_ERROR, false, pageVal.error.issues);
    }
    const serverId = idVal.data.id;
    const { page, limit } = pageVal.data;
    const skip = (page - 1) * limit;

    const server = await localPrisma.server.findFirst({
      where: { id: serverId, review_status: 'APPROVED' },
      select: { id: true },
    });
    if (!server) {
      throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
    }

    const [items, total] = await Promise.all([
      localPrisma.serverComment.findMany({
        where: { server_id: serverId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, display_name: true, avatar_url: true, experience_points: true },
          },
        },
      }),
      localPrisma.serverComment.count({ where: { server_id: serverId } }),
    ]);

    const mapped = items.map((row: any) => ({
      ...row,
      user: row.user
        ? {
            id: row.user.id,
            username: row.user.username,
            display_name: row.user.display_name,
            avatar_url: row.user.avatar_url,
            tier_badge: publicTierBadgeFromXp(row.user.experience_points ?? 0),
          }
        : undefined,
    }));

    return sendListResponse(res, mapped, total, page, limit, { resource: 'Server comment' });
  } catch (e) {
    next(e);
  }
};

export const postServerComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    const idVal = idParamSchema.safeParse(req.params);
    if (!idVal.success) {
      throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: idVal.error.issues,
      });
    }
    const bodyVal = serverCommentBodySchema.safeParse(req.body);
    if (!bodyVal.success) {
      throw new AppError('Invalid body', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: bodyVal.error.issues,
      });
    }

    const serverId = idVal.data.id;
    const server = await localPrisma.server.findFirst({
      where: { id: serverId, review_status: 'APPROVED' },
      select: { id: true, owner_id: true, name: true },
    });
    if (!server) {
      throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
    }

    const mod = await ModerationService.checkText(bodyVal.data.body, user.id);
    if (!mod.passed) {
      throw new AppError(mod.reason || 'Content violation', 400, ErrorCode.VALIDATION_ERROR);
    }

    const comment = await localPrisma.$transaction(async (tx: any) => {
      const c = await tx.serverComment.create({
        data: {
          server_id: serverId,
          user_id: user.id,
          body: bodyVal.data.body.trim(),
        },
        include: {
          user: {
            select: { id: true, username: true, display_name: true, avatar_url: true, experience_points: true },
          },
        },
      });
      await tx.server.update({
        where: { id: serverId },
        data: { comment_count: { increment: 1 } },
      });
      return c;
    });

    if (server.owner_id !== user.id) {
      try {
        const actor = user.display_name || user.username || user.email || '用户';
        await localPrisma.notification.create({
          data: {
            user_id: server.owner_id,
            title: '服务器新评论',
            content: `${actor} 在「${server.name}」下发表了评论`,
            type: 'INFO',
          },
        });
      } catch (e) {
        logger.warn('[Notification] comment notify failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await clearPublicServersCache();

    const xpGain = await applyExperience(user.id, XP_COMMENT, 'comment');
    const xpForTier = xpGain?.totalXp ?? (comment.user?.experience_points ?? 0);
    const commentUser = comment.user
      ? {
          id: comment.user.id,
          username: comment.user.username,
          display_name: comment.user.display_name,
          avatar_url: comment.user.avatar_url,
          tier_badge: publicTierBadgeFromXp(xpForTier),
        }
      : undefined;

    const { user: _u, ...commentRest } = comment;
    return sendCreatedResponse(
      res,
      {
        ...commentRest,
        user: commentUser,
        xp_gain: xpGain?.added ?? 0,
        xp_total: xpGain?.totalXp,
        level: xpGain?.progress.level,
        leveled_up: xpGain?.leveledUp ?? false,
      },
      {
        resource: 'Server comment',
        location: `/api/v1/servers/${serverId}/comments/${comment.id}`,
      }
    );
  } catch (e) {
    next(e);
  }
};

export const deleteServerComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

    const idVal = idParamSchema.safeParse(req.params);
    const cidVal = idParamSchema.safeParse({ id: (req.params as { commentId?: string }).commentId || '' });
    if (!idVal.success || !cidVal.success) {
      throw new AppError('Invalid ID', 400, ErrorCode.VALIDATION_ERROR);
    }
    const serverId = idVal.data.id;
    const commentId = cidVal.data.id;

    const comment = await localPrisma.serverComment.findFirst({
      where: { id: commentId, server_id: serverId },
      include: { server: { select: { owner_id: true } } },
    });
    if (!comment) {
      throw new AppError('Not found', 404, ErrorCode.NOT_FOUND);
    }

    const perms = user.permissions ? JSON.parse(user.permissions) : [];
    const isAdmin =
      user.role === 'ADMIN' || perms.includes('admin') || perms.includes('manage_content');
    if (comment.user_id !== user.id && comment.server.owner_id !== user.id && !isAdmin) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    await localPrisma.$transaction(async (tx: any) => {
      await tx.serverComment.delete({ where: { id: commentId } });
      await tx.server.update({
        where: { id: serverId },
        data: { comment_count: { decrement: 1 } },
      });
    });

    await clearPublicServersCache();
    return sendDeletedResponse(res, {
      resource: 'Server comment',
      mode: 'hard',
      data: {
        id: commentId,
      },
    });
  } catch (e) {
    next(e);
  }
};

export const toggleServerLike = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

    const idVal = idParamSchema.safeParse(req.params);
    if (!idVal.success) {
      throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: idVal.error.issues,
      });
    }
    const serverId = idVal.data.id;

    const server = await localPrisma.server.findFirst({
      where: { id: serverId, review_status: 'APPROVED' },
      select: { id: true, owner_id: true, name: true, like_count: true },
    });
    if (!server) {
      throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
    }

    const result = await localPrisma.$transaction(async (tx: any) => {
      const existing = await tx.serverLike.findUnique({
        where: { server_id_user_id: { server_id: serverId, user_id: user.id } },
      });
      if (existing) {
        await tx.serverLike.delete({ where: { id: existing.id } });
        const s = await tx.server.update({
          where: { id: serverId },
          data: { like_count: { decrement: 1 } },
          select: { like_count: true },
        });
        return { liked: false, like_count: s.like_count };
      }
      await tx.serverLike.create({
        data: { server_id: serverId, user_id: user.id },
      });
      const s = await tx.server.update({
        where: { id: serverId },
        data: { like_count: { increment: 1 } },
        select: { like_count: true },
      });
      return { liked: true, like_count: s.like_count };
    });

    if (result.liked && server.owner_id !== user.id) {
      try {
        const actor = user.display_name || user.username || user.email || '用户';
        await localPrisma.notification.create({
          data: {
            user_id: server.owner_id,
            title: '服务器收到点赞',
            content: `${actor} 点赞了你的服务器「${server.name}」`,
            type: 'INFO',
          },
        });
      } catch (e) {
        logger.warn('[Notification] like notify failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await clearPublicServersCache();

    let xpPayload: Record<string, unknown> = {};
    if (result.liked) {
      const xp = await applyExperience(user.id, XP_LIKE, 'like');
      if (xp) {
        xpPayload = {
          xp_gain: xp.added,
          xp_total: xp.totalXp,
          level: xp.progress.level,
          leveled_up: xp.leveledUp,
        };
      }
    }

    return sendUpdatedResponse(res, { ...result, ...xpPayload }, { resource: 'Server like status' });
  } catch (e) {
    next(e);
  }
};

export const getServerLikeState = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    const idVal = idParamSchema.safeParse(req.params);
    if (!idVal.success) {
      throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, idVal.error.issues);
    }
    const serverId = idVal.data.id;

    const server = await localPrisma.server.findFirst({
      where: { id: serverId, review_status: 'APPROVED' },
      select: { like_count: true },
    });
    if (!server) {
      throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
    }

    let liked = false;
    if (user) {
      const row = await localPrisma.serverLike.findUnique({
        where: { server_id_user_id: { server_id: serverId, user_id: user.id } },
      });
      liked = !!row;
    }

    return sendDetailResponse(res, { like_count: server.like_count, liked }, { resource: 'Server like state' });
  } catch (e) {
    next(e);
  }
};

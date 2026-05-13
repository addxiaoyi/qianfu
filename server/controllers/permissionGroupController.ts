import { Response, NextFunction } from 'express';
import prisma from '../db';
import { 
  PERMISSION_GROUPS, 
  PermissionGroup, 
  PermissionGroupManager,
  PermissionGroupInfo 
} from '../config/permissionGroups';
import { AuthRequest, invalidateUserCache } from '../middleware/auth';
import { AppError, ErrorCode } from '../utils/errors';
import { logDataChange } from '../services/auditService';
import {
  sendBatchResponse,
  sendDetailResponse,
  sendListResponse,
  sendUpdatedResponse,
} from '../utils/response';
import { assignPermissionGroupSchema, batchAssignPermissionGroupSchema, idParamSchema, permissionHistoryQuerySchema } from '../utils/validation';
import { parseJsonArray } from '../utils/jsonField';

export const getAllPermissionGroups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const groups = PermissionGroupManager.getAllGroups() as Record<string, PermissionGroupInfo>;
    return sendDetailResponse(res, groups, { resource: 'Permission group' });
  } catch (error) {
    next(error);
  }
};

export const assignPermissionGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const idValidation = idParamSchema.safeParse({ id: req.params.userId });
    if (!idValidation.success) {
      throw new AppError('Invalid User ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
    }
    const userId = idValidation.data.id;

    const groupValidation = assignPermissionGroupSchema.safeParse(req.body);
    if (!groupValidation.success) {
      throw new AppError('Invalid group input', 400, ErrorCode.VALIDATION_ERROR, false, groupValidation.error.issues);
    }
    const { group } = groupValidation.data;

    if (!PERMISSION_GROUPS[group as PermissionGroup]) {
      throw new AppError('Invalid group', 400, ErrorCode.INVALID_INPUT);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
    }

    const assignerPermissions = parseJsonArray(req.user.permissions);
    const validation = PermissionGroupManager.validateGroupAssignment(
      targetUser.role as PermissionGroup,
      group as PermissionGroup,
      assignerPermissions,
      req.user.role as PermissionGroup,
      req.isAdmin
    );

    if (!validation.valid) {
      throw new AppError(validation.message || 'Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    const groupInfo = PERMISSION_GROUPS[group as PermissionGroup];

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: group,
        permissions: JSON.stringify(groupInfo.permissions),
        updated_at: new Date()
      },
    });

    // 清除用户缓存，确保下次认证时获取最新权限
    await invalidateUserCache(userId);

    await logDataChange(req.user.id, 'ASSIGN_PERMISSION_GROUP', `user_${targetUser.id}`, req, targetUser, updatedUser);

    return sendUpdatedResponse(res, {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      permissions: parseJsonArray(updatedUser.permissions),
      updated_at: updatedUser.updated_at
    }, { resource: 'User permission' });
  } catch (error) {
    next(error);
  }
};

// Batch assign permission groups
export const batchAssignPermissionGroups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = batchAssignPermissionGroupSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid batch input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { userIds, group } = validation.data;

    if (!PERMISSION_GROUPS[group as PermissionGroup]) {
      throw new AppError('Invalid permission group', 400, ErrorCode.INVALID_INPUT);
    }

    const groupInfo = PERMISSION_GROUPS[group as PermissionGroup];

    const results = await Promise.allSettled(
      userIds.map(async (userId: number) => {
        const targetUser = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!targetUser) {
          return { userId, success: false, error: 'User not found' };
        }

        const assignerPermissions = req.user!.permissions ? JSON.parse(req.user!.permissions) : [];

        const validation = PermissionGroupManager.validateGroupAssignment(
          targetUser.role as PermissionGroup,
          group as PermissionGroup,
          assignerPermissions,
          req.user!.role as PermissionGroup,
          req.isAdmin
        );

        if (!validation.valid) {
          return { userId, success: false, error: validation.message || 'Forbidden' };
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            role: group,
            permissions: JSON.stringify(groupInfo.permissions),
            updated_at: new Date()
          }
        });

        // 清除用户缓存
        await invalidateUserCache(userId);

        await prisma.permissionHistory.create({
          data: {
            user_id: userId,
            admin_id: req.user!.id,
            action: 'ROLE_CHANGE',
            permission: `${targetUser.role} -> ${group}`
          }
        });

        return { userId, success: true, username: targetUser.username };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;

    await logDataChange(req.user.id, 'BATCH_PERMISSION_GROUP_ASSIGNED', 'permission_groups', req, null, {
      total: userIds.length,
      successful,
      failed,
      group
    });

    return sendBatchResponse(
      res,
      results.map((r) => {
        if (r.status === 'fulfilled') {
          return {
            id: r.value.userId,
            success: r.value.success,
            data: r.value.success ? { username: r.value.username, group } : undefined,
            error: r.value.success ? undefined : r.value.error,
          };
        }
        return {
          success: false,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        };
      }),
      {
        resource: 'Permission group assignment',
        meta: { group, successful, failed, total: userIds.length },
      },
    );

  } catch (error) {
    next(error);
  }
};

export const getPermissionHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = permissionHistoryQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { userId, page, limit } = validation.data;
    const skip = (page - 1) * limit;
    const whereClause = userId ? { user_id: userId } : {};

    const history = await prisma.permissionHistory.findMany({
      where: whereClause,
      include: {
        user: { select: { username: true, email: true } },
        admin: { select: { username: true, email: true } }
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' }
    });

    const totalCount = await prisma.permissionHistory.count({ where: whereClause });
    return sendListResponse(res, history, totalCount, page, limit, { resource: 'Permission history' });
  } catch (error) {
    next(error);
  }
};

export const getPermissionStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const groupStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
      where: {
        role: { in: Object.keys(PERMISSION_GROUPS) as string[] }
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayChanges = await prisma.permissionHistory.count({
      where: { created_at: { gte: today } }
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const trend = await prisma.permissionHistory.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      select: { created_at: true },
      orderBy: { created_at: 'asc' }
    });

    const dailyTrend: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyTrend[d.toISOString().split('T')[0]] = 0;
    }

    trend.forEach(item => {
      const date = item.created_at.toISOString().split('T')[0];
      if (dailyTrend[date] !== undefined) dailyTrend[date]++;
    });

    return sendDetailResponse(res, {
      groups: groupStats,
      today: todayChanges,
      trend: Object.entries(dailyTrend).map(([date, count]) => ({ date, count })).reverse()
    }, { resource: 'Permission stats' });
  } catch (error) {
    next(error);
  }
};

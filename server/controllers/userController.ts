import { Response, NextFunction } from 'express';
import prisma from '../db';
import { toSafeUser, sendSuccess, sendPaginated } from '../utils/response';
import { AppError, ErrorCode } from '../utils/errors';
import { sanitize } from '../services/sanitize';
import { AuthRequest, invalidateUserCache } from '../middleware/auth';
import { ModerationService } from '../services/moderationService';
import { logDataChange } from '../services/auditService';
import { profileUpdateSchema, bioVersionQuerySchema } from '../utils/validation';
import { parseJsonArray, parseJsonObject, stringifyJsonField } from '../utils/jsonField';

/**
 * Get current user profile
 */
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
    }

    const userWithParsedPermissions = {
      ...user,
      permissions: parseJsonArray(user.permissions),
      preferences: parseJsonObject(user.preferences, {}),
    };

    return sendSuccess(res, toSafeUser(userWithParsedPermissions, { mask: false }), 'Success', 200, undefined, { mask: false });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 */
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = profileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }

    const { username, display_name, avatar_url, preferences, bio_html } = validation.data;

    // Strict sanitization for display fields
    const cleanUsername = username ? sanitize(username, { allowedTags: [] }) : undefined;
    const cleanDisplayName = display_name ? sanitize(display_name, { allowedTags: [] }) : undefined;
    const sanitizedBio = bio_html !== undefined ? sanitize(bio_html) : undefined;

    // Check username uniqueness if provided
    if (cleanUsername) {
      const existing = await prisma.user.findFirst({
        where: {
          username: cleanUsername,
          id: { not: userId }
        }
      });
      if (existing) {
        throw new AppError('Username already taken', 400, ErrorCode.BAD_REQUEST);
      }
    }

    const moderationText = `${cleanDisplayName || ''} ${sanitizedBio || ''}`;
    if (moderationText.trim()) {
      const moderationResult = await ModerationService.checkText(moderationText, userId);
      if (!moderationResult.passed) {
        throw new AppError(moderationResult.reason || 'Content violates guidelines, please modify and try again', 400, ErrorCode.VALIDATION_ERROR);
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: cleanUsername,
        display_name: cleanDisplayName,
        avatar_url,
        preferences: preferences ? stringifyJsonField(preferences) : undefined,
        bio_html: sanitizedBio,
      },
    });

    // 清除用户缓存
    await invalidateUserCache(userId);

    if (sanitizedBio !== undefined && existingUser?.bio_html !== sanitizedBio) {
      const last = await prisma.userBioVersion.findFirst({
        where: { user_id: userId },
        orderBy: { version: 'desc' },
      });
      
      const nextVersion = (last?.version || 0) + 1;
      await prisma.userBioVersion.create({
        data: {
          user_id: userId,
          version: nextVersion,
          content_html: sanitizedBio,
          editor_id: userId,
        },
      });
    }

    await logDataChange(userId, 'UPDATE_PROFILE', `user_${userId}`, req, existingUser, updatedUser);

    return sendSuccess(res, toSafeUser(updatedUser, { mask: false }), 'Success', 200, undefined, { mask: false });
  } catch (error) {
    next(error);
  }
};

/**
 * List biography versions for current user
 */
export const listBioVersions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);

    const validation = bioVersionQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }
    const { page, limit } = validation.data;
    const skip = (page - 1) * limit;
    
    const [versions, total] = await Promise.all([
      prisma.userBioVersion.findMany({
        where: { user_id: userId },
        orderBy: { version: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userBioVersion.count({ where: { user_id: userId } })
    ]);
    
    return sendPaginated(res, versions, total, page, limit);
  } catch (error) {
    next(error);
  }
};

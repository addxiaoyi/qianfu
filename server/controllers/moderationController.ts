import { Request, Response, NextFunction } from 'express';
import prisma from '../db';
import { getConfig, setConfig } from '../services/configService';
import { sendSuccess, sendPaginated } from '../utils/response';
import { logAction, logDataChange } from '../services/auditService';
import { AuthRequest } from '../middleware/auth';
import { AppError, ErrorCode } from '../utils/errors';
import { updateModerationConfigSchema, moderationLogQuerySchema, idParamSchema, reviewModerationLogSchema } from '../utils/validation';

export const getModerationConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = (await getConfig('MODERATION_ENABLED')) === 'true';
    const threshold = await getConfig('MODERATION_TEXT_THRESHOLD') || '0.7';
    const imageThreshold = await getConfig('MODERATION_IMAGE_THRESHOLD') || '0.8';
    
    // Mask API Key for security
    const apiKey = await getConfig('MODERATION_API_KEY', true);
    const maskedApiKey = apiKey ? `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}` : '';

    return sendSuccess(res, {
      enabled,
      threshold: parseFloat(threshold),
      imageThreshold: parseFloat(imageThreshold),
      apiKey: maskedApiKey
    }, 'Success');
  } catch (error) {
    next(error);
  }
};

export const updateModerationConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = updateModerationConfigSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }
    const { enabled, threshold, imageThreshold, apiKey } = validation.data;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    if (enabled !== undefined) {
      await setConfig('MODERATION_ENABLED', enabled.toString(), false, `Moderation enabled: ${enabled}`);
    }
    
    if (threshold !== undefined) {
      await setConfig('MODERATION_TEXT_THRESHOLD', threshold.toString(), false, `Text threshold: ${threshold}`);
    }

    if (imageThreshold !== undefined) {
      await setConfig('MODERATION_IMAGE_THRESHOLD', imageThreshold.toString(), false, `Image threshold: ${imageThreshold}`);
    }

    if (apiKey && !apiKey.includes('****')) {
      await setConfig('MODERATION_API_KEY', apiKey, true, 'Moderation API Key');
    }

    // Audit the configuration change
    await logAction(userId, 'UPDATE_MODERATION_CONFIG', 'system_config', req, {
      enabled,
      threshold,
      imageThreshold,
      hasApiKey: !!apiKey
    });

    return sendSuccess(res, null, 'Success');
  } catch (error) {
    next(error);
  }
};

export const getModerationLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = moderationLogQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }
    const { status, type, contentType, page, limit } = validation.data;
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (status) where.status = status;
    if (type) where.content_type = type;
    if (contentType) where.content_type = contentType;

    const [logs, total] = await Promise.all([
      prisma.moderationLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              display_name: true
            }
          }
        }
      }),
      prisma.moderationLog.count({ where })
    ]);

    return sendPaginated(res, logs, total, page, limit, 'Success');
  } catch (error) {
    next(error);
  }
};

export const reviewModerationLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const idValidation = idParamSchema.safeParse({ id: req.params.id });
    if (!idValidation.success) {
      throw new AppError('Invalid ID', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: idValidation.error.issues,
      });
    }
    const { id } = idValidation.data;

    const validation = reviewModerationLogSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }
    const { status, reason: adminNotes } = validation.data;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const existingLog = await prisma.moderationLog.findUnique({
      where: { id: Number(id) }
    });

    if (!existingLog) {
      throw new AppError('Moderation log not found', 404, ErrorCode.NOT_FOUND);
    }

    const updatedLog = await prisma.moderationLog.update({
      where: { id: Number(id) },
      data: {
        action: status,
        reason: adminNotes
      }
    });

    await logDataChange(userId, 'REVIEW_MODERATION_LOG', `moderation_log_${id}`, req, existingLog, updatedLog);

    return sendSuccess(res, updatedLog, 'Success');
  } catch (error) {
    next(error);
  }
};

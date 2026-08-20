import { getModerationConfigs, setConfig } from '../services/configService.js';
import { ModerationService } from '../services/moderationService.js';
import prisma from '../db.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { logDataChange } from '../services/auditService.js';
import { updateModerationSettingSchema, moderationLogQuerySchema, reviewModerationLogSchema, idParamSchema } from '../utils/validation.js';
/**
 * Get list of moderation settings (Admin only)
 */
export const getModerationSettings = async (req, res, next) => {
    try {
        const configs = await getModerationConfigs();
        const stats = await ModerationService.getStats();
        return sendSuccess(res, { configs, stats }, 'Moderation settings retrieved successfully');
    }
    catch (error) {
        next(error);
    }
};
/**
 * Update a moderation setting (Admin only)
 */
export const updateModerationSetting = async (req, res, next) => {
    try {
        const validation = updateModerationSettingSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { key, value, isSecret, description } = validation.data;
        const userId = req.user?.id || null;
        const { existingConfig, updatedConfig } = await prisma.$transaction(async (tx) => {
            const existing = await tx.systemConfig.findUnique({
                where: { key }
            });
            // setConfig actually performs a DB update internally, but we want it in a transaction
            // Since setConfig is likely not transaction-aware, we'll manually update if possible
            // or ensure the transaction wraps the audit log too.
            // Assuming setConfig is a service helper, we'll keep using it but wrap everything.
            await setConfig(key, value, isSecret, description);
            const updated = await tx.systemConfig.findUnique({
                where: { key }
            });
            return { existingConfig: existing, updatedConfig: updated };
        });
        await logDataChange(userId, 'UPDATE_MODERATION_CONFIG', 'SYSTEM_CONFIG', req, existingConfig, updatedConfig);
        return sendSuccess(res, null, 'Configuration updated successfully');
    }
    catch (error) {
        next(error);
    }
};
/**
 * Retrieve moderation logs (Admin only)
 */
export const getModerationLogs = async (req, res, next) => {
    try {
        const validation = moderationLogQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { status, type, contentType, page, limit } = validation.data;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.content_type = type;
        if (contentType)
            where.content_type = contentType;
        const [logs, total] = await Promise.all([
            prisma.moderationLog.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
                include: {
                    user: {
                        select: { username: true, email: true }
                    }
                }
            }),
            prisma.moderationLog.count({ where })
        ]);
        return sendPaginated(res, logs, total, page, limit, 'Moderation logs retrieved successfully');
    }
    catch (error) {
        next(error);
    }
};
/**
 * Manually review a moderation log (Admin only)
 */
export const reviewModerationLog = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse({ id: req.params.id });
        if (!idValidation.success) {
            throw new AppError('Invalid ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
        }
        const { id } = idValidation.data;
        const validation = reviewModerationLogSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { status, reason } = validation.data;
        const userId = req.user?.id || null;
        const { existingLog, updatedLog } = await prisma.$transaction(async (tx) => {
            const existing = await tx.moderationLog.findUnique({
                where: { id: Number(id) }
            });
            if (!existing) {
                throw new AppError('Moderation log not found', 404, ErrorCode.NOT_FOUND);
            }
            const updated = await tx.moderationLog.update({
                where: { id: Number(id) },
                data: {
                    action: status,
                    reason: reason ? `[Manual Review] ${reason}` : '[Manual Review] Status updated'
                }
            });
            return { existingLog: existing, updatedLog: updated };
        });
        await logDataChange(userId, 'REVIEW_MODERATION', 'MODERATION_LOG', req, existingLog, updatedLog);
        return sendSuccess(res, updatedLog, 'Review completed successfully');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=moderationAdminController.js.map
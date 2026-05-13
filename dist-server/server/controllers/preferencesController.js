import prisma from '../db';
import { logDataChange } from '../services/auditService';
import { sendSuccess } from '../utils/response';
import { AppError, ErrorCode } from '../utils/errors';
import { invalidateUserCache } from '../middleware/auth';
import { preferencesUpdateSchema } from '../utils/validation';
/**
 * Update user preferences
 */
export const updatePreferences = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const validation = preferencesUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { theme, language, emailNotifications } = validation.data;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true }
        });
        const currentPreferences = user?.preferences ? JSON.parse(user.preferences) : {};
        const updatedPreferences = {
            ...currentPreferences,
            ...(theme !== undefined && { theme }),
            ...(language !== undefined && { language }),
            ...(emailNotifications !== undefined && { emailNotifications }),
            updatedAt: new Date().toISOString()
        };
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                preferences: JSON.stringify(updatedPreferences)
            }
        });
        // 清除用户缓存
        await invalidateUserCache(userId);
        await logDataChange(userId, 'UPDATE_PREFERENCES', 'user_preferences', req, user, updatedUser);
        return sendSuccess(res, { preferences: updatedPreferences }, 'Success');
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get user preferences
 */
export const getPreferences = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true }
        });
        const preferences = user?.preferences ? JSON.parse(user.preferences) : {
            theme: 'system',
            language: 'en',
            emailNotifications: true,
            updatedAt: null
        };
        sendSuccess(res, { preferences }, 'Success');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=preferencesController.js.map
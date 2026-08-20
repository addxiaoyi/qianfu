import prisma from '../../db.js';
import { myServersQuerySchema } from '../../utils/validation.js';
import { AppError, ErrorCode, handleError } from '../../utils/errors.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { PermissionGroupManager } from '../../config/permissionGroups.js';
import { getEffectiveServerLimit, userCanPublishServers } from '../../services/userLevelService.js';
/**
 * Get current user profile and server limits
 */
export const getMe = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const count = await prisma.server.count({ where: { owner_id: user.id } });
        return sendSuccess(res, {
            id: user.id,
            email: user.email,
            username: user.username,
            display_name: user.display_name || user.username || user.email,
            avatar_url: user.avatar_url || null,
            role: user.role,
            bio_html: user.bio_html,
            max_cards: getEffectiveServerLimit(user),
            current_cards: count,
            can_publish: userCanPublishServers(user),
            created_at: user.created_at,
            last_login_at: user.last_login_at,
            account_status: user.email_verified ? 'active' : 'pending',
        });
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * List servers owned by current user
 */
export const listMyServers = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const validation = myServersQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { page, limit } = validation.data;
        const skip = (page - 1) * limit;
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        const canManageAll = PermissionGroupManager.hasPermission(userPermissions, 'manage_content') || user.role === 'ADMIN';
        const where = canManageAll ? {} : { owner_id: user.id };
        const [servers, total] = await Promise.all([
            prisma.server.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    name_en: true,
                    thumbnail: true,
                    summary: true,
                    summary_en: true,
                    ip: true,
                    group_number: true,
                    tags: true,
                    activity: true,
                    updated_at: true,
                    owner_id: true,
                    link: true,
                    review_status: true,
                    listing_plan: true,
                    listing_started_at: true,
                    listing_expires_at: true,
                    listing_price_paid: true,
                    review_notes: true,
                    reviewed_at: true,
                    like_count: true,
                },
                orderBy: { updated_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.server.count({ where })
        ]);
        return sendPaginated(res, servers, total, page, limit);
    }
    catch (error) {
        next(handleError(error));
    }
};
//# sourceMappingURL=user.js.map
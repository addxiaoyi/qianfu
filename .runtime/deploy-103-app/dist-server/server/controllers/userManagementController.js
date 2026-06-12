import prisma from '../db.js';
import { logDataChange } from '../services/auditService.js';
import { sendSuccess, sendListResponse } from '../utils/response.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { PermissionGroupManager } from '../config/permissionGroups.js';
import { userRoleUpdateSchema, idParamSchema, userQuerySchema } from '../utils/validation.js';
import { redisService } from '../services/redisService.js';
import { buildDateRange, buildKeywordOrConditions, buildPagination, resolveSortField, resolveSortOrder, } from '../utils/queryBuilder.js';
import { withCache, cacheDelete } from '../services/cache.js';
const USER_STATS_CACHE_KEY = 'admin:user_stats';
export const listUsers = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || !user.permissions) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        if (!userPermissions.includes('manage_users')) {
            throw new AppError('Forbidden: Insufficient permissions', 403, ErrorCode.FORBIDDEN);
        }
        const validation = userQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: validation.error.issues,
            });
        }
        const { page, limit, search, role, status, sortBy, sortOrder, startDate, endDate, fuzzy } = validation.data;
        const { skip, take } = buildPagination({ page, limit });
        const where = {};
        if (search) {
            where.OR = [
                ...buildKeywordOrConditions(['username', 'email', 'display_name'], search, fuzzy),
            ];
        }
        if (role) {
            where.role = role;
        }
        if (status === 'verified') {
            where.email_verified = true;
        }
        else if (status === 'unverified') {
            where.email_verified = false;
        }
        const range = buildDateRange({ startDate, endDate });
        if (range) {
            where.created_at = range;
        }
        const normalizedSortField = resolveSortField(sortBy, ['created_at', 'last_login_at', 'username', 'email'], 'created_at');
        const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    display_name: true,
                    avatar_url: true,
                    role: true,
                    permissions: true,
                    email_verified: true,
                    created_at: true,
                    last_login_at: true,
                    login_count: true
                },
                orderBy: { [normalizedSortField]: normalizedSortOrder },
                skip,
                take,
            }),
            prisma.user.count({ where })
        ]);
        const usersWithRoleInfo = users.map(u => ({
            ...u,
            permissions: u.permissions ? JSON.parse(u.permissions) : [],
            roleInfo: PermissionGroupManager.getGroup(u.role)
        }));
        return sendListResponse(res, usersWithRoleInfo, total, page, limit, { resource: 'User' });
    }
    catch (error) {
        next(error);
    }
};
export const updateUserRole = async (req, res, next) => {
    try {
        const adminUser = req.user;
        if (!adminUser || !adminUser.permissions) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const adminPermissions = adminUser.permissions ? JSON.parse(adminUser.permissions) : [];
        const idValidation = idParamSchema.safeParse({ id: req.params.userId });
        if (!idValidation.success) {
            throw new AppError('Invalid User ID', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: idValidation.error.issues,
            });
        }
        const userId = idValidation.data.id;
        const roleValidation = userRoleUpdateSchema.safeParse(req.body);
        if (!roleValidation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: roleValidation.error.issues,
            });
        }
        const { role } = roleValidation.data;
        const targetUser = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!targetUser) {
            throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
        }
        const validation = PermissionGroupManager.validateGroupAssignment(targetUser.role, role, adminPermissions, adminUser.role);
        if (!validation.valid) {
            throw new AppError(validation.message || 'Permission validation failed', 403, ErrorCode.FORBIDDEN);
        }
        const groupInfo = PermissionGroupManager.getGroup(role);
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                role: role,
                permissions: JSON.stringify(groupInfo.permissions),
                updated_at: new Date()
            }
        });
        // 清除用户缓存，确保下次认证时获取最新权限
        await invalidateUserCache(userId);
        await logDataChange(adminUser.id, 'UPDATE_USER_ROLE', `user_${updatedUser.id}`, req, targetUser, updatedUser);
        // Invalidate stats cache
        cacheDelete(USER_STATS_CACHE_KEY);
        await redisService.del(USER_STATS_CACHE_KEY);
        await redisService.del('global:stats');
        return sendSuccess(res, {
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                username: updatedUser.username,
                role: updatedUser.role,
                permissions: groupInfo.permissions,
                roleInfo: groupInfo
            }
        }, 'Success');
    }
    catch (error) {
        next(error);
    }
};
export const getUserStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || !user.permissions) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        if (!userPermissions.includes('manage_users')) {
            throw new AppError('Forbidden: Insufficient permissions', 403, ErrorCode.FORBIDDEN);
        }
        const stats = await withCache(USER_STATS_CACHE_KEY, async () => {
            const totalUsers = await prisma.user.count();
            const roleStats = await prisma.user.groupBy({
                by: ['role'],
                _count: {
                    id: true
                }
            });
            const verifiedUsers = await prisma.user.count({
                where: { email_verified: true }
            });
            const activeUsers = await prisma.user.count({
                where: {
                    last_login_at: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                }
            });
            return {
                totalUsers,
                verifiedUsers,
                activeUsers,
                roleStats: roleStats.map(stat => ({
                    role: stat.role,
                    count: stat._count.id,
                    roleInfo: PermissionGroupManager.getGroup(stat.role)
                }))
            };
        }, { ttl: 600000 }); // 10 minutes cache
        return sendSuccess(res, stats);
    }
    catch (error) {
        next(error);
    }
};
export const getAvailableRoles = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || !user.permissions) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        if (!userPermissions.includes('manage_users')) {
            throw new AppError('Forbidden: Insufficient permissions', 403, ErrorCode.FORBIDDEN);
        }
        const groups = PermissionGroupManager.getAllGroups();
        // Convert to the format needed by the frontend
        const roles = Object.entries(groups)
            .filter(([key]) => {
            // Filter roles that the current user is allowed to assign
            // We check if the admin can assign this role to a regular user as a base check
            return PermissionGroupManager.validateGroupAssignment('USER', key, userPermissions, user.role).valid;
        })
            .map(([key, group]) => ({
            role: key,
            ...group
        }));
        return sendSuccess(res, roles);
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=userManagementController.js.map
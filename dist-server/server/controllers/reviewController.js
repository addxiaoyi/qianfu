import prisma from '../db';
import localPrisma from '../localDb';
import { logger } from '../utils/logger';
import { REVIEW_CONFIG, ReviewStatus } from '../config/reviewConfig';
import { AppError, ErrorCode } from '../utils/errors';
import { logAction, logDataChange } from '../services/auditService';
import { syncServerToMainDB } from '../services/syncService';
import { redisService } from '../services/redisService';
import { withCache } from '../services/cache';
const REVIEW_STATS_CACHE_KEY = 'admin:review_stats';
import { reviewActionSchema, batchReviewSchema, reviewQuerySchema, serverIdParamSchema, paginationQuerySchema } from '../utils/validation';
import { sanitize } from '../services/sanitize';
import { hookService, MotiaHook } from '../services/hookService';
import { clearPublicServersCache } from '../services/publicServerCache';
import { sendBatchResponse, sendDetailResponse, sendListResponse, sendUpdatedResponse, } from '../utils/response';
export const getPendingReviews = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const validation = reviewQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: validation.error.issues,
            });
        }
        const { sortBy, sortOrder, page, limit } = validation.data;
        const skip = (page - 1) * limit;
        const pendingServers = await localPrisma.server.findMany({
            where: {
                review_status: 'PENDING'
            },
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder
            }
        });
        const ownerIds = [...new Set(pendingServers.map(s => s.owner_id))];
        const owners = await prisma.user.findMany({
            where: {
                id: { in: ownerIds }
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true
            }
        });
        const ownersMap = new Map(owners.map(o => [o.id, o]));
        const enrichedServers = pendingServers.map(s => ({
            ...s,
            owner: ownersMap.get(s.owner_id) || null
        }));
        const totalCount = await localPrisma.server.count({
            where: {
                review_status: 'PENDING'
            }
        });
        return sendListResponse(res, enrichedServers, totalCount, page, limit, { resource: 'Review task' });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Review a server submission
 */
export const reviewServer = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const idValidation = serverIdParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: idValidation.error.issues,
            });
        }
        const { serverId: serverIdInt } = idValidation.data;
        const validation = reviewActionSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: validation.error.issues,
            });
        }
        const { status, notes: feedback, score } = validation.data;
        const sanitizedFeedback = feedback ? sanitize(feedback) : '';
        if (!Object.values(ReviewStatus).includes(status)) {
            throw new AppError('Invalid status', 400, ErrorCode.INVALID_INPUT);
        }
        const server = await localPrisma.server.findUnique({
            where: { id: serverIdInt }
        });
        if (!server) {
            throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
        }
        if (server.owner_id === req.user.id && req.user.role !== 'ADMIN') {
            throw new AppError('Cannot review your own server', 403, ErrorCode.FORBIDDEN);
        }
        const updatedServer = await localPrisma.$transaction(async (tx) => {
            const currentServer = await tx.server.findUnique({
                where: { id: serverIdInt }
            });
            if (!currentServer || currentServer.review_status !== 'PENDING') {
                throw new AppError('Server not found or already reviewed', 400, ErrorCode.INVALID_OPERATION);
            }
            const updated = await tx.server.update({
                where: { id: serverIdInt },
                data: {
                    review_status: status,
                    review_notes: sanitizedFeedback,
                    reviewed_by: req.user.id,
                    reviewed_at: new Date()
                }
            });
            return updated;
        });
        syncServerToMainDB(updatedServer.id).catch(() => { });
        // Clear public cache since review status changed
        await clearPublicServersCache();
        await redisService.del(`server:info:${updatedServer.id}`);
        await prisma.reviewHistory.create({
            data: {
                server_id: serverIdInt,
                reviewer_id: req.user.id,
                action: status,
                notes: sanitizedFeedback + (score ? ` (Score: ${score})` : ''),
                created_at: new Date()
            }
        });
        await logDataChange(req.user.id, 'SERVER_REVIEWED', `server_${serverIdInt}`, req, server, updatedServer);
        // Trigger Hooks
        if (status === 'APPROVED') {
            hookService.trigger(MotiaHook.SERVER_APPROVED, { server: updatedServer, reviewer: req.user });
        }
        else if (status === 'REJECTED') {
            hookService.trigger(MotiaHook.SERVER_REJECTED, { server: updatedServer, reviewer: req.user, reason: sanitizedFeedback });
        }
        // Send notification to owner
        try {
            const locale = req.locale || 'zh';
            const notificationTitle = status === 'APPROVED'
                ? (locale === 'zh' ? '服务器审核通过' : 'Server Review Approved')
                : (locale === 'zh' ? '服务器审核未通过' : 'Server Review Rejected');
            const notificationContent = status === 'APPROVED'
                ? (locale === 'zh' ? `您的服务器 "${server.name}" 已通过审核并发布。` : `Your server "${server.name}" has been approved and published.`)
                : (locale === 'zh' ? `您的服务器 "${server.name}" 未通过审核。原因: ${sanitizedFeedback || '无'}` : `Your server "${server.name}" was not approved. Reason: ${sanitizedFeedback || 'None'}`);
            await localPrisma.notification.create({
                data: {
                    user_id: server.owner_id,
                    title: notificationTitle,
                    content: notificationContent,
                    type: status === 'APPROVED' ? 'SUCCESS' : 'ERROR'
                }
            });
        }
        catch (e) {
            logger.error('[Notification] Failed to send review notification:', {
                error: e instanceof Error ? e.message : String(e),
            });
        }
        return sendUpdatedResponse(res, updatedServer, { resource: 'Review' });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Retrieve review history for a server
 */
export const getReviewHistory = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const idValidation = serverIdParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: idValidation.error.issues,
            });
        }
        const { serverId: serverIdInt } = idValidation.data;
        const queryValidation = paginationQuerySchema.safeParse(req.query);
        if (!queryValidation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: queryValidation.error.issues,
            });
        }
        const { page, limit } = queryValidation.data;
        const skip = (page - 1) * limit;
        // Security Check: Verify ownership or admin/reviewer status
        const server = await localPrisma.server.findUnique({
            where: { id: serverIdInt },
            select: { owner_id: true }
        });
        if (!server) {
            throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
        }
        if (server.owner_id !== req.user.id && !req.isAdmin) {
            throw new AppError('Forbidden: You do not have permission to view this server\'s review history', 403, ErrorCode.FORBIDDEN);
        }
        const history = await prisma.reviewHistory.findMany({
            where: {
                server_id: serverIdInt
            },
            include: {
                reviewer: {
                    select: {
                        username: true,
                        display_name: true
                    }
                }
            },
            skip,
            take: limit,
            orderBy: {
                created_at: 'desc'
            }
        });
        const totalCount = await prisma.reviewHistory.count({
            where: {
                server_id: serverIdInt
            }
        });
        return sendListResponse(res, history, totalCount, page, limit, { resource: 'Review history' });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Batch review multiple servers
 */
export const batchReview = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const validation = batchReviewSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { serverIds, status, feedback } = validation.data;
        const sanitizedFeedback = feedback ? sanitize(feedback) : '';
        const results = await Promise.allSettled(serverIds.map(async (serverId) => {
            try {
                const result = await localPrisma.$transaction(async (tx) => {
                    const server = await tx.server.findUnique({
                        where: { id: serverId }
                    });
                    if (!server || server.review_status !== 'PENDING') {
                        return { serverId, success: false, error: 'Not pending' };
                    }
                    const updatedServer = await tx.server.update({
                        where: { id: serverId },
                        data: {
                            review_status: status,
                            review_notes: sanitizedFeedback,
                            reviewed_by: req.user.id,
                            reviewed_at: new Date()
                        }
                    });
                    // Send notification
                    try {
                        const locale = req.locale || 'zh';
                        const notificationTitle = status === 'APPROVED'
                            ? (locale === 'zh' ? '服务器批量审核通过' : 'Server Batch Review Approved')
                            : (locale === 'zh' ? '服务器批量审核未通过' : 'Server Batch Review Rejected');
                        const notificationContent = status === 'APPROVED'
                            ? (locale === 'zh' ? `您的服务器 "${server.name}" 已通过批量审核并发布。` : `Your server "${server.name}" has been approved and published via batch review.`)
                            : (locale === 'zh' ? `您的服务器 "${server.name}" 未通过批量审核。原因: ${sanitizedFeedback || '无'}` : `Your server "${server.name}" was not approved via batch review. Reason: ${sanitizedFeedback || 'None'}`);
                        await tx.notification.create({
                            data: {
                                user_id: server.owner_id,
                                title: notificationTitle,
                                content: notificationContent,
                                type: status === 'APPROVED' ? 'SUCCESS' : 'ERROR'
                            }
                        });
                    }
                    catch (e) { }
                    await logDataChange(req.user.id, 'SERVER_BATCH_REVIEWED', `server_${serverId}`, req, server, updatedServer);
                    // Trigger Hooks
                    if (status === 'APPROVED') {
                        hookService.trigger(MotiaHook.SERVER_APPROVED, { server: updatedServer, reviewer: req.user, batch: true });
                    }
                    else if (status === 'REJECTED') {
                        hookService.trigger(MotiaHook.SERVER_REJECTED, { server: updatedServer, reviewer: req.user, reason: sanitizedFeedback, batch: true });
                    }
                    return { serverId, success: true, serverName: server.name, updatedServerId: updatedServer.id };
                });
                if (result.success && result.updatedServerId) {
                    syncServerToMainDB(result.updatedServerId).catch(err => {
                        logger.error(`[Sync] Batch sync failed for server ${result.updatedServerId}: ${err.message}`);
                    });
                    await prisma.reviewHistory.create({
                        data: {
                            server_id: serverId,
                            reviewer_id: req.user.id,
                            action: status,
                            notes: sanitizedFeedback,
                            created_at: new Date()
                        }
                    });
                }
                return result;
            }
            catch (err) {
                return { serverId, success: false, error: err.message };
            }
        }));
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;
        // Clear caches if any successful reviews
        if (successful > 0) {
            await clearPublicServersCache();
            // Clear individual server caches
            for (const res of results) {
                if (res.status === 'fulfilled' && res.value.success) {
                    const val = res.value;
                    if (val.updatedServerId) {
                        await redisService.del(`server:info:${val.updatedServerId}`);
                    }
                }
            }
        }
        await logAction(req.user.id, 'BATCH_REVIEW_COMPLETED', 'review', req, {
            total: serverIds.length,
            successful,
            failed,
            status
        });
        return sendBatchResponse(res, results.map((result) => {
            if (result.status === 'fulfilled') {
                return {
                    id: result.value.serverId,
                    success: result.value.success,
                    data: result.value.success
                        ? {
                            updatedServerId: result.value.updatedServerId,
                            serverName: result.value.serverName,
                        }
                        : undefined,
                    error: result.value.success ? undefined : result.value.error,
                };
            }
            return {
                success: false,
                error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            };
        }), {
            resource: 'Review',
            meta: {
                total: serverIds.length,
                successful,
                failed,
                status,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get review system statistics
 */
export const getReviewStats = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const stats = await withCache(REVIEW_STATS_CACHE_KEY, async () => {
            const totalPending = await localPrisma.server.count({
                where: { review_status: 'PENDING' }
            });
            const totalApproved = await localPrisma.server.count({
                where: { review_status: 'APPROVED' }
            });
            const totalRejected = await localPrisma.server.count({
                where: { review_status: 'REJECTED' }
            });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const totalTodayReviews = await prisma.reviewHistory.count({
                where: {
                    created_at: {
                        gte: today
                    }
                }
            });
            return {
                totalPending,
                totalApproved,
                totalRejected,
                totalTodayReviews
            };
        }, { ttl: 300000 }); // 5 minutes cache
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const userReviewsToday = await prisma.reviewHistory.count({
            where: {
                reviewer_id: req.user.id,
                created_at: {
                    gte: today
                }
            }
        });
        await logAction(req.user.id, 'REVIEW_STATS_VIEWED', 'review', req, {
            ...stats,
            userReviewsToday
        });
        return sendDetailResponse(res, {
            ...stats,
            userReviewsToday,
            reviewLimits: REVIEW_CONFIG.PERMISSIONS.REVIEW_LIMITS
        }, { resource: 'Review stats' });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=reviewController.js.map
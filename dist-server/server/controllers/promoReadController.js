import prisma from '../db.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendDetailResponse, sendSuccess } from '../utils/response.js';
import { getRouteParam } from '../utils/requestParams.js';
const parseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid task ID', 400, ErrorCode.VALIDATION_ERROR);
    }
    return id;
};
const parsePagination = (query) => {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    return { page, limit, skip: (page - 1) * limit };
};
export const getUserPromoTask = async (req, res, next) => {
    try {
        if (!req.user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const taskId = parseId(getRouteParam(req.params.id));
        const task = await prisma.promoTask.findFirst({
            where: { id: taskId, status: 'ENABLED' },
        });
        if (!task)
            throw new AppError('Task not found', 404, ErrorCode.NOT_FOUND);
        const [userClaimCount, totalClaimCount, latestClaim, binding] = await Promise.all([
            prisma.promoClaimRecord.count({ where: { task_id: task.id, user_id: req.user.id } }),
            prisma.promoClaimRecord.count({ where: { task_id: task.id } }),
            prisma.promoClaimRecord.findFirst({
                where: { task_id: task.id, user_id: req.user.id },
                orderBy: { claim_no: 'desc' },
                select: {
                    id: true,
                    claim_no: true,
                    claim_status: true,
                    reward_status: true,
                    settlement_status: true,
                    video_url: true,
                    highest_rewarded_tier: true,
                    total_rewarded_amount: true,
                    last_metric_at: true,
                    claim_at: true,
                    rewarded_at: true,
                    failed_reason: true,
                    audit_note: true,
                },
            }),
            prisma.promoPlatformBinding.findFirst({
                where: {
                    user_id: req.user.id,
                    platform: task.platform.trim().toLowerCase(),
                    binding_status: 'VERIFIED',
                    verified_at: { not: null },
                },
                select: {
                    id: true,
                    platform: true,
                    platform_user_id: true,
                    platform_username: true,
                    binding_status: true,
                },
            }),
        ]);
        return sendDetailResponse(res, {
            ...task,
            userClaimCount,
            totalClaimCount,
            remainingForUser: Math.max(0, task.claim_limit_per_user - userClaimCount),
            remainingTotal: task.total_limit === null
                ? null
                : Math.max(0, task.total_limit - totalClaimCount),
            latestClaim,
            binding,
        }, { resource: 'PromoTask' });
    }
    catch (error) {
        next(error);
    }
};
export const getAdminPromoTask = async (req, res, next) => {
    try {
        const taskId = parseId(getRouteParam(req.params.id));
        const pageInfo = parsePagination(req.query);
        const task = await prisma.promoTask.findUnique({ where: { id: taskId } });
        if (!task)
            throw new AppError('Task not found', 404, ErrorCode.NOT_FOUND);
        const [claims, total, auditLogs] = await Promise.all([
            prisma.promoClaimRecord.findMany({
                where: { task_id: task.id },
                orderBy: { created_at: 'desc' },
                skip: pageInfo.skip,
                take: pageInfo.limit,
                include: {
                    user: { select: { id: true, email: true, username: true, display_name: true } },
                },
            }),
            prisma.promoClaimRecord.count({ where: { task_id: task.id } }),
            prisma.promoVerifyLog.findMany({
                where: { task_id: task.id },
                orderBy: { created_at: 'desc' },
                take: 50,
            }),
        ]);
        return sendDetailResponse(res, {
            ...task,
            claims,
            auditLogs,
            pagination: {
                page: pageInfo.page,
                limit: pageInfo.limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageInfo.limit)),
            },
        }, { resource: 'PromoTask' });
    }
    catch (error) {
        next(error);
    }
};
export const listAdminPromoClaims = async (req, res, next) => {
    try {
        const pageInfo = parsePagination(req.query);
        const status = typeof req.query.status === 'string'
            ? req.query.status.trim().toUpperCase()
            : undefined;
        const allowedStatuses = new Set(['PENDING', 'VERIFIED', 'REJECTED', 'REWARDED']);
        if (status && !allowedStatuses.has(status)) {
            throw new AppError('Invalid claim status', 400, ErrorCode.VALIDATION_ERROR);
        }
        const where = status ? { claim_status: status } : {};
        const [claims, total] = await Promise.all([
            prisma.promoClaimRecord.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: pageInfo.skip,
                take: pageInfo.limit,
                include: {
                    task: true,
                    user: { select: { id: true, email: true, username: true, display_name: true } },
                    metric_snapshots: {
                        orderBy: [{ captured_at: 'desc' }, { id: 'desc' }],
                        take: 1,
                    },
                    reward_settlements: { orderBy: { created_at: 'desc' } },
                },
            }),
            prisma.promoClaimRecord.count({ where }),
        ]);
        return sendSuccess(res, {
            data: claims,
            pagination: {
                page: pageInfo.page,
                limit: pageInfo.limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageInfo.limit)),
            },
        }, 'Promotion claims loaded');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=promoReadController.js.map
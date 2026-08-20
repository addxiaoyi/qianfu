import crypto from 'crypto';
import prisma from '../db.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendCreatedResponse, sendDetailResponse, sendSuccess } from '../utils/response.js';
import { promoBindingSchema } from '../schemas/promoSchemas.js';
import { bindPromoPlatformAccount } from '../services/promoBindingService.js';
const isAdmin = (req) => req.isAdmin === true || req.user?.role === 'ADMIN';
const normalizePlatform = (platform) => platform.trim().toLowerCase();
const makeRequestNo = () => `claim_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
const parseRuleConfig = (ruleConfig) => { if (typeof ruleConfig === 'string') {
    try {
        return JSON.parse(ruleConfig);
    }
    catch {
        throw new AppError('Invalid rule_config JSON', 400, ErrorCode.VALIDATION_ERROR);
    }
} if (ruleConfig && typeof ruleConfig === 'object')
    return ruleConfig; throw new AppError('Missing rule_config', 400, ErrorCode.VALIDATION_ERROR); };
const getActiveBinding = async (userId, platform) => prisma.promoPlatformBinding.findFirst({ where: { user_id: userId, platform, binding_status: 'ACTIVE' } });
const verifyActionsLocally = (taskRuleConfig) => { const actions = taskRuleConfig.actions ?? {}; const condition = String(taskRuleConfig.condition ?? 'all_required'); const normalizedActions = { like: Boolean(actions.like), coin: Boolean(actions.coin), favorite: Boolean(actions.favorite), follow: Boolean(actions.follow), share: Boolean(actions.share) }; const enabledValues = Object.values(normalizedActions).filter(Boolean); const passed = condition === 'any_required' ? enabledValues.length > 0 : enabledValues.length > 0; return { passed, actions: normalizedActions, condition, reason: passed ? '' : 'Task rules require at least one enabled action' }; };
const validatePublicHttpsUrl = (value, field) => {
    const raw = String(value ?? '').trim();
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new AppError(`${field} must be a valid HTTPS URL`, 400, ErrorCode.VALIDATION_ERROR);
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new AppError(`${field} must be a valid HTTPS URL`, 400, ErrorCode.VALIDATION_ERROR);
    }
    return url.toString();
};
export const validateTaskPayload = (body) => {
    const title = String(body.title ?? '').trim();
    const platform = normalizePlatform(String(body.platform ?? ''));
    const targetId = String(body.targetId ?? '').trim();
    const targetUrl = validatePublicHttpsUrl(body.targetUrl, 'Target URL');
    const rewardAmount = Math.trunc(Number(body.rewardAmount));
    if (!title || !platform || !targetId || !Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        throw new AppError('Missing or invalid required fields', 400, ErrorCode.VALIDATION_ERROR);
    }
    return { title, platform, targetId, targetUrl, rewardAmount };
};
export const assertPromoClaimCapacity = (capacity) => {
    const perUserLimit = Math.max(1, capacity.claimLimitPerUser);
    if (capacity.userClaimCount >= perUserLimit) {
        throw new AppError('Per-user claim limit reached', 409, ErrorCode.CONFLICT);
    }
    if (capacity.dailyLimit !== null && capacity.dailyClaimCount >= capacity.dailyLimit) {
        throw new AppError('Daily claim limit reached', 409, ErrorCode.CONFLICT);
    }
    if (capacity.totalLimit !== null && capacity.totalClaimCount >= capacity.totalLimit) {
        throw new AppError('Total claim limit reached', 409, ErrorCode.CONFLICT);
    }
};
const startOfShanghaiDay = (now) => {
    const shanghaiOffsetMs = 8 * 60 * 60 * 1000;
    const shifted = new Date(now.getTime() + shanghaiOffsetMs);
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - shanghaiOffsetMs);
};
const isRetryableClaimError = (error) => {
    if (!error || typeof error !== 'object' || !('code' in error))
        return false;
    const code = String(error.code);
    return code === 'P2002' || code === 'P2034';
};
export const listPromoTasks = async (req, res, next) => {
    try {
        // 分页参数
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
        const skip = (page - 1) * limit;
        const userId = req.user?.id;
        const isAdminUser = isAdmin(req);
        // 并行批量查询，避免 N+1 问题
        const [tasks, total, platformBindings, claims] = await Promise.all([
            // 1. 分页查询任务列表
            prisma.promoTask.findMany({
                where: isAdminUser ? {} : { status: 'ENABLED' },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            // 2. 获取总数（用于分页）
            prisma.promoTask.count({
                where: isAdminUser ? {} : { status: 'ENABLED' },
            }),
            // 3. 批量查询用户平台绑定
            userId
                ? prisma.promoPlatformBinding.findMany({
                    where: { user_id: userId },
                })
                : Promise.resolve([]),
            // 4. 批量查询用户的领取记录（仅在有关联任务时）
            Promise.resolve([]).then(async () => {
                const taskQuery = await prisma.promoTask.findMany({
                    where: isAdminUser ? {} : { status: 'ENABLED' },
                    select: { id: true },
                    orderBy: { created_at: 'desc' },
                    skip,
                    take: limit,
                });
                const taskIds = taskQuery.map((t) => t.id);
                if (taskIds.length === 0 || !userId)
                    return [];
                return prisma.promoClaimRecord.findMany({
                    where: {
                        task_id: { in: taskIds },
                        user_id: userId,
                    },
                });
            }),
        ]);
        // 在内存中构建映射表，O(n) 复杂度
        const claimMap = new Map(claims.map((claim) => [claim.task_id, claim]));
        const bindingMap = new Map(platformBindings.map((binding) => [normalizePlatform(binding.platform), binding]));
        const result = tasks.map((task) => ({
            ...task,
            rule_config: task.rule_config,
            claimed: userId ? claimMap.has(task.id) : false,
            claim_status: claimMap.get(task.id)?.claim_status ?? null,
            reward_status: claimMap.get(task.id)?.reward_status ?? null,
            bound: userId ? bindingMap.has(normalizePlatform(task.platform)) : false,
        }));
        return sendSuccess(res, {
            data: result,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        }, 'Promo tasks loaded');
    }
    catch (error) {
        next(error);
    }
};
export const getPromoTask = async (req, res, next) => { try {
    const taskId = Number(req.params.id);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10)));
    if (!Number.isInteger(taskId))
        throw new AppError('Invalid task ID', 400, ErrorCode.VALIDATION_ERROR);
    const task = await prisma.promoTask.findUnique({ where: { id: taskId } });
    if (!task)
        throw new AppError('Task not found', 404, ErrorCode.NOT_FOUND);
    const [claims, totalClaims, auditLogs] = await Promise.all([prisma.promoClaimRecord.findMany({ where: { task_id: task.id }, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit, include: { user: true } }), prisma.promoClaimRecord.count({ where: { task_id: task.id } }), prisma.promoVerifyLog.findMany({ where: { task_id: task.id }, orderBy: { created_at: 'desc' }, take: 20 })]);
    return sendDetailResponse(res, { ...task, claims, claimPagination: { page, limit, total: totalClaims, totalPages: Math.max(1, Math.ceil(totalClaims / limit)) }, auditLogs }, { resource: 'PromoTask' });
}
catch (error) {
    next(error);
} };
export const getPromoClaimDetail = async (req, res, next) => { try {
    const claimId = Number(req.params.id);
    if (!Number.isInteger(claimId))
        throw new AppError('Invalid claim ID', 400, ErrorCode.VALIDATION_ERROR);
    const claim = await prisma.promoClaimRecord.findUnique({ where: { id: claimId }, include: { task: true } });
    if (!claim)
        throw new AppError('Claim not found', 404, ErrorCode.NOT_FOUND);
    const walletTxs = await prisma.promoWalletTransaction.findMany({ where: { ref_type: 'promo_claim_record', ref_id: claim.id }, orderBy: { created_at: 'desc' }, take: 10 });
    const verifyLogs = await prisma.promoVerifyLog.findMany({ where: { claim_id: claim.id }, orderBy: { created_at: 'desc' }, take: 10 });
    return sendDetailResponse(res, { ...claim, walletTransactions: walletTxs, verifyLogs }, { resource: 'PromoClaimRecord' });
}
catch (error) {
    next(error);
} };
export const createPromoTask = async (req, res, next) => { try {
    if (!isAdmin(req))
        throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    const { description, targetType, coverUrl, rewardType, ruleConfig, claimLimitPerUser, totalLimit, dailyLimit, needAudit, autoVerify, startAt, endAt, status } = req.body ?? {};
    const validated = validateTaskPayload(req.body ?? {});
    const parsedRuleConfig = parseRuleConfig(ruleConfig);
    const task = await prisma.promoTask.create({ data: { title: validated.title, description: description ? String(description) : null, platform: validated.platform, target_type: targetType ? String(targetType) : 'video', target_id: validated.targetId, target_url: validated.targetUrl, cover_url: coverUrl ? String(coverUrl) : null, reward_amount: validated.rewardAmount, reward_type: rewardType ? String(rewardType) : 'BALANCE', rule_config: JSON.stringify(parsedRuleConfig), claim_limit_per_user: claimLimitPerUser ? Math.trunc(Number(claimLimitPerUser)) : 1, total_limit: totalLimit !== undefined && totalLimit !== '' ? Math.trunc(Number(totalLimit)) : null, daily_limit: dailyLimit !== undefined && dailyLimit !== '' ? Math.trunc(Number(dailyLimit)) : null, need_audit: Boolean(needAudit), auto_verify: autoVerify !== undefined ? Boolean(autoVerify) : true, status: status ? String(status).toUpperCase() : 'DRAFT', start_at: startAt ? new Date(String(startAt)) : null, end_at: endAt ? new Date(String(endAt)) : null, created_by: req.user?.id ?? null } });
    return sendCreatedResponse(res, task, { resource: 'PromoTask' });
}
catch (error) {
    next(error);
} };
export const updatePromoTask = async (req, res, next) => { try {
    if (!isAdmin(req))
        throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId))
        throw new AppError('Invalid task ID', 400, ErrorCode.VALIDATION_ERROR);
    const task = await prisma.promoTask.findUnique({ where: { id: taskId } });
    if (!task)
        throw new AppError('Task not found', 404, ErrorCode.NOT_FOUND);
    const { description, targetType, coverUrl, rewardType, ruleConfig, claimLimitPerUser, totalLimit, dailyLimit, needAudit, autoVerify, startAt, endAt, status } = req.body ?? {};
    const validated = validateTaskPayload({ ...task, ...req.body });
    const parsedRuleConfig = parseRuleConfig(ruleConfig ?? task.rule_config);
    const updated = await prisma.promoTask.update({ where: { id: taskId }, data: { title: validated.title, description: description !== undefined ? (description ? String(description) : null) : task.description, platform: validated.platform, target_type: targetType ? String(targetType) : task.target_type, target_id: validated.targetId, target_url: validated.targetUrl, cover_url: coverUrl !== undefined ? (coverUrl ? String(coverUrl) : null) : task.cover_url, reward_amount: validated.rewardAmount, reward_type: rewardType ? String(rewardType) : task.reward_type, rule_config: JSON.stringify(parsedRuleConfig), claim_limit_per_user: claimLimitPerUser ? Math.trunc(Number(claimLimitPerUser)) : task.claim_limit_per_user, total_limit: totalLimit !== undefined && totalLimit !== '' ? Math.trunc(Number(totalLimit)) : task.total_limit, daily_limit: dailyLimit !== undefined && dailyLimit !== '' ? Math.trunc(Number(dailyLimit)) : task.daily_limit, need_audit: needAudit !== undefined ? Boolean(needAudit) : task.need_audit, auto_verify: autoVerify !== undefined ? Boolean(autoVerify) : task.auto_verify, status: status ? String(status).toUpperCase() : task.status, start_at: startAt !== undefined ? (startAt ? new Date(String(startAt)) : null) : task.start_at, end_at: endAt !== undefined ? (endAt ? new Date(String(endAt)) : null) : task.end_at } });
    return sendSuccess(res, updated, 'Task updated');
}
catch (error) {
    next(error);
} };
export const publishPromoTask = async (req, res, next) => { try {
    if (!isAdmin(req))
        throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId))
        throw new AppError('Invalid task ID', 400, ErrorCode.VALIDATION_ERROR);
    const task = await prisma.promoTask.findUnique({ where: { id: taskId } });
    if (!task)
        throw new AppError('Task not found', 404, ErrorCode.NOT_FOUND);
    const ruleConfig = parseRuleConfig(task.rule_config);
    const validation = verifyActionsLocally(ruleConfig);
    if (!validation.passed)
        throw new AppError(validation.reason, 400, ErrorCode.VALIDATION_ERROR);
    const updated = await prisma.promoTask.update({ where: { id: taskId }, data: { status: 'ENABLED', published_by: req.user?.id ?? null, published_at: new Date() } });
    return sendSuccess(res, updated, 'Task published');
}
catch (error) {
    next(error);
} };
export const pausePromoTask = async (req, res, next) => { try {
    if (!isAdmin(req))
        throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId))
        throw new AppError('Invalid task ID', 400, ErrorCode.VALIDATION_ERROR);
    const updated = await prisma.promoTask.update({ where: { id: taskId }, data: { status: 'PAUSED' } });
    return sendSuccess(res, updated, 'Task paused');
}
catch (error) {
    next(error);
} };
export const disablePromoTask = async (req, res, next) => { try {
    if (!isAdmin(req))
        throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId))
        throw new AppError('Invalid task ID', 400, ErrorCode.VALIDATION_ERROR);
    const updated = await prisma.promoTask.update({ where: { id: taskId }, data: { status: 'DISABLED' } });
    return sendSuccess(res, updated, 'Task disabled');
}
catch (error) {
    next(error);
} };
export const bindPlatformAccount = async (req, res, next) => {
    try {
        if (!req.user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const parsed = promoBindingSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError('Invalid platform binding', 400, ErrorCode.VALIDATION_ERROR);
        }
        const binding = await bindPromoPlatformAccount(prisma, req.user.id, parsed.data);
        return sendSuccess(res, binding, 'Platform account bound');
    }
    catch (error) {
        next(error);
    }
};
export const getMyBindings = async (req, res, next) => { try {
    if (!req.user)
        throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    const userId = req.user.id;
    const bindings = await prisma.promoPlatformBinding.findMany({ where: { user_id: userId } });
    return sendSuccess(res, bindings, 'Bindings loaded');
}
catch (error) {
    next(error);
} };
const legacySubmitPromoClaim = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const { taskId, proofData } = req.body ?? {};
        const id = Number(taskId);
        if (!taskId || !Number.isInteger(id)) {
            throw new AppError('Invalid task ID', 400, ErrorCode.VALIDATION_ERROR);
        }
        const task = await prisma.promoTask.findUnique({ where: { id } });
        if (!task)
            throw new AppError('Task not found', 404, ErrorCode.NOT_FOUND);
        const now = new Date();
        if (task.status !== 'ENABLED')
            throw new AppError('Task is not enabled', 400, ErrorCode.VALIDATION_ERROR);
        if (task.start_at && task.start_at > now)
            throw new AppError('Task has not started yet', 400, ErrorCode.VALIDATION_ERROR);
        if (task.end_at && task.end_at < now)
            throw new AppError('Task has expired', 400, ErrorCode.VALIDATION_ERROR);
        const userId = user.id;
        const binding = await getActiveBinding(userId, normalizePlatform(task.platform));
        if (!binding)
            throw new AppError('Platform account not bound', 400, ErrorCode.VALIDATION_ERROR);
        const ruleConfig = parseRuleConfig(task.rule_config);
        const verifyResult = task.auto_verify
            ? verifyActionsLocally(ruleConfig)
            : {
                passed: !task.need_audit,
                actions: {},
                condition: 'manual',
                reason: task.need_audit ? 'Awaiting audit' : '',
            };
        const dayStart = startOfShanghaiDay(now);
        let outcome;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                outcome = await prisma.$transaction(async (tx) => {
                    const existingClaim = await tx.promoClaimRecord.findFirst({
                        where: { user_id: userId, task_id: task.id },
                        orderBy: { created_at: 'desc' },
                    });
                    if (existingClaim)
                        return { claim: existingClaim, created: false };
                    const [userClaimCount, dailyClaimCount, totalClaimCount] = await Promise.all([
                        tx.promoClaimRecord.count({ where: { user_id: userId, task_id: task.id } }),
                        tx.promoClaimRecord.count({ where: { task_id: task.id, claim_at: { gte: dayStart } } }),
                        tx.promoClaimRecord.count({ where: { task_id: task.id } }),
                    ]);
                    assertPromoClaimCapacity({
                        claimLimitPerUser: task.claim_limit_per_user,
                        dailyLimit: task.daily_limit,
                        totalLimit: task.total_limit,
                        userClaimCount,
                        dailyClaimCount,
                        totalClaimCount,
                    });
                    const createdClaim = await tx.promoClaimRecord.create({
                        data: {
                            task_id: task.id,
                            user_id: userId,
                            platform_user_id: binding.platform_user_id,
                            claim_status: verifyResult.passed && !task.need_audit ? 'VERIFIED' : task.need_audit ? 'PENDING' : 'REJECTED',
                            reward_status: verifyResult.passed && !task.need_audit ? 'REWARDING' : 'PENDING',
                            verify_result: JSON.stringify(verifyResult),
                            verify_detail: JSON.stringify({ proofData: proofData ?? null, ruleConfig }),
                            proof_data: proofData ? JSON.stringify(proofData) : null,
                            claim_request_no: makeRequestNo(),
                            claim_no: 1,
                            idempotency_key: makeRequestNo(),
                            claim_at: now,
                            verified_at: verifyResult.passed && !task.need_audit ? now : null,
                            rewarding_at: verifyResult.passed && !task.need_audit ? now : null,
                            failed_reason: verifyResult.passed ? null : verifyResult.reason,
                        },
                    });
                    await tx.promoVerifyLog.create({
                        data: {
                            claim_id: createdClaim.id,
                            task_id: task.id,
                            user_id: userId,
                            platform_user_id: binding.platform_user_id,
                            verify_status: verifyResult.passed ? 'PASSED' : 'FAILED',
                            request_data: JSON.stringify({ proofData: proofData ?? null }),
                            response_data: JSON.stringify(verifyResult),
                            error_message: verifyResult.passed ? null : verifyResult.reason,
                            source: task.auto_verify ? 'AUTO' : 'MANUAL',
                        },
                    });
                    if (!verifyResult.passed || task.need_audit)
                        return { claim: createdClaim, created: true };
                    const wallet = await tx.wallet.upsert({
                        where: { user_id: userId },
                        update: {},
                        create: { user_id: userId, balance: 0, currency: 'CNY', is_active: true },
                    });
                    const afterBalance = wallet.balance + task.reward_amount;
                    await tx.wallet.update({
                        where: { user_id: userId },
                        data: { balance: { increment: task.reward_amount } },
                    });
                    await tx.promoWalletTransaction.create({
                        data: {
                            user_id: userId,
                            change_amount: task.reward_amount,
                            direction: 'INCOME',
                            change_type: 'PROMO_REWARD',
                            ref_type: 'promo_claim_record',
                            ref_id: createdClaim.id,
                            before_balance: wallet.balance,
                            after_balance: afterBalance,
                            remark: `Promo reward for task ${task.id}`,
                            created_by: userId,
                        },
                    });
                    const rewardedClaim = await tx.promoClaimRecord.update({
                        where: { id: createdClaim.id },
                        data: { claim_status: 'REWARDED', reward_status: 'REWARDED', rewarded_at: now },
                    });
                    return { claim: rewardedClaim, created: true };
                }, { isolationLevel: 'Serializable' });
                break;
            }
            catch (error) {
                if (!isRetryableClaimError(error) || attempt === 2)
                    throw error;
            }
        }
        if (!outcome)
            throw new AppError('Claim could not be created', 409, ErrorCode.CONFLICT);
        if (!outcome.created)
            return sendSuccess(res, outcome.claim, 'Task already claimed');
        return sendCreatedResponse(res, outcome.claim, { resource: 'PromoClaimRecord' });
    }
    catch (error) {
        next(error);
    }
};
export const getMyPromoClaims = async (req, res, next) => { try {
    if (!req.user)
        throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    const userId = req.user.id;
    const claims = await prisma.promoClaimRecord.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, include: { task: true } });
    return sendSuccess(res, claims, 'Promo claims loaded');
}
catch (error) {
    next(error);
} };
export const approvePromoClaim = async (req, res, next) => {
    try {
        if (!isAdmin(req))
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        const claimId = Number(req.params.id);
        if (!Number.isInteger(claimId))
            throw new AppError('Invalid claim ID', 400, ErrorCode.VALIDATION_ERROR);
        const claim = await prisma.promoClaimRecord.findUnique({
            where: { id: claimId },
            include: { task: true },
        });
        if (!claim)
            throw new AppError('Claim not found', 404, ErrorCode.NOT_FOUND);
        const updated = await prisma.$transaction(async (tx) => {
            const rewardGuard = await tx.promoClaimRecord.updateMany({
                where: {
                    id: claim.id,
                    claim_status: { in: ['PENDING', 'VERIFIED'] },
                    reward_status: 'PENDING',
                },
                data: {
                    reward_status: 'REWARDING',
                    rewarding_at: new Date(),
                },
            });
            if (rewardGuard.count === 0) {
                const current = await tx.promoClaimRecord.findUniqueOrThrow({ where: { id: claim.id } });
                if (current.reward_status === 'REWARDED')
                    return current;
                throw new AppError('Claim is not approvable', 409, ErrorCode.CONFLICT);
            }
            const wallet = await tx.wallet.upsert({
                where: { user_id: claim.user_id },
                update: {},
                create: { user_id: claim.user_id, balance: 0, currency: 'CNY', is_active: true },
            });
            const beforeBalance = wallet.balance;
            const afterBalance = beforeBalance + claim.task.reward_amount;
            await tx.wallet.update({
                where: { user_id: claim.user_id },
                data: { balance: { increment: claim.task.reward_amount } },
            });
            await tx.promoWalletTransaction.create({
                data: {
                    user_id: claim.user_id,
                    change_amount: claim.task.reward_amount,
                    direction: 'INCOME',
                    change_type: 'PROMO_REWARD',
                    ref_type: 'promo_claim_record',
                    ref_id: claim.id,
                    before_balance: beforeBalance,
                    after_balance: afterBalance,
                    remark: `Manual approve for task ${claim.task_id}`,
                    created_by: req.user?.id ?? null,
                },
            });
            return tx.promoClaimRecord.update({
                where: { id: claim.id },
                data: {
                    claim_status: 'REWARDED',
                    reward_status: 'REWARDED',
                    verified_at: claim.verified_at ?? new Date(),
                    rewarded_at: new Date(),
                    audit_by: req.user?.id ?? null,
                    audit_note: req.body?.remark || 'Approved',
                    failed_reason: null,
                },
            });
        });
        return sendSuccess(res, updated, 'Claim approved and rewarded');
    }
    catch (error) {
        next(error);
    }
};
export const rejectPromoClaim = async (req, res, next) => {
    try {
        if (!isAdmin(req))
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        const claimId = Number(req.params.id);
        if (!Number.isInteger(claimId)) {
            throw new AppError('Invalid claim ID', 400, ErrorCode.VALIDATION_ERROR);
        }
        const rejectionNote = String(req.body?.remark ?? '').trim();
        if (!rejectionNote) {
            throw new AppError('Rejection note is required', 400, ErrorCode.VALIDATION_ERROR);
        }
        const rejected = await prisma.promoClaimRecord.updateMany({
            where: {
                id: claimId,
                claim_status: { not: 'REWARDED' },
                reward_status: { notIn: ['REWARDING', 'REWARDED'] },
            },
            data: {
                claim_status: 'REJECTED',
                reward_status: 'REJECTED',
                audit_by: req.user?.id ?? null,
                audit_note: rejectionNote,
                failed_reason: rejectionNote,
            },
        });
        if (rejected.count === 0) {
            const existing = await prisma.promoClaimRecord.findUnique({ where: { id: claimId } });
            if (!existing)
                throw new AppError('Claim not found', 404, ErrorCode.NOT_FOUND);
            throw new AppError('Rewarded claim cannot be rejected', 409, ErrorCode.CONFLICT);
        }
        const claim = await prisma.promoClaimRecord.findUniqueOrThrow({ where: { id: claimId } });
        return sendSuccess(res, claim, 'Claim rejected');
    }
    catch (error) {
        next(error);
    }
};
export const getPromoAuditSummary = async (_req, res, next) => { try {
    const [tasks, claims, bindings] = await Promise.all([prisma.promoTask.count(), prisma.promoClaimRecord.count(), prisma.promoPlatformBinding.count()]);
    const rewarded = await prisma.promoClaimRecord.count({ where: { reward_status: 'REWARDED' } });
    const pending = await prisma.promoClaimRecord.count({ where: { claim_status: 'PENDING' } });
    const rejected = await prisma.promoClaimRecord.count({ where: { claim_status: 'REJECTED' } });
    return sendSuccess(res, { tasks, claims, bindings, rewarded, pending, rejected }, 'Promo summary loaded');
}
catch (error) {
    next(error);
} };
//# sourceMappingURL=promoController.js.map
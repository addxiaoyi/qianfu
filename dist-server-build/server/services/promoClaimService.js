import crypto from 'node:crypto';
import { parsePromoRewardPolicy } from './promoRewardPolicyService';
import { parsePromoVideoUrl } from './promoVideoUrlService';
import { AppError, ErrorCode } from '../utils/errors';
const MAX_TRANSACTION_ATTEMPTS = 3;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const makeRequestNo = () => (`claim_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`);
const startOfShanghaiDay = (now) => {
    const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - SHANGHAI_OFFSET_MS);
};
const isRetryable = (error) => {
    if (typeof error !== 'object' || error === null || !('code' in error))
        return false;
    return error.code === 'P2002' || error.code === 'P2034';
};
const assertCapacity = (counts) => {
    if (counts.perUser >= Math.max(1, counts.perUserLimit)) {
        throw new AppError('Per-user claim limit reached', 409, ErrorCode.CONFLICT);
    }
    if (counts.dailyLimit !== null && counts.daily >= counts.dailyLimit) {
        throw new AppError('Daily claim limit reached', 409, ErrorCode.CONFLICT);
    }
    if (counts.totalLimit !== null && counts.total >= counts.totalLimit) {
        throw new AppError('Total claim limit reached', 409, ErrorCode.CONFLICT);
    }
};
const createInTransaction = async (tx, input, now) => {
    const task = await tx.promoTask.findUnique({ where: { id: input.taskId } });
    if (!task)
        throw new AppError('Task not found', 404, ErrorCode.NOT_FOUND);
    if (task.status !== 'ENABLED') {
        throw new AppError('Task is not enabled', 409, ErrorCode.CONFLICT);
    }
    if (task.start_at && task.start_at > now) {
        throw new AppError('Task has not started yet', 409, ErrorCode.CONFLICT);
    }
    if (task.end_at && task.end_at < now) {
        throw new AppError('Task has expired', 409, ErrorCode.CONFLICT);
    }
    const existing = await tx.promoClaimRecord.findUnique({
        where: {
            user_id_task_id_idempotency_key: {
                user_id: input.userId,
                task_id: task.id,
                idempotency_key: input.idempotencyKey,
            },
        },
    });
    if (existing)
        return { claim: existing, created: false };
    const binding = await tx.promoPlatformBinding.findFirst({
        where: {
            user_id: input.userId,
            platform: task.platform.trim().toLowerCase(),
            binding_status: 'VERIFIED',
            verified_at: { not: null },
        },
    });
    if (!binding) {
        throw new AppError('Platform account not bound', 409, ErrorCode.CONFLICT);
    }
    const rewardPolicy = parsePromoRewardPolicy(task.rule_config, task.reward_amount);
    const submittedVideoUrl = String(input.proof.videoUrl ?? input.proof.url ?? '').trim();
    if (rewardPolicy.mode === 'POPULAR_VIDEO_TIERED' && !submittedVideoUrl) {
        throw new AppError('A public platform video URL is required', 400, ErrorCode.VALIDATION_ERROR);
    }
    const videoReference = rewardPolicy.mode === 'POPULAR_VIDEO_TIERED'
        ? parsePromoVideoUrl(task.platform, submittedVideoUrl)
        : null;
    if (videoReference) {
        const existingVideoClaim = await tx.promoClaimRecord.findFirst({
            where: { task_id: task.id, platform_video_id: videoReference.videoId },
            select: { id: true },
        });
        if (existingVideoClaim) {
            throw new AppError('This video has already been submitted for the task', 409, ErrorCode.CONFLICT);
        }
    }
    const dayStart = startOfShanghaiDay(now);
    const [perUser, daily, total] = await Promise.all([
        tx.promoClaimRecord.count({ where: { user_id: input.userId, task_id: task.id } }),
        tx.promoClaimRecord.count({ where: { task_id: task.id, claim_at: { gte: dayStart } } }),
        tx.promoClaimRecord.count({ where: { task_id: task.id } }),
    ]);
    assertCapacity({
        perUser,
        daily,
        total,
        perUserLimit: task.claim_limit_per_user,
        dailyLimit: task.daily_limit,
        totalLimit: task.total_limit,
    });
    const claim = await tx.promoClaimRecord.create({
        data: {
            task_id: task.id,
            user_id: input.userId,
            platform_user_id: binding.platform_user_id,
            video_url: videoReference?.normalizedUrl ?? null,
            platform_video_id: videoReference?.videoId ?? null,
            platform_author_id: videoReference ? binding.platform_user_id : null,
            claim_status: 'PENDING',
            reward_status: 'PENDING',
            settlement_status: videoReference ? 'AWAITING_REVIEW' : 'PENDING',
            proof_data: JSON.stringify(input.proof),
            claim_request_no: makeRequestNo(),
            claim_no: perUser + 1,
            idempotency_key: input.idempotencyKey,
            claim_at: now,
        },
    });
    await tx.promoVerifyLog.create({
        data: {
            claim_id: claim.id,
            task_id: task.id,
            user_id: input.userId,
            platform_user_id: binding.platform_user_id,
            verify_status: 'PENDING',
            source: 'MANUAL',
        },
    });
    return { claim, created: true };
};
export const createPendingPromoClaim = async (db, input) => {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
            const now = new Date();
            return await db.$transaction((tx) => createInTransaction(tx, input, now), { isolationLevel: 'Serializable' });
        }
        catch (error) {
            const code = typeof error === 'object' && error !== null && 'code' in error
                ? String(error.code)
                : '';
            if (code === 'P2002') {
                throw new AppError('This video or idempotency key has already been used', 409, ErrorCode.CONFLICT);
            }
            if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS)
                throw error;
        }
    }
    throw new AppError('Claim could not be created', 409, ErrorCode.CONFLICT);
};
//# sourceMappingURL=promoClaimService.js.map
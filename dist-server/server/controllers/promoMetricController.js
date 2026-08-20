import prisma from '../db.js';
import { isAdministrator } from '../middleware/auth.js';
import { promoMetricSnapshotSchema } from '../schemas/promoSchemas.js';
import { recordPromoMetricsAndSettle } from '../services/promoMetricSettlementService.js';
import { evaluatePromoRewardTier, parsePromoRewardPolicy } from '../services/promoRewardPolicyService.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { getRouteParam } from '../utils/requestParams.js';
const parseClaimId = (value) => {
    const claimId = Number(value);
    if (!Number.isInteger(claimId) || claimId <= 0) {
        throw new AppError('Invalid claim ID', 400, ErrorCode.VALIDATION_ERROR);
    }
    return claimId;
};
export const recordPromoClaimMetrics = async (req, res, next) => {
    try {
        if (!req.user || !isAdministrator(req)) {
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        }
        const parsed = promoMetricSnapshotSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError('Invalid promotion metric snapshot', 400, ErrorCode.VALIDATION_ERROR);
        }
        const result = await recordPromoMetricsAndSettle(prisma, parseClaimId(getRouteParam(req.params.id)), parsed.data, req.user.id);
        return sendSuccess(res, result, result.paidAmount > 0 ? 'Metrics saved and reward difference paid' : 'Metrics saved');
    }
    catch (error) {
        next(error);
    }
};
export const getPromoClaimProgress = async (req, res, next) => {
    try {
        if (!req.user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const claim = await prisma.promoClaimRecord.findUnique({
            where: { id: parseClaimId(getRouteParam(req.params.id)) },
            include: {
                task: true,
                metric_snapshots: { orderBy: [{ captured_at: 'desc' }, { id: 'desc' }], take: 20 },
                reward_settlements: { orderBy: { created_at: 'desc' } },
            },
        });
        if (!claim)
            throw new AppError('Claim not found', 404, ErrorCode.NOT_FOUND);
        if (claim.user_id !== req.user.id && !isAdministrator(req)) {
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        }
        const policy = parsePromoRewardPolicy(claim.task.rule_config, claim.task.reward_amount);
        const latestMetrics = claim.metric_snapshots[0] ?? null;
        const evaluation = policy.mode === 'POPULAR_VIDEO_TIERED' && latestMetrics
            ? evaluatePromoRewardTier(policy, latestMetrics)
            : null;
        return sendSuccess(res, { claim, policy, latestMetrics, evaluation }, 'Promotion progress loaded');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=promoMetricController.js.map
import type { Prisma, PrismaClient } from '../../prisma/generated/client/index.js';

import type { PromoMetricSnapshotPayload } from '../schemas/promoSchemas';
import { AppError, ErrorCode } from '../utils/errors';
import {
  evaluatePromoRewardTier,
  normalizePromoMetrics,
  parsePromoRewardPolicy,
  type PromoMetrics,
} from './promoRewardPolicyService';

const MAX_ATTEMPTS = 3;

class SettlementRaceError extends Error {}

const maxMetrics = (input: PromoMetrics, previous?: Partial<PromoMetrics> | null): PromoMetrics => (
  normalizePromoMetrics({
    views: Math.max(input.views, previous?.views ?? 0),
    likes: Math.max(input.likes, previous?.likes ?? 0),
    comments: Math.max(input.comments, previous?.comments ?? 0),
    shares: Math.max(input.shares, previous?.shares ?? 0),
    favorites: Math.max(input.favorites, previous?.favorites ?? 0),
    coins: Math.max(input.coins, previous?.coins ?? 0),
  })
);

const settleInTransaction = async (
  tx: Prisma.TransactionClient,
  claimId: number,
  payload: PromoMetricSnapshotPayload,
  actorId: number,
) => {
  const claim = await tx.promoClaimRecord.findUnique({
    where: { id: claimId },
    include: { task: true },
  });
  if (!claim) throw new AppError('Claim not found', 404, ErrorCode.NOT_FOUND);
  if (!['VERIFIED', 'REWARDED'].includes(claim.claim_status)) {
    throw new AppError('The video must pass content review before metrics are settled', 409, ErrorCode.CONFLICT);
  }

  const policy = parsePromoRewardPolicy(claim.task.rule_config, claim.task.reward_amount);
  if (policy.mode !== 'POPULAR_VIDEO_TIERED') {
    throw new AppError('This task does not use tiered video settlement', 409, ErrorCode.CONFLICT);
  }

  const latest = await tx.promoMetricSnapshot.findFirst({
    where: { claim_id: claim.id },
    orderBy: [{ captured_at: 'desc' }, { id: 'desc' }],
  });
  const metrics = maxMetrics(normalizePromoMetrics(payload), latest);
  const capturedAt = new Date();
  const snapshot = await tx.promoMetricSnapshot.create({
    data: {
      claim_id: claim.id,
      ...metrics,
      source: payload.source,
      source_ref: payload.sourceRef ?? null,
      raw_summary: payload.rawSummary ?? null,
      captured_at: capturedAt,
      created_by: actorId,
    },
  });
  const evaluation = evaluatePromoRewardTier(policy, metrics);
  const tier = evaluation.qualifiedTier;

  if (!tier) {
    const updatedClaim = await tx.promoClaimRecord.update({
      where: { id: claim.id },
      data: { last_metric_at: capturedAt, settlement_status: 'MONITORING' },
    });
    return { claim: updatedClaim, snapshot, settlement: null, evaluation, paidAmount: 0 };
  }

  const existingSettlement = await tx.promoRewardSettlement.findUnique({
    where: { claim_id_tier_key: { claim_id: claim.id, tier_key: tier.key } },
  });
  if (existingSettlement) {
    const updatedClaim = await tx.promoClaimRecord.update({
      where: { id: claim.id },
      data: {
        last_metric_at: capturedAt,
        settlement_status: evaluation.isHighestTier ? 'COMPLETED' : 'MONITORING',
      },
    });
    return { claim: updatedClaim, snapshot, settlement: existingSettlement, evaluation, paidAmount: 0 };
  }

  const previousTotal = claim.total_rewarded_amount;
  const targetAmount = tier.rewardAmount;
  const paidAmount = Math.max(0, targetAmount - previousTotal);
  if (paidAmount === 0) {
    const updatedClaim = await tx.promoClaimRecord.update({
      where: { id: claim.id },
      data: { last_metric_at: capturedAt },
    });
    return { claim: updatedClaim, snapshot, settlement: null, evaluation, paidAmount: 0 };
  }

  const settlement = await tx.promoRewardSettlement.create({
    data: {
      claim_id: claim.id,
      metrics_snapshot_id: snapshot.id,
      tier_key: tier.key,
      tier_name: tier.name,
      target_amount: targetAmount,
      paid_amount: paidAmount,
      idempotency_key: `promo-claim:${claim.id}:tier:${tier.key}`,
      calculation_snapshot: JSON.stringify({
        taskId: claim.task_id,
        ruleVersion: claim.task.rule_version,
        metrics,
        tier,
        previousTotal,
        targetAmount,
        paidAmount,
      }),
      status: 'COMPLETED',
      created_by: actorId,
    },
  });

  const claimGuard = await tx.promoClaimRecord.updateMany({
    where: { id: claim.id, total_rewarded_amount: previousTotal },
    data: {
      claim_status: 'REWARDED',
      reward_status: 'REWARDED',
      settlement_status: evaluation.isHighestTier ? 'COMPLETED' : 'MONITORING',
      highest_rewarded_tier: tier.key,
      total_rewarded_amount: targetAmount,
      last_metric_at: capturedAt,
      rewarded_at: capturedAt,
      failed_reason: null,
    },
  });
  if (claimGuard.count !== 1) throw new SettlementRaceError('Concurrent settlement detected');

  const wallet = await tx.wallet.upsert({
    where: { user_id: claim.user_id },
    update: {},
    create: { user_id: claim.user_id, balance: 0, currency: 'CNY', is_active: true },
  });
  const afterBalance = wallet.balance + paidAmount;
  await tx.wallet.update({
    where: { user_id: claim.user_id },
    data: { balance: { increment: paidAmount } },
  });
  await tx.promoWalletTransaction.create({
    data: {
      user_id: claim.user_id,
      change_amount: paidAmount,
      direction: 'INCOME',
      change_type: 'PROMO_TIER_REWARD',
      ref_type: 'promo_reward_settlement',
      ref_id: settlement.id,
      before_balance: wallet.balance,
      after_balance: afterBalance,
      remark: `Promotion video reached tier ${tier.name}`,
      created_by: actorId,
    },
  });
  const updatedClaim = await tx.promoClaimRecord.findUniqueOrThrow({ where: { id: claim.id } });
  return { claim: updatedClaim, snapshot, settlement, evaluation, paidAmount };
};

export const recordPromoMetricsAndSettle = async (
  db: PrismaClient,
  claimId: number,
  payload: PromoMetricSnapshotPayload,
  actorId: number,
) => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(
        (tx) => settleInTransaction(tx, claimId, payload, actorId),
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
      const retryable = error instanceof SettlementRaceError || code === 'P2002' || code === 'P2034';
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
    }
  }
  throw new AppError('Metrics could not be settled', 409, ErrorCode.CONFLICT);
};

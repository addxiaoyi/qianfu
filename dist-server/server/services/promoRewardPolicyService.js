import { z } from 'zod';
export const PROMO_METRIC_KEYS = [
    'views',
    'likes',
    'comments',
    'shares',
    'favorites',
    'coins',
];
const thresholdFields = {
    minViews: z.number().int().nonnegative().optional(),
    minLikes: z.number().int().nonnegative().optional(),
    minComments: z.number().int().nonnegative().optional(),
    minShares: z.number().int().nonnegative().optional(),
    minFavorites: z.number().int().nonnegative().optional(),
    minCoins: z.number().int().nonnegative().optional(),
};
const rewardTierSchema = z.object({
    key: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i),
    name: z.string().trim().min(1).max(64),
    rewardAmount: z.number().int().positive(),
    ...thresholdFields,
}).strict().superRefine((tier, ctx) => {
    const hasThreshold = Object.entries(tier).some(([key, value]) => (key.startsWith('min') && typeof value === 'number' && value > 0));
    if (!hasThreshold) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each reward tier needs at least one positive metric threshold' });
    }
});
const tieredPolicySchema = z.object({
    mode: z.literal('POPULAR_VIDEO_TIERED'),
    observationHours: z.number().int().min(1).max(24 * 90).default(168),
    settlementMode: z.literal('HIGHEST_TIER_DIFF').default('HIGHEST_TIER_DIFF'),
    contentRequirements: z.object({
        keywords: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
        hashtags: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
        disclosureRequired: z.boolean().default(true),
    }).strict().default({ keywords: [], hashtags: [], disclosureRequired: true }),
    tiers: z.array(rewardTierSchema).min(1).max(20),
}).strict().superRefine((policy, ctx) => {
    const keys = new Set();
    let previousReward = 0;
    policy.tiers.forEach((tier, index) => {
        if (keys.has(tier.key)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', index, 'key'], message: 'Tier key must be unique' });
        }
        keys.add(tier.key);
        if (tier.rewardAmount <= previousReward) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', index, 'rewardAmount'], message: 'Tier rewards must increase strictly' });
        }
        previousReward = tier.rewardAmount;
    });
});
const parseJsonObject = (value) => {
    if (value === undefined || value === null)
        return {};
    if (typeof value === 'string') {
        if (value.trim() === '')
            return {};
        let parsed;
        try {
            parsed = JSON.parse(value);
        }
        catch (error) {
            throw new Error('Promotion rule config must be valid JSON', { cause: error });
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('Promotion rule config must be an object');
        return parsed;
    }
    if (typeof value !== 'object' || Array.isArray(value))
        throw new Error('Promotion rule config must be an object');
    return value;
};
export const parsePromoRewardPolicy = (ruleConfig, fallbackRewardAmount) => {
    const parsed = parseJsonObject(ruleConfig);
    if (parsed.mode !== 'POPULAR_VIDEO_TIERED') {
        return { mode: 'LEGACY_FIXED', rewardAmount: Math.max(0, Math.trunc(fallbackRewardAmount)) };
    }
    return tieredPolicySchema.parse(parsed);
};
const thresholdMap = {
    views: 'minViews',
    likes: 'minLikes',
    comments: 'minComments',
    shares: 'minShares',
    favorites: 'minFavorites',
    coins: 'minCoins',
};
export const normalizePromoMetrics = (input) => ({
    views: Math.max(0, Math.trunc(input.views ?? 0)),
    likes: Math.max(0, Math.trunc(input.likes ?? 0)),
    comments: Math.max(0, Math.trunc(input.comments ?? 0)),
    shares: Math.max(0, Math.trunc(input.shares ?? 0)),
    favorites: Math.max(0, Math.trunc(input.favorites ?? 0)),
    coins: Math.max(0, Math.trunc(input.coins ?? 0)),
});
export const tierMatchesMetrics = (tier, metrics) => (PROMO_METRIC_KEYS.every((metric) => {
    const threshold = tier[thresholdMap[metric]];
    return typeof threshold !== 'number' || metrics[metric] >= threshold;
}));
export const evaluatePromoRewardTier = (policy, metricInput) => {
    const metrics = normalizePromoMetrics(metricInput);
    let qualifiedTier = null;
    let qualifiedIndex = -1;
    for (let index = 0; index < policy.tiers.length; index += 1) {
        const tier = policy.tiers[index];
        if (tierMatchesMetrics(tier, metrics)) {
            qualifiedTier = tier;
            qualifiedIndex = index;
        }
    }
    return {
        metrics,
        qualifiedTier,
        qualifiedIndex,
        isHighestTier: qualifiedIndex === policy.tiers.length - 1 && qualifiedIndex >= 0,
        nextTier: qualifiedIndex + 1 < policy.tiers.length ? policy.tiers[qualifiedIndex + 1] : null,
    };
};
export const getPromoMaxRewardAmount = (policy) => (policy.mode === 'LEGACY_FIXED'
    ? policy.rewardAmount
    : policy.tiers[policy.tiers.length - 1].rewardAmount);
//# sourceMappingURL=promoRewardPolicyService.js.map
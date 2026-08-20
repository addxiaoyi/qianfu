import { z } from 'zod';
export declare const PROMO_METRIC_KEYS: readonly ["views", "likes", "comments", "shares", "favorites", "coins"];
export type PromoMetricKey = (typeof PROMO_METRIC_KEYS)[number];
export type PromoMetrics = Record<PromoMetricKey, number>;
declare const rewardTierSchema: z.ZodObject<{
    minViews: z.ZodOptional<z.ZodNumber>;
    minLikes: z.ZodOptional<z.ZodNumber>;
    minComments: z.ZodOptional<z.ZodNumber>;
    minShares: z.ZodOptional<z.ZodNumber>;
    minFavorites: z.ZodOptional<z.ZodNumber>;
    minCoins: z.ZodOptional<z.ZodNumber>;
    key: z.ZodString;
    name: z.ZodString;
    rewardAmount: z.ZodNumber;
}, z.core.$strict>;
declare const tieredPolicySchema: z.ZodObject<{
    mode: z.ZodLiteral<"POPULAR_VIDEO_TIERED">;
    observationHours: z.ZodDefault<z.ZodNumber>;
    settlementMode: z.ZodDefault<z.ZodLiteral<"HIGHEST_TIER_DIFF">>;
    contentRequirements: z.ZodDefault<z.ZodObject<{
        keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
        hashtags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        disclosureRequired: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>>;
    tiers: z.ZodArray<z.ZodObject<{
        minViews: z.ZodOptional<z.ZodNumber>;
        minLikes: z.ZodOptional<z.ZodNumber>;
        minComments: z.ZodOptional<z.ZodNumber>;
        minShares: z.ZodOptional<z.ZodNumber>;
        minFavorites: z.ZodOptional<z.ZodNumber>;
        minCoins: z.ZodOptional<z.ZodNumber>;
        key: z.ZodString;
        name: z.ZodString;
        rewardAmount: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PromoRewardTier = z.infer<typeof rewardTierSchema>;
export type TieredPromoRewardPolicy = z.infer<typeof tieredPolicySchema>;
export type PromoRewardPolicy = {
    mode: 'LEGACY_FIXED';
    rewardAmount: number;
} | TieredPromoRewardPolicy;
export declare const parsePromoRewardPolicy: (ruleConfig: unknown, fallbackRewardAmount: number) => PromoRewardPolicy;
export declare const normalizePromoMetrics: (input: Partial<PromoMetrics>) => PromoMetrics;
export declare const tierMatchesMetrics: (tier: PromoRewardTier, metrics: PromoMetrics) => boolean;
export declare const evaluatePromoRewardTier: (policy: TieredPromoRewardPolicy, metricInput: Partial<PromoMetrics>) => {
    metrics: PromoMetrics;
    qualifiedTier: {
        key: string;
        name: string;
        rewardAmount: number;
        minViews?: number | undefined;
        minLikes?: number | undefined;
        minComments?: number | undefined;
        minShares?: number | undefined;
        minFavorites?: number | undefined;
        minCoins?: number | undefined;
    } | null;
    qualifiedIndex: number;
    isHighestTier: boolean;
    nextTier: {
        key: string;
        name: string;
        rewardAmount: number;
        minViews?: number | undefined;
        minLikes?: number | undefined;
        minComments?: number | undefined;
        minShares?: number | undefined;
        minFavorites?: number | undefined;
        minCoins?: number | undefined;
    } | null;
};
export declare const getPromoMaxRewardAmount: (policy: PromoRewardPolicy) => number;
export {};
//# sourceMappingURL=promoRewardPolicyService.d.ts.map
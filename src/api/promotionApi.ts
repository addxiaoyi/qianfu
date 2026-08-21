import { safeJsonParse } from '@/utils/json';
import { api } from './request';

export const PROMO_METRIC_KEYS = [
  'views',
  'likes',
  'comments',
  'shares',
  'favorites',
  'coins',
] as const;

export type PromoMetricKey = (typeof PROMO_METRIC_KEYS)[number];
export type PromoMetrics = Record<PromoMetricKey, number>;

export interface PromoRewardTier {
  key: string;
  name: string;
  rewardAmount: number;
  minViews?: number;
  minLikes?: number;
  minComments?: number;
  minShares?: number;
  minFavorites?: number;
  minCoins?: number;
}

export interface TieredPromoRewardPolicy {
  mode: 'POPULAR_VIDEO_TIERED';
  observationHours: number;
  settlementMode: 'HIGHEST_TIER_DIFF';
  contentRequirements: {
    keywords: string[];
    hashtags: string[];
    disclosureRequired: boolean;
  };
  tiers: PromoRewardTier[];
}

export type PromoRewardPolicy =
  | { mode: 'LEGACY_FIXED'; rewardAmount: number }
  | TieredPromoRewardPolicy;

export interface PromoBinding {
  id: number;
  platform: string;
  platform_user_id: string;
  platform_username: string | null;
  binding_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
  bind_source: string;
  verified_at: string | null;
  last_verify_at: string | null;
  verification_code: string;
  verification_method: 'PUBLIC_PROFILE_CODE';
}

export interface PromoMetricSnapshot extends PromoMetrics {
  id: number;
  claim_id: number;
  source: string;
  source_ref: string | null;
  raw_summary: string | null;
  captured_at: string;
  created_at: string;
}

export interface PromoRewardSettlement {
  id: number;
  claim_id: number;
  tier_key: string;
  tier_name: string;
  target_amount: number;
  paid_amount: number;
  status: string;
  created_at: string;
}

export interface PromoClaim {
  id: number;
  task_id: number;
  claim_no: number;
  claim_status: string;
  reward_status: string;
  settlement_status: string;
  video_url: string | null;
  platform_video_id: string | null;
  highest_rewarded_tier: string | null;
  total_rewarded_amount: number;
  last_metric_at: string | null;
  audit_note: string | null;
  failed_reason: string | null;
  claim_at: string;
  rewarded_at: string | null;
  metric_snapshots?: PromoMetricSnapshot[];
  reward_settlements?: PromoRewardSettlement[];
  task?: PromoTask;
}

export interface PromoTask {
  id: number;
  title: string;
  description: string | null;
  platform: string;
  target_url: string;
  reward_amount: number;
  rule_config: string | Record<string, unknown>;
  claim_limit_per_user: number;
  total_limit: number | null;
  daily_limit: number | null;
  end_at: string | null;
  claimed: boolean;
  claim_status: string | null;
  reward_status: string | null;
  bound: boolean;
}

export interface PromoTaskPage {
  data: PromoTask[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface PromoTierEvaluation {
  metrics: PromoMetrics;
  qualifiedTier: PromoRewardTier | null;
  qualifiedIndex: number;
  isHighestTier: boolean;
  nextTier: PromoRewardTier | null;
}

export interface PromoClaimProgress {
  claim: PromoClaim & {
    task: PromoTask;
    metric_snapshots: PromoMetricSnapshot[];
    reward_settlements: PromoRewardSettlement[];
  };
  policy: PromoRewardPolicy;
  latestMetrics: PromoMetricSnapshot | null;
  evaluation: PromoTierEvaluation | null;
}

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === 'string') {
    try {
      const parsed = safeJsonParse(value, {}) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};

const asNonNegativeInteger = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.trunc(numeric) : fallback;
};

export const parsePromoRewardPolicy = (
  ruleConfig: unknown,
  fallbackRewardAmount = 0,
): PromoRewardPolicy => {
  const object = asObject(ruleConfig);
  if (object?.mode !== 'POPULAR_VIDEO_TIERED' || !Array.isArray(object.tiers)) {
    return { mode: 'LEGACY_FIXED', rewardAmount: asNonNegativeInteger(fallbackRewardAmount) };
  }
  const tiers = object.tiers.flatMap((entry): PromoRewardTier[] => {
    const tier = asObject(entry);
    if (!tier || typeof tier.key !== 'string' || typeof tier.name !== 'string') return [];
    const rewardAmount = asNonNegativeInteger(tier.rewardAmount);
    if (rewardAmount <= 0) return [];
    const parsedTier: PromoRewardTier = {
      key: tier.key,
      name: tier.name,
      rewardAmount,
    };
    const thresholdPairs: Array<[keyof PromoRewardTier, unknown]> = [
      ['minViews', tier.minViews],
      ['minLikes', tier.minLikes],
      ['minComments', tier.minComments],
      ['minShares', tier.minShares],
      ['minFavorites', tier.minFavorites],
      ['minCoins', tier.minCoins],
    ];
    thresholdPairs.forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        Object.assign(parsedTier, { [key]: asNonNegativeInteger(value) });
      }
    });
    return [parsedTier];
  });
  if (tiers.length === 0) {
    return { mode: 'LEGACY_FIXED', rewardAmount: asNonNegativeInteger(fallbackRewardAmount) };
  }
  const requirements = asObject(object.contentRequirements);
  return {
    mode: 'POPULAR_VIDEO_TIERED',
    observationHours: Math.max(1, asNonNegativeInteger(object.observationHours, 168)),
    settlementMode: 'HIGHEST_TIER_DIFF',
    contentRequirements: {
      keywords: Array.isArray(requirements?.keywords)
        ? requirements.keywords.filter((value): value is string => typeof value === 'string')
        : [],
      hashtags: Array.isArray(requirements?.hashtags)
        ? requirements.hashtags.filter((value): value is string => typeof value === 'string')
        : [],
      disclosureRequired: requirements?.disclosureRequired !== false,
    },
    tiers,
  };
};

export const promotionApi = {
  listTasks: () => api.get<PromoTaskPage>('/promo/tasks'),
  listBindings: () => api.get<PromoBinding[]>('/promo/bindings/me'),
  listClaims: () => api.get<PromoClaim[]>('/promo/claims/me'),
  getClaimProgress: (claimId: number) => (
    api.get<PromoClaimProgress>(`/promo/claims/${claimId}/progress`)
  ),
  bind: (input: { platform: string; platformUserId: string; platformUsername?: string }) => (
    api.post<PromoBinding>('/promo/bindings', input)
  ),
  verifyBinding: (bindingId: number, proofUrl: string) => (
    api.post<PromoBinding>(`/promo/bindings/${bindingId}/verify`, { proofUrl })
  ),
  claim: (
    input: { taskId: number; proofData: { url?: string; videoUrl?: string; note?: string } },
    key: string,
  ) => api.post<PromoClaim>('/promo/claims', input, { headers: { 'Idempotency-Key': key } }),
  recordMetrics: (claimId: number, metrics: Partial<PromoMetrics> & {
    source?: 'MANUAL' | 'IMPORT';
    sourceRef?: string;
    rawSummary?: string;
  }) => api.post(`/promo/claims/${claimId}/metrics`, metrics),
};

import { z } from 'zod';

export const SUPPORTED_PROMO_PLATFORMS = [
  'bilibili',
  'douyin',
  'kuaishou',
  'xiaohongshu',
  'weibo',
] as const;

const plainText = z.string().trim().min(1).max(128).refine(
  (value) => !/[<>]/.test(value),
  'HTML is not allowed',
);

const optionalPlainText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  plainText.optional(),
);

const platformUserIdPatterns: Record<(typeof SUPPORTED_PROMO_PLATFORMS)[number], RegExp> = {
  bilibili: /^\d{1,20}$/,
  douyin: /^[A-Za-z0-9._:-]{2,128}$/,
  kuaishou: /^[A-Za-z0-9._:-]{2,128}$/,
  xiaohongshu: /^[A-Za-z0-9._:-]{2,128}$/,
  weibo: /^\d{1,20}$/,
};

export const promoBindingSchema = z.object({
  platform: z.string().trim().toLowerCase().pipe(z.enum(SUPPORTED_PROMO_PLATFORMS)),
  platformUserId: plainText,
  platformUsername: optionalPlainText,
}).strict().superRefine((binding, ctx) => {
  if (!platformUserIdPatterns[binding.platform].test(binding.platformUserId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['platformUserId'],
      message: 'Invalid platform user ID',
    });
  }
});

export const promoBindingVerificationSchema = z.object({
  proofUrl: z.string().trim().url().max(2_048).refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Proof URL must use HTTPS'),
}).strict();

export type PromoBindingPayload = z.infer<typeof promoBindingSchema>;
export type PromoBindingVerificationPayload = z.infer<typeof promoBindingVerificationSchema>;

export const promoProofSchema = z.object({
  url: z.string().trim().url().max(2_048).optional(),
  videoUrl: z.string().trim().url().max(2_048).optional(),
  note: z.string().trim().min(1).max(2_000).refine(
    (value) => !/[<>]/.test(value),
    'HTML is not allowed',
  ).optional(),
}).strict().refine((proof) => proof.url || proof.videoUrl || proof.note, 'Proof is required');

export const promoClaimSchema = z.object({
  taskId: z.coerce.number().int().positive(),
  proofData: promoProofSchema,
}).strict();

export const promoIdempotencyKeySchema = z.string().trim().min(16).max(128).regex(
  /^[A-Za-z0-9._:-]+$/,
  'Invalid idempotency key',
);

const promoMetricValueSchema = z.coerce.number().int().min(0).max(2_147_483_647);

export const promoMetricSnapshotSchema = z.object({
  views: promoMetricValueSchema.default(0),
  likes: promoMetricValueSchema.default(0),
  comments: promoMetricValueSchema.default(0),
  shares: promoMetricValueSchema.default(0),
  favorites: promoMetricValueSchema.default(0),
  coins: promoMetricValueSchema.default(0),
  source: z.enum(['MANUAL', 'IMPORT']).default('MANUAL'),
  sourceRef: z.string().trim().min(1).max(256).optional(),
  rawSummary: z.string().trim().min(1).max(4_000).refine(
    (value) => !/[<>]/.test(value),
    'HTML is not allowed',
  ).optional(),
}).strict();

export type PromoMetricSnapshotPayload = z.infer<typeof promoMetricSnapshotSchema>;

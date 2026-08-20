import { z } from 'zod';
export const SUPPORTED_PROMO_PLATFORMS = [
    'bilibili',
    'douyin',
    'kuaishou',
    'xiaohongshu',
    'weibo',
];
const plainText = z.string().trim().min(1).max(128).refine((value) => !/[<>]/.test(value), 'HTML is not allowed');
export const promoBindingSchema = z.object({
    platform: z.string().trim().toLowerCase().pipe(z.enum(SUPPORTED_PROMO_PLATFORMS)),
    platformUserId: plainText,
    platformUsername: plainText.optional(),
}).strict();
export const promoProofSchema = z.object({
    url: z.string().trim().url().max(2_048).optional(),
    note: z.string().trim().min(1).max(2_000).refine((value) => !/[<>]/.test(value), 'HTML is not allowed').optional(),
}).strict().refine((proof) => proof.url || proof.note, 'Proof is required');
export const promoClaimSchema = z.object({
    taskId: z.coerce.number().int().positive(),
    proofData: promoProofSchema,
}).strict();
export const promoIdempotencyKeySchema = z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/, 'Invalid idempotency key');
//# sourceMappingURL=promoSchemas.js.map
import { z } from 'zod';
export declare const SUPPORTED_PROMO_PLATFORMS: readonly ["bilibili", "douyin", "kuaishou", "xiaohongshu", "weibo"];
export declare const promoBindingSchema: z.ZodObject<{
    platform: z.ZodPipe<z.ZodString, z.ZodEnum<{
        bilibili: "bilibili";
        douyin: "douyin";
        kuaishou: "kuaishou";
        xiaohongshu: "xiaohongshu";
        weibo: "weibo";
    }>>;
    platformUserId: z.ZodString;
    platformUsername: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type PromoBindingPayload = z.infer<typeof promoBindingSchema>;
export declare const promoProofSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const promoClaimSchema: z.ZodObject<{
    taskId: z.ZodCoercedNumber<unknown>;
    proofData: z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const promoIdempotencyKeySchema: z.ZodString;
//# sourceMappingURL=promoSchemas.d.ts.map
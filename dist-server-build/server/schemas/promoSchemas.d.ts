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
    platformUsername: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
}, z.core.$strict>;
export declare const promoBindingVerificationSchema: z.ZodObject<{
    proofUrl: z.ZodString;
}, z.core.$strict>;
export type PromoBindingPayload = z.infer<typeof promoBindingSchema>;
export type PromoBindingVerificationPayload = z.infer<typeof promoBindingVerificationSchema>;
export declare const promoProofSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    videoUrl: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const promoClaimSchema: z.ZodObject<{
    taskId: z.ZodCoercedNumber<unknown>;
    proofData: z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        videoUrl: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const promoIdempotencyKeySchema: z.ZodString;
export declare const promoMetricSnapshotSchema: z.ZodObject<{
    views: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    likes: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    comments: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    shares: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    favorites: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    coins: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    source: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        IMPORT: "IMPORT";
    }>>;
    sourceRef: z.ZodOptional<z.ZodString>;
    rawSummary: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type PromoMetricSnapshotPayload = z.infer<typeof promoMetricSnapshotSchema>;
//# sourceMappingURL=promoSchemas.d.ts.map
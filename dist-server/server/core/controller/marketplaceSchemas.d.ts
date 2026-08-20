import { z } from 'zod';
export declare const marketplaceShopThemeSchema: z.ZodEnum<{
    default: "default";
    minimal: "minimal";
    creator: "creator";
    tech: "tech";
}>;
export declare const marketplaceCreateProductSchema: z.ZodObject<{
    title: z.ZodString;
    category: z.ZodEnum<{
        map: "map";
        plugin: "plugin";
        mod: "mod";
        modpack: "modpack";
        resource_pack: "resource_pack";
        template: "template";
    }>;
    description: z.ZodString;
    price: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>;
    currency: z.ZodDefault<z.ZodLiteral<"CNY">>;
    taxIncluded: z.ZodBoolean;
    additionalFees: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>;
    validityText: z.ZodString;
    deliveryMethod: z.ZodString;
    deliveryEta: z.ZodString;
    compatibility: z.ZodString;
    isPlatformOperated: z.ZodBoolean;
    sellerIdentity: z.ZodString;
    afterSalesContact: z.ZodString;
    refundTerms: z.ZodString;
    ipSource: z.ZodString;
    prohibitedUse: z.ZodString;
    riskNotice: z.ZodString;
    productVersion: z.ZodString;
    fileSha256: z.ZodOptional<z.ZodString>;
    assetSize: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>>;
    assetMime: z.ZodOptional<z.ZodString>;
    author: z.ZodString;
    coverUrl: z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>;
    downloadUrl: z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>;
}, z.core.$strict>;
export declare const marketplaceUpdateProductSchema: z.ZodObject<{
    currency: z.ZodOptional<z.ZodLiteral<"CNY">>;
    title: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<{
        map: "map";
        plugin: "plugin";
        mod: "mod";
        modpack: "modpack";
        resource_pack: "resource_pack";
        template: "template";
    }>>;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>>;
    taxIncluded: z.ZodOptional<z.ZodBoolean>;
    additionalFees: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>>;
    validityText: z.ZodOptional<z.ZodString>;
    deliveryMethod: z.ZodOptional<z.ZodString>;
    deliveryEta: z.ZodOptional<z.ZodString>;
    compatibility: z.ZodOptional<z.ZodString>;
    isPlatformOperated: z.ZodOptional<z.ZodBoolean>;
    sellerIdentity: z.ZodOptional<z.ZodString>;
    afterSalesContact: z.ZodOptional<z.ZodString>;
    refundTerms: z.ZodOptional<z.ZodString>;
    ipSource: z.ZodOptional<z.ZodString>;
    prohibitedUse: z.ZodOptional<z.ZodString>;
    riskNotice: z.ZodOptional<z.ZodString>;
    productVersion: z.ZodOptional<z.ZodString>;
    fileSha256: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    assetSize: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>>>;
    assetMime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    author: z.ZodOptional<z.ZodString>;
    coverUrl: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>>;
    downloadUrl: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>>;
}, z.core.$strict>;
export declare const marketplaceCreateOrderSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>>;
    policyAcceptance: z.ZodObject<{
        accepted: z.ZodLiteral<true>;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const marketplaceCreateReviewSchema: z.ZodObject<{
    rating: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>;
    content: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const marketplaceReviewProductSchema: z.ZodObject<{
    status: z.ZodEnum<{
        APPROVED: "APPROVED";
        REJECTED: "REJECTED";
        SUSPENDED: "SUSPENDED";
    }>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const marketplaceReviewSellerSchema: z.ZodObject<{
    status: z.ZodEnum<{
        ACTIVE: "ACTIVE";
        SUSPENDED: "SUSPENDED";
    }>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const marketplaceSubmitAppealSchema: z.ZodObject<{
    targetType: z.ZodEnum<{
        PRODUCT: "PRODUCT";
        SELLER: "SELLER";
    }>;
    targetId: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
    evidence: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const marketplaceReviewAppealSchema: z.ZodObject<{
    decision: z.ZodEnum<{
        APPROVED: "APPROVED";
        REJECTED: "REJECTED";
    }>;
    note: z.ZodString;
}, z.core.$strict>;
export declare const marketplaceOpenDisputeSchema: z.ZodObject<{
    reason: z.ZodEnum<{
        UNAUTHORIZED: "UNAUTHORIZED";
        NOT_DELIVERED: "NOT_DELIVERED";
        NOT_AS_DESCRIBED: "NOT_AS_DESCRIBED";
        OTHER: "OTHER";
    }>;
    description: z.ZodString;
}, z.core.$strict>;
export declare const marketplaceResolveDisputeSchema: z.ZodObject<{
    status: z.ZodEnum<{
        REJECTED: "REJECTED";
        RESOLVED: "RESOLVED";
    }>;
    resolution: z.ZodString;
}, z.core.$strict>;
export declare const marketplaceShopOwnerParamsSchema: z.ZodObject<{
    ownerId: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>;
}, z.core.$strict>;
export declare const marketplaceShopThemeParamsSchema: z.ZodObject<{
    ownerId: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>;
    theme: z.ZodEnum<{
        default: "default";
        minimal: "minimal";
        creator: "creator";
        tech: "tech";
    }>;
}, z.core.$strict>;
export declare const marketplaceShopConfigSchema: z.ZodObject<{
    bannerUrl: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodString]>>;
    avatarUrl: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodString]>>;
    announcementTitle: z.ZodOptional<z.ZodString>;
    announcementText: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    shopName: z.ZodOptional<z.ZodString>;
    theme: z.ZodOptional<z.ZodEnum<{
        default: "default";
        minimal: "minimal";
        creator: "creator";
        tech: "tech";
    }>>;
}, z.core.$strict>;
export declare const marketplaceShopMetricSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        announcement: "announcement";
        featured: "featured";
    }>;
}, z.core.$strict>;
export declare const marketplaceEmptyBodySchema: z.ZodObject<{}, z.core.$strict>;
export declare const marketplaceVerificationSubmitSchema: z.ZodObject<{}, z.core.$strict>;
export declare const marketplaceVerificationReviewSchema: z.ZodObject<{
    status: z.ZodEnum<{
        REJECTED: "REJECTED";
        EXPIRED: "EXPIRED";
        VERIFIED: "VERIFIED";
    }>;
    note: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export type MarketplaceCreateProductInput = z.infer<typeof marketplaceCreateProductSchema>;
export type MarketplaceUpdateProductInput = z.infer<typeof marketplaceUpdateProductSchema>;
export type MarketplaceCreateOrderInput = z.infer<typeof marketplaceCreateOrderSchema>;
export type MarketplaceCreateReviewInput = z.infer<typeof marketplaceCreateReviewSchema>;
export type MarketplaceReviewProductInput = z.infer<typeof marketplaceReviewProductSchema>;
export type MarketplaceReviewSellerInput = z.infer<typeof marketplaceReviewSellerSchema>;
export type MarketplaceSubmitAppealInput = z.infer<typeof marketplaceSubmitAppealSchema>;
export type MarketplaceReviewAppealInput = z.infer<typeof marketplaceReviewAppealSchema>;
export type MarketplaceOpenDisputeInput = z.infer<typeof marketplaceOpenDisputeSchema>;
export type MarketplaceResolveDisputeInput = z.infer<typeof marketplaceResolveDisputeSchema>;
export type MarketplaceShopConfigInput = z.infer<typeof marketplaceShopConfigSchema>;
export type MarketplaceShopMetricInput = z.infer<typeof marketplaceShopMetricSchema>;
export type MarketplaceVerificationReviewInput = z.infer<typeof marketplaceVerificationReviewSchema>;
//# sourceMappingURL=marketplaceSchemas.d.ts.map
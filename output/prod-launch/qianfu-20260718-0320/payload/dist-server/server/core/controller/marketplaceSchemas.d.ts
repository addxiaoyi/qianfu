import { z } from 'zod';
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
    author: z.ZodString;
    coverUrl: z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>;
    downloadUrl: z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>;
}, z.core.$strict>;
export declare const marketplaceUpdateProductSchema: z.ZodObject<{
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
    author: z.ZodOptional<z.ZodString>;
    coverUrl: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>>;
    downloadUrl: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<undefined, "">>, z.ZodString]>>>;
}, z.core.$strict>;
export declare const marketplaceCreateOrderSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodDefault<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodNumber>>;
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
export type MarketplaceCreateProductInput = z.infer<typeof marketplaceCreateProductSchema>;
export type MarketplaceUpdateProductInput = z.infer<typeof marketplaceUpdateProductSchema>;
export type MarketplaceCreateOrderInput = z.infer<typeof marketplaceCreateOrderSchema>;
export type MarketplaceCreateReviewInput = z.infer<typeof marketplaceCreateReviewSchema>;
export type MarketplaceReviewProductInput = z.infer<typeof marketplaceReviewProductSchema>;
export type MarketplaceReviewSellerInput = z.infer<typeof marketplaceReviewSellerSchema>;
export type MarketplaceOpenDisputeInput = z.infer<typeof marketplaceOpenDisputeSchema>;
export type MarketplaceResolveDisputeInput = z.infer<typeof marketplaceResolveDisputeSchema>;
//# sourceMappingURL=marketplaceSchemas.d.ts.map
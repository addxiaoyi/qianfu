import { z } from 'zod';
const MAX_PRICE = 1_000_000;
const MAX_QUANTITY = 100;
const marketplaceCategorySchema = z.enum([
    'map',
    'plugin',
    'mod',
    'modpack',
    'resource_pack',
    'template',
]);
const integerInput = (label) => z.union([
    z.number(),
    z.string().regex(/^\d+$/, `${label} must be an integer`).transform(Number),
]);
const isPrivateIpv4 = (hostname) => {
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }
    const [first, second, third] = parts;
    return first === 10
        || first === 127
        || first === 0
        || first >= 224
        || (first === 100 && second >= 64 && second <= 127)
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && (second === 168 || (second === 0 && (third === 0 || third === 2))))
        || (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100)))
        || (first === 203 && second === 0 && third === 113);
};
const isSafeAssetUrl = (value) => {
    if (value.startsWith('/uploads/')) {
        let decoded;
        try {
            decoded = decodeURIComponent(value);
        }
        catch {
            return false;
        }
        return !decoded.includes('..')
            && !decoded.includes('\\')
            && /^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(decoded);
    }
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password)
            return false;
        const hostname = url.hostname.toLowerCase();
        const isLocalName = hostname === 'localhost'
            || hostname.endsWith('.localhost')
            || hostname.endsWith('.local')
            || hostname.endsWith('.internal');
        const isPrivateIpv6 = hostname === '[::1]'
            || hostname.startsWith('[fc')
            || hostname.startsWith('[fd')
            || hostname.startsWith('[fe80:');
        return !isLocalName && !isPrivateIpv4(hostname) && !isPrivateIpv6;
    }
    catch {
        return false;
    }
};
const assetUrlSchema = z.string()
    .trim()
    .max(2_048, 'Asset URL is too long')
    .refine(isSafeAssetUrl, 'Asset URL must use HTTPS or a controlled upload path');
const optionalAssetUrlSchema = z.union([
    z.literal('').transform(() => undefined),
    assetUrlSchema,
]).optional();
const productFields = {
    title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
    category: marketplaceCategorySchema,
    description: z.string().trim().min(1, 'Description is required').max(50_000, 'Description is too long'),
    price: integerInput('Price').pipe(z.number().int().positive().max(MAX_PRICE)),
    author: z.string().trim().min(1, 'Author is required').max(80, 'Author is too long'),
    coverUrl: optionalAssetUrlSchema,
    downloadUrl: optionalAssetUrlSchema,
};
export const marketplaceCreateProductSchema = z.object(productFields).strict();
export const marketplaceUpdateProductSchema = z.object(productFields)
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one product field is required');
export const marketplaceCreateOrderSchema = z.object({
    productId: z.string().trim().min(1, 'Product ID is required').max(120, 'Product ID is too long'),
    quantity: integerInput('Quantity').pipe(z.number().int().min(1).max(MAX_QUANTITY)).default(1),
}).strict();
export const marketplaceCreateReviewSchema = z.object({
    rating: integerInput('Rating').pipe(z.number().int().min(1).max(5)),
    content: z.string().trim().max(2_000, 'Review is too long').optional(),
}).strict();
export const marketplaceReviewProductSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
    notes: z.string().trim().max(2_000, 'Moderation notes are too long').optional(),
}).strict();
export const marketplaceReviewSellerSchema = z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    notes: z.string().trim().max(2_000, 'Seller moderation notes are too long').optional(),
}).strict();
export const marketplaceOpenDisputeSchema = z.object({
    reason: z.enum(['NOT_DELIVERED', 'NOT_AS_DESCRIBED', 'UNAUTHORIZED', 'OTHER']),
    description: z.string().trim().min(10, 'Dispute description is too short').max(2_000, 'Dispute description is too long'),
}).strict();
export const marketplaceResolveDisputeSchema = z.object({
    status: z.enum(['RESOLVED', 'REJECTED']),
    resolution: z.string().trim().min(1, 'Resolution is required').max(2_000, 'Resolution is too long'),
}).strict();
//# sourceMappingURL=marketplaceSchemas.js.map
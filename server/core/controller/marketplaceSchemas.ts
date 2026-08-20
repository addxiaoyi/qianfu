import { z } from 'zod';

const MAX_PRICE = 1_000_000;
const MAX_QUANTITY = 100;
const MAX_SHOP_TEXT = 2_000;

const marketplaceCategorySchema = z.enum([
  'map',
  'plugin',
  'mod',
  'modpack',
  'resource_pack',
  'template',
]);

const integerInput = (label: string) => z.union([
  z.number(),
  z.string().regex(/^\d+$/, `${label} must be an integer`).transform(Number),
]);

const isPrivateIpv4 = (hostname: string): boolean => {
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

const isSafeAssetUrl = (value: string): boolean => {
  if (value.startsWith('/uploads/')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      return false;
    }
    return !decoded.includes('..')
      && !decoded.includes('\\')
      && /^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(decoded);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;

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
  } catch {
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

const shopAssetUrlSchema = z.union([
  z.literal(''),
  assetUrlSchema,
]);

export const marketplaceShopThemeSchema = z.enum([
  'default',
  'tech',
  'minimal',
  'creator',
]);

const productFields = {
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  category: marketplaceCategorySchema,
  description: z.string().trim().min(1, 'Description is required').max(50_000, 'Description is too long'),
  price: integerInput('Price').pipe(z.number().int().positive().max(MAX_PRICE)),
  currency: z.literal('CNY').default('CNY'),
  taxIncluded: z.boolean(),
  additionalFees: integerInput('Additional fees').pipe(z.number().int().min(0).max(MAX_PRICE)),
  validityText: z.string().trim().min(2).max(500),
  deliveryMethod: z.string().trim().min(2).max(200),
  deliveryEta: z.string().trim().min(2).max(200),
  compatibility: z.string().trim().min(2).max(2_000),
  isPlatformOperated: z.boolean(),
  sellerIdentity: z.string().trim().min(2).max(500),
  afterSalesContact: z.string().trim().min(2).max(500),
  refundTerms: z.string().trim().min(2).max(2_000),
  ipSource: z.string().trim().min(2).max(2_000),
  prohibitedUse: z.string().trim().min(2).max(2_000),
  riskNotice: z.string().trim().min(2).max(2_000),
  productVersion: z.string().trim().min(1).max(80),
  fileSha256: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Invalid SHA-256').optional(),
  assetSize: integerInput('Asset size').pipe(z.number().int().min(0)).optional(),
  assetMime: z.string().trim().min(1).max(120).optional(),
  author: z.string().trim().min(1, 'Author is required').max(80, 'Author is too long'),
  coverUrl: optionalAssetUrlSchema,
  downloadUrl: optionalAssetUrlSchema,
};

export const marketplaceCreateProductSchema = z.object(productFields).strict();

const productUpdateFields = {
  ...productFields,
  currency: z.literal('CNY'),
};

export const marketplaceUpdateProductSchema = z.object(productUpdateFields)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one product field is required');

export const marketplaceCreateOrderSchema = z.object({
  productId: z.string().trim().min(1, 'Product ID is required').max(120, 'Product ID is too long'),
  quantity: integerInput('Quantity').pipe(z.number().int().min(1).max(MAX_QUANTITY)).default(1),
  policyAcceptance: z.object({ accepted: z.literal(true) }).strict(),
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

export const marketplaceSubmitAppealSchema = z.object({
  targetType: z.enum(['SELLER', 'PRODUCT']),
  targetId: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(10, 'Appeal reason is too short').max(2_000, 'Appeal reason is too long'),
  evidence: z.string().trim().max(5_000, 'Appeal evidence is too long').optional(),
}).strict().superRefine((body, context) => {
  if (body.targetType === 'PRODUCT' && !body.targetId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetId'], message: 'Product ID is required' });
  }
});

export const marketplaceReviewAppealSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().min(1, 'Decision note is required').max(2_000, 'Decision note is too long'),
}).strict();

export const marketplaceOpenDisputeSchema = z.object({
  reason: z.enum(['NOT_DELIVERED', 'NOT_AS_DESCRIBED', 'UNAUTHORIZED', 'OTHER']),
  description: z.string().trim().min(10, 'Dispute description is too short').max(2_000, 'Dispute description is too long'),
}).strict();

export const marketplaceResolveDisputeSchema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  resolution: z.string().trim().min(1, 'Resolution is required').max(2_000, 'Resolution is too long'),
}).strict();

export const marketplaceShopOwnerParamsSchema = z.object({
  ownerId: integerInput('Owner ID').pipe(z.number().int().positive()),
}).strict();

export const marketplaceShopThemeParamsSchema = z.object({
  ownerId: integerInput('Owner ID').pipe(z.number().int().positive()),
  theme: marketplaceShopThemeSchema,
}).strict();

export const marketplaceShopConfigSchema = z.object({
  bannerUrl: shopAssetUrlSchema.optional(),
  avatarUrl: shopAssetUrlSchema.optional(),
  announcementTitle: z.string().trim().max(80, 'Announcement title is too long').optional(),
  announcementText: z.string().trim().max(MAX_SHOP_TEXT, 'Announcement is too long').optional(),
  bio: z.string().trim().max(500, 'Shop bio is too long').optional(),
  shopName: z.string().trim().min(1, 'Shop name is required').max(60, 'Shop name is too long').optional(),
  theme: marketplaceShopThemeSchema.optional(),
}).strict().refine((body) => Object.keys(body).length > 0, 'At least one shop field is required');

export const marketplaceShopMetricSchema = z.object({
  kind: z.enum(['announcement', 'featured']),
}).strict();

export const marketplaceEmptyBodySchema = z.object({}).strict();
export const marketplaceVerificationSubmitSchema = marketplaceEmptyBodySchema;

export const marketplaceVerificationReviewSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'EXPIRED']),
  note: z.string().trim().max(1_000, 'Verification note is too long').optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().superRefine((body, ctx) => {
  if (body.status !== 'VERIFIED' && !body.note) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['note'],
      message: 'A review note is required for rejected or expired verification',
    });
  }

  if (body.expiresAt && Date.parse(body.expiresAt) <= Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiresAt'],
      message: 'Verification expiry must be in the future',
    });
  }
});

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

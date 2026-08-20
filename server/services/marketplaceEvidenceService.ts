import crypto from 'crypto';

import { getJwtSecret } from '../utils/securityConfig';

export const MARKETPLACE_POLICY_SNAPSHOT = Object.freeze({
  terms: { path: '/terms', version: '2026-07-30' },
  marketplaceRules: { path: '/marketplace-rules', version: '2026-07-30' },
  digitalDeliveryRules: { path: '/digital-delivery-rules', version: '2026-07-30' },
  refundPolicy: { path: '/refund-policy', version: '2026-07-30' },
});

const normalizeForStableJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeForStableJson);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForStableJson(entry)]),
    );
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

export const stableJsonStringify = (value: unknown): string => (
  JSON.stringify(normalizeForStableJson(value))
);

export const hmacEvidenceValue = (purpose: string, value: string | null | undefined): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${purpose}\u0000${normalized}`)
    .digest('hex');
};

export interface MarketplaceListingRecord {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  tax_included: boolean;
  additional_fees: number;
  validity_text: string;
  delivery_method: string;
  delivery_eta: string;
  compatibility: string;
  is_platform_operated: boolean;
  seller_identity: string;
  author_name: string;
  after_sales_contact: string;
  refund_terms: string;
  ip_source: string;
  prohibited_use: string;
  risk_notice: string;
  product_version: string;
  file_sha256: string | null;
  asset_size: number | null;
  asset_mime: string | null;
  download_url: string | null;
  creator_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export const buildMarketplaceListingSnapshot = (product: MarketplaceListingRecord) => ({
  productId: product.id,
  productName: product.title,
  category: product.category,
  description: product.description,
  unitPrice: product.price,
  currency: product.currency,
  taxIncluded: product.tax_included,
  additionalFees: product.additional_fees,
  validity: product.validity_text,
  deliveryMethod: product.delivery_method,
  deliveryEta: product.delivery_eta,
  compatibility: product.compatibility,
  platformOperated: product.is_platform_operated,
  sellerIdentity: product.seller_identity,
  author: product.author_name,
  afterSalesContact: product.after_sales_contact,
  refundTerms: product.refund_terms,
  intellectualPropertySource: product.ip_source,
  prohibitedUse: product.prohibited_use,
  riskNotice: product.risk_notice,
  productVersion: product.product_version,
  fileSha256: product.file_sha256,
  assetSize: product.asset_size,
  assetMime: product.asset_mime,
  creatorId: product.creator_id,
  listingCreatedAt: product.created_at,
  listingUpdatedAt: product.updated_at,
});

export const buildMarketplacePolicySnapshot = () => MARKETPLACE_POLICY_SNAPSHOT;

export const buildMarketplaceVersionId = (productId: string): string => (
  `mpv_${crypto.createHash('sha256').update(`${productId}\u0000${crypto.randomUUID()}`).digest('hex')}`
);

export const buildMarketplaceEvidenceId = (prefix: 'mpe' | 'mde', reference: string): string => (
  `${prefix}_${crypto.createHash('sha256').update(`${reference}\u0000${crypto.randomUUID()}`).digest('hex')}`
);

export const hashDeliveryReference = (value: string | null | undefined): string | null => {
  const normalized = String(value || '').trim();
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : null;
};

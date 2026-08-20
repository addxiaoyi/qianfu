export declare const MARKETPLACE_POLICY_SNAPSHOT: Readonly<{
    terms: {
        path: string;
        version: string;
    };
    marketplaceRules: {
        path: string;
        version: string;
    };
    digitalDeliveryRules: {
        path: string;
        version: string;
    };
    refundPolicy: {
        path: string;
        version: string;
    };
}>;
export declare const stableJsonStringify: (value: unknown) => string;
export declare const hmacEvidenceValue: (purpose: string, value: string | null | undefined) => string | null;
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
export declare const buildMarketplaceListingSnapshot: (product: MarketplaceListingRecord) => {
    productId: string;
    productName: string;
    category: string;
    description: string;
    unitPrice: number;
    currency: string;
    taxIncluded: boolean;
    additionalFees: number;
    validity: string;
    deliveryMethod: string;
    deliveryEta: string;
    compatibility: string;
    platformOperated: boolean;
    sellerIdentity: string;
    author: string;
    afterSalesContact: string;
    refundTerms: string;
    intellectualPropertySource: string;
    prohibitedUse: string;
    riskNotice: string;
    productVersion: string;
    fileSha256: string | null;
    assetSize: number | null;
    assetMime: string | null;
    creatorId: number | null;
    listingCreatedAt: Date;
    listingUpdatedAt: Date;
};
export declare const buildMarketplacePolicySnapshot: () => Readonly<{
    terms: {
        path: string;
        version: string;
    };
    marketplaceRules: {
        path: string;
        version: string;
    };
    digitalDeliveryRules: {
        path: string;
        version: string;
    };
    refundPolicy: {
        path: string;
        version: string;
    };
}>;
export declare const buildMarketplaceVersionId: (productId: string) => string;
export declare const buildMarketplaceEvidenceId: (prefix: "mpe" | "mde", reference: string) => string;
export declare const hashDeliveryReference: (value: string | null | undefined) => string | null;
//# sourceMappingURL=marketplaceEvidenceService.d.ts.map
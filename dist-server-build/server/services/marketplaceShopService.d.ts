import type { MarketplaceShopConfigInput, MarketplaceShopMetricInput, MarketplaceVerificationReviewInput } from '../core/controller/marketplaceSchemas';
export type MarketplaceShopTheme = 'default' | 'tech' | 'minimal' | 'creator';
export type MarketplaceVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export interface MarketplaceShopConfig {
    bannerUrl: string;
    avatarUrl: string;
    announcementTitle: string;
    announcementText: string;
    bio: string;
    shopName: string;
    ownerId: number;
    theme: MarketplaceShopTheme;
}
export interface MarketplaceShopMetrics {
    visits: number;
    announcementClicks: number;
    featuredClicks: number;
    updatedAt: string;
}
export interface MarketplaceShopVersion {
    id: string;
    config: MarketplaceShopConfig;
    createdAt: string;
}
export interface MarketplaceVerificationView {
    status: MarketplaceVerificationStatus;
    submittedAt: string | null;
    reviewedAt: string | null;
    expiresAt: string | null;
}
interface MarketplaceVerificationAudit extends MarketplaceVerificationView {
    reviewedBy: number | null;
    note: string | null;
}
interface Change<T> {
    before: T;
    after: T;
}
export declare function getEffectiveMarketplaceVerificationStatus(status: string, expiresAt: Date | null, now?: Date): MarketplaceVerificationStatus;
export declare const canEditMarketplaceShop: (viewerId: number | null | undefined, ownerId: number) => boolean;
export declare function getMarketplaceShop(ownerId: number, viewerId?: number | null): Promise<{
    config: MarketplaceShopConfig;
    editable: boolean;
    metrics: MarketplaceShopMetrics;
    verification: MarketplaceVerificationView;
    versions: MarketplaceShopVersion[];
}>;
export declare function getMarketplaceShopHistory(ownerId: number): Promise<MarketplaceShopVersion[]>;
export declare function updateMarketplaceShop(ownerId: number, input: MarketplaceShopConfigInput): Promise<Change<MarketplaceShopConfig>>;
export declare function resetMarketplaceShop(ownerId: number): Promise<Change<MarketplaceShopConfig>>;
export declare function applyMarketplaceShopTheme(ownerId: number, theme: MarketplaceShopTheme): Promise<Change<MarketplaceShopConfig>>;
export declare function incrementMarketplaceShopMetric(ownerId: number, kind: MarketplaceShopMetricInput['kind']): Promise<MarketplaceShopMetrics>;
export declare function getMarketplaceVerification(ownerId: number): Promise<MarketplaceVerificationView>;
export declare function submitMarketplaceVerification(ownerId: number): Promise<Change<MarketplaceVerificationAudit>>;
export declare function reviewMarketplaceVerification(ownerId: number, reviewerId: number, input: MarketplaceVerificationReviewInput): Promise<Change<MarketplaceVerificationAudit>>;
export {};
//# sourceMappingURL=marketplaceShopService.d.ts.map
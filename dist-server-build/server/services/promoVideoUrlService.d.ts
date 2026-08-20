export interface PromoVideoReference {
    platform: string;
    normalizedUrl: string;
    videoId: string;
    host: string;
}
export declare const parsePromoVideoUrl: (platformInput: string, rawUrl: string) => PromoVideoReference;
export declare const getPromoPlatformHosts: (platform: string) => readonly string[];
//# sourceMappingURL=promoVideoUrlService.d.ts.map
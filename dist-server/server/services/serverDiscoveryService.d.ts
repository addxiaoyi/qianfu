export type DiscoveryServer = {
    activity?: number | null;
    like_count?: number | null;
    comment_count?: number | null;
    listing_plan?: string | null;
    listing_expires_at?: Date | string | null;
    status?: {
        online?: boolean | null;
        playersOnline?: number | null;
    } | null;
};
export declare const isPromotionActive: (server: DiscoveryServer, now?: number) => boolean;
export declare const buildDiscoverySeed: (filterKey: string, discoveryWindow: number) => string;
export declare const getDiscoveryWeight: (server: DiscoveryServer, _now?: number) => number;
export declare const weightedShuffle: <T extends DiscoveryServer>(servers: readonly T[], random?: () => number, now?: number) => T[];
export declare const createSeededRandom: (seed: string) => () => number;
//# sourceMappingURL=serverDiscoveryService.d.ts.map
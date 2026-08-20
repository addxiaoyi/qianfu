export interface PromoBindingInput {
    platform: string;
    platformUserId: string;
    platformUsername?: string | null;
}
interface PromoBindingDb {
    promoPlatformBinding: {
        findUnique(args: unknown): Promise<{
            id: number;
            user_id: number;
        } | null>;
        upsert(args: unknown): Promise<unknown>;
    };
}
export declare const bindPromoPlatformAccount: (db: PromoBindingDb, userId: number, input: PromoBindingInput) => Promise<unknown>;
export {};
//# sourceMappingURL=promoBindingService.d.ts.map
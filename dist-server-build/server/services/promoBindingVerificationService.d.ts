export interface PromoBindingRecord {
    id: number;
    user_id: number;
    platform: string;
    platform_user_id: string;
    platform_username?: string | null;
    binding_status: string;
    bind_source?: string;
    verified_at?: Date | null;
    last_verify_at?: Date | null;
    created_at?: Date;
    updated_at?: Date;
}
interface PromoBindingVerificationDb {
    promoPlatformBinding: {
        findFirst(args: unknown): Promise<PromoBindingRecord | null>;
        update(args: unknown): Promise<PromoBindingRecord>;
    };
}
export declare const buildPromoBindingChallenge: (binding: Pick<PromoBindingRecord, "id" | "user_id" | "platform" | "platform_user_id">, secret?: string) => string;
export declare const decoratePromoBinding: <T extends PromoBindingRecord>(binding: T) => T & {
    binding_status: string;
    verification_code: string;
    verification_method: string;
};
export declare const validatePromoProofUrl: (platformInput: string, rawUrl: string) => URL;
export declare const verifyPromoPlatformBinding: (db: PromoBindingVerificationDb, userId: number, bindingId: number, proofUrl: string, fetchImpl?: typeof fetch) => Promise<PromoBindingRecord>;
export {};
//# sourceMappingURL=promoBindingVerificationService.d.ts.map
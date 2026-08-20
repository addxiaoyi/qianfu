export type MarketplaceAppealTargetType = 'SELLER' | 'PRODUCT';
export type MarketplaceAppealDecision = 'APPROVED' | 'REJECTED';
export interface SubmitMarketplaceAppealInput {
    targetType: MarketplaceAppealTargetType;
    targetId?: string;
    reason: string;
    evidence?: string;
}
export interface ReviewMarketplaceAppealInput {
    decision: MarketplaceAppealDecision;
    note: string;
}
export declare function submitMarketplaceAppeal(appellantId: number, input: SubmitMarketplaceAppealInput, client?: any): Promise<any>;
export declare function listMarketplaceAppealsForUser(appellantId: number, client?: any): Promise<any>;
export declare function listMarketplaceAppeals(status?: string, client?: any): Promise<any>;
export declare function reviewMarketplaceAppeal(appealId: string, reviewerId: number, input: ReviewMarketplaceAppealInput, client?: any): Promise<any>;
//# sourceMappingURL=marketplaceAppealService.d.ts.map
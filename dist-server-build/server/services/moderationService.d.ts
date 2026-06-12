interface ModerationResult {
    passed: boolean;
    reason?: string;
    score?: number;
    rawResponse?: any;
}
export declare class ModerationService {
    static checkText(content: string, userId?: number): Promise<ModerationResult>;
    static checkImage(imageUrl: string, userId?: number): Promise<ModerationResult>;
    /**
     * Get moderation statistics
     */
    static getStats(): Promise<{
        total: number;
        rejected: number;
        last24h: number;
        passRate: string;
    }>;
}
export {};
//# sourceMappingURL=moderationService.d.ts.map
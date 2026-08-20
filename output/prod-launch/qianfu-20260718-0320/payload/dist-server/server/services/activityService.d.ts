/**
 * Service to manage server activity calculations and updates
 */
export declare class ActivityService {
    private static interval;
    private static IS_RUNNING;
    /**
     * Start the periodic activity update job
     * @param intervalMs How often to update (default 10 minutes)
     */
    static start(intervalMs?: number): void;
    /**
     * Stop the periodic job
     */
    static stop(): void;
    /**
     * Update activity for all approved servers
     */
    static updateAllServerActivity(): Promise<void>;
    /**
     * Calculate instant activity score based on current probe status
     * @param result Probe result including status and duration
     */
    private static calculateInstantScore;
}
//# sourceMappingURL=activityService.d.ts.map
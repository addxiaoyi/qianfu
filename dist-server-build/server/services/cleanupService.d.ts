export declare function cleanupExpiredUnverified(): Promise<number>;
export declare function cleanupExpiredPayments(): Promise<number>;
export declare function cleanupServerStatusHistory(): Promise<number>;
export declare function startCleanupScheduler(intervalMs?: number): NodeJS.Timeout;
//# sourceMappingURL=cleanupService.d.ts.map
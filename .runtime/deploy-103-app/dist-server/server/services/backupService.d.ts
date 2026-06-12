declare class BackupService {
    private interval;
    private readonly BACKUP_INTERVAL;
    /**
     * Start automated backup service
     */
    start(): void;
    /**
     * Stop backup service
     */
    stop(): void;
}
export declare const backupService: BackupService;
export {};
//# sourceMappingURL=backupService.d.ts.map
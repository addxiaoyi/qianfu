import { backupDatabase } from '../../scripts/backup-db';
import { logger } from '../utils/logger';
class BackupService {
    interval = null;
    BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    /**
     * Start automated backup service
     */
    start() {
        if (this.interval)
            return;
        logger.info('[BackupService] Starting automated backup service...');
        // Initial backup on start
        backupDatabase().catch((err) => {
            logger.error(`[BackupService] Initial backup failed: ${err}`);
        });
        // Schedule subsequent backups
        this.interval = setInterval(() => {
            logger.info('[BackupService] Running scheduled backup...');
            backupDatabase().catch((err) => {
                logger.error(`[BackupService] Scheduled backup failed: ${err}`);
            });
        }, this.BACKUP_INTERVAL);
    }
    /**
     * Stop backup service
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            logger.info('[BackupService] Automated backup service stopped.');
        }
    }
}
export const backupService = new BackupService();
//# sourceMappingURL=backupService.js.map
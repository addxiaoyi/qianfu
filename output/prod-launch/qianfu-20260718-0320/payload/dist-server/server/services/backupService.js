import { backupDatabase } from '../../scripts/backup-db.js';
import { logger } from '../utils/logger.js';
import { getPrimaryDbProvider } from '../utils/dbProvider.js';
class BackupService {
    interval = null;
    BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    runInitialBackupOnStart = process.env.RUN_STARTUP_BACKUP === 'true';
    /**
     * Start automated backup service
     */
    start() {
        if (this.interval)
            return;
        logger.info('[BackupService] Starting automated backup service...');
        logger.info(`[BackupService] Active database provider: ${getPrimaryDbProvider()}`);
        if (this.runInitialBackupOnStart) {
            backupDatabase().catch((err) => {
                logger.error(`[BackupService] Initial backup failed: ${err}`);
            });
        }
        else {
            logger.info('[BackupService] Startup backup skipped. Set RUN_STARTUP_BACKUP=true to enable immediate backup on boot.');
        }
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
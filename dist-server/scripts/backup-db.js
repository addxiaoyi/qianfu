import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../server/utils/logger';
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DB_FILE = path.join(process.cwd(), 'prisma', 'dev.db');
const MAX_BACKUPS = 7; // Keep last 7 backups
/**
 * Perform database backup
 */
export async function backupDatabase() {
    try {
        // 1. Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        // 2. Create timestamped filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.db`);
        // 3. Copy database file
        if (fs.existsSync(DB_FILE)) {
            // Use synchronous copy for reliability in this script
            fs.copyFileSync(DB_FILE, backupFile);
            logger.info(`[Backup] Database backup created: ${backupFile}`);
            // 4. Clean up old backups
            rotateBackups();
        }
        else {
            logger.error(`[Backup] Source database file not found: ${DB_FILE}`);
        }
    }
    catch (error) {
        logger.error(`[Backup] Error during backup: ${error}`);
    }
}
/**
 * Delete old backups if they exceed MAX_BACKUPS
 */
function rotateBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('db-backup-') && f.endsWith('.db'))
            .map(f => ({
            name: f,
            path: path.join(BACKUP_DIR, f),
            time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
            .sort((a, b) => b.time - a.time); // Newest first
        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            for (const file of toDelete) {
                fs.unlinkSync(file.path);
                logger.info(`[Backup] Deleted old backup: ${file.name}`);
            }
        }
    }
    catch (error) {
        logger.error(`[Backup] Error during rotation: ${error}`);
    }
}
// If run directly
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('backup-db.ts') ||
    process.argv[1].endsWith('backup-db.js') ||
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]));
if (isDirectRun) {
    backupDatabase().then(() => {
        console.log('Backup process completed');
        process.exit(0);
    }).catch(err => {
        console.error('Backup process failed:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=backup-db.js.map
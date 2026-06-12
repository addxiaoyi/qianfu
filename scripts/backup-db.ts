import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../server/utils/logger';
import { getDatabaseUrl, isMySqlUrl, isPostgresUrl, isSqliteUrl } from '../server/utils/dbProvider';
import { spawnSync } from 'child_process';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7; // Keep last 7 backups

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseSqliteFilePath(databaseUrl: string): string | null {
  if (!isSqliteUrl(databaseUrl)) return null;
  const rawPath = databaseUrl.replace(/^file:/, '').split('?')[0];
  if (!rawPath) return null;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function maskPgUrl(databaseUrl: string): string {
  return databaseUrl.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, '//***:***@');
}

function backupSqlite(databaseUrl: string, timestamp: string) {
  const dbFile = parseSqliteFilePath(databaseUrl);
  const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.db`);

  if (!dbFile || !fs.existsSync(dbFile)) {
    logger.error(`[Backup] Source SQLite database file not found: ${dbFile || databaseUrl}`);
    return;
  }

  fs.copyFileSync(dbFile, backupFile);
  logger.info(`[Backup] SQLite backup created: ${backupFile}`);
}

function backupPostgres(databaseUrl: string, timestamp: string) {
  const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.sqlc`);
  const result = spawnSync('pg_dump', ['--format=custom', '--file', backupFile, databaseUrl], {
    encoding: 'utf8',
    timeout: 120000,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'unknown pg_dump failure';
    throw new Error(`[Backup] pg_dump failed for ${maskPgUrl(databaseUrl)}: ${stderr}`);
  }

  logger.info(`[Backup] PostgreSQL backup created: ${backupFile}`);
}

function backupMySql(databaseUrl: string, timestamp: string) {
  const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.sql.gz`);
  const url = new URL(databaseUrl);
  const host = url.hostname || '127.0.0.1';
  const port = url.port || '3306';
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = url.pathname.replace(/^\//, '');
  const dump = spawnSync(
    'mysqldump',
    [
      `--host=${host}`,
      `--port=${port}`,
      `--user=${user}`,
      `--password=${password}`,
      '--single-transaction',
      '--quick',
      '--skip-lock-tables',
      '--databases',
      database,
    ],
    { encoding: 'buffer', timeout: 120000, maxBuffer: 64 * 1024 * 1024 },
  );

  if (dump.status !== 0) {
    const stderr = Buffer.isBuffer(dump.stderr) ? dump.stderr.toString('utf8').trim() : String(dump.stderr || '').trim();
    throw new Error(`[Backup] mysqldump failed for mysql://${user}:***@${host}:${port}/${database}: ${stderr}`);
  }

  const gzip = spawnSync('gzip', ['-c'], {
    input: dump.stdout,
    encoding: 'buffer',
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (gzip.status !== 0) {
    const stderr = Buffer.isBuffer(gzip.stderr) ? gzip.stderr.toString('utf8').trim() : String(gzip.stderr || '').trim();
    throw new Error(`[Backup] gzip failed for MySQL dump: ${stderr}`);
  }

  fs.writeFileSync(backupFile, gzip.stdout as Buffer);
  logger.info(`[Backup] MySQL backup created: ${backupFile}`);
}

/**
 * Perform database backup
 */
export async function backupDatabase() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const databaseUrl = getDatabaseUrl();
    const timestamp = getTimestamp();

    if (isSqliteUrl(databaseUrl)) {
      backupSqlite(databaseUrl, timestamp);
      rotateBackups('.db');
    } else if (isPostgresUrl(databaseUrl)) {
      backupPostgres(databaseUrl, timestamp);
      rotateBackups('.sqlc');
    } else if (isMySqlUrl(databaseUrl)) {
      backupMySql(databaseUrl, timestamp);
      rotateBackups('.sql.gz');
    } else {
      logger.error('[Backup] Unsupported DATABASE_URL provider for backup');
    }
  } catch (error) {
    logger.error(`[Backup] Error during backup: ${error}`);
  }
}

/**
 * Delete old backups if they exceed MAX_BACKUPS
 */
function rotateBackups(extension: '.db' | '.sqlc' | '.sql.gz') {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db-backup-') && f.endsWith(extension))
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
  } catch (error) {
    logger.error(`[Backup] Error during rotation: ${error}`);
  }
}

// If run directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('backup-db.ts') || 
  process.argv[1].endsWith('backup-db.js') ||
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
);

if (isDirectRun) {
  backupDatabase().then(() => {
    console.log('Backup process completed');
    process.exit(0);
  }).catch(err => {
    console.error('Backup process failed:', err);
    process.exit(1);
  });
}

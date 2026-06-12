#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadMysqlPrismaClient() {
  const candidates = [
    '../prisma/generated/mysql-client/index.js',
    '../dist-server/prisma/generated/mysql-client/index.js',
  ];

  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      if (mod?.PrismaClient) {
        return mod.PrismaClient;
      }
    } catch {
      // try next
    }
  }

  throw new Error(`Unable to locate Prisma mysql client. Tried: ${candidates.join(', ')}`);
}

const PrismaClient = loadMysqlPrismaClient();

const cwd = process.cwd();
const sqlitePath = process.env.SQLITE_PATH
  ? path.resolve(cwd, process.env.SQLITE_PATH)
  : path.resolve(cwd, 'prisma/dev.db');
const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
const batchSize = Number.parseInt(process.env.MYSQL_IMPORT_BATCH_SIZE || '200', 10);
const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const skipDelete = process.argv.includes('--skip-delete') || process.env.SKIP_DELETE === 'true';
const verifyOnly = process.argv.includes('--verify-only') || process.env.VERIFY_ONLY === 'true';
const outputDir = path.resolve(cwd, 'output');
const reportPath = path.join(outputDir, 'mysql-migration-report.json');

const excludedTables = new Set(['_prisma_migrations', 'sqlite_sequence']);
const preferredImportOrder = [
  'User',
  'Wallet',
  'Session',
  'Notification',
  'ApiKey',
  'Server',
  'ServerStatus',
  'ServerStatusHistory',
  'ServerVersion',
  'UserBioVersion',
  'ServerComment',
  'ServerLike',
  'ReviewHistory',
  'AuditLog',
  'ModerationLog',
  'Payment',
  'Transaction',
  'Ticket',
  'TicketMessage',
  'Report',
  'PermissionHistory',
  'MarketplaceProduct',
  'MarketplaceOrder',
  'MarketplaceReview',
  'MarketplaceFavorite',
  'MarketplaceFulfillmentLog',
  'MarketplaceShopConfigVersion',
  'PromoTask',
  'PromoPlatformBinding',
  'PromoClaimRecord',
  'PromoVerifyLog',
  'PromoWalletTransaction',
  'SystemConfig',
  'TeamMember',
  'IntroPage',
  'IntroPageVersion',
  'ResourceLink',
  'AllianceGroup',
  'checkin_history',
];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function ensurePrerequisites() {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite source file not found: ${sqlitePath}`);
  }
  if (!mysqlUrl.toLowerCase().startsWith('mysql://')) {
    throw new Error('MYSQL_URL or DATABASE_URL must point to a mysql:// target.');
  }
  fs.mkdirSync(outputDir, { recursive: true });
}

function escapeIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function toSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return `X'${Buffer.from(value).toString('hex')}'`;
  }

  const stringValue = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\u0000/g, '');
  return `'${stringValue}'`;
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function isDateLikeColumnType(columnType) {
  return /(date|time|timestamp)/i.test(String(columnType || ''));
}

function formatMysqlDateTime(date) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

function normalizeDateTimeValue(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatMysqlDateTime(value);
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return null;
    const millis = numeric >= 1e11 ? numeric : numeric >= 1e9 ? numeric * 1000 : numeric;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : formatMysqlDateTime(date);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || /^0{4}-0{2}-0{2}/.test(trimmed)) return null;

    if (/^\d{10,16}$/.test(trimmed)) {
      return normalizeDateTimeValue(Number(trimmed));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed} 00:00:00.000`;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(trimmed)) {
      if (trimmed.includes('.')) {
        const [base, fraction] = trimmed.split('.');
        return `${base}.${fraction.padEnd(3, '0').slice(0, 3)}`;
      }
      return `${trimmed}.000`;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : formatMysqlDateTime(date);
  }

  return null;
}

function getSourceTables(sqlite) {
  return sqlite
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `)
    .all()
    .map((row) => row.name)
    .filter((name) => !excludedTables.has(name));
}

function sortTablesForImport(tables) {
  const orderMap = new Map(preferredImportOrder.map((name, index) => [name, index]));
  return [...tables].sort((a, b) => {
    const aOrder = orderMap.has(a) ? orderMap.get(a) : Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.has(b) ? orderMap.get(b) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.localeCompare(b);
  });
}

function getSqliteColumns(sqlite, table) {
  return sqlite
    .prepare(`PRAGMA table_info(${escapeIdentifier(table)})`)
    .all()
    .map((row) => row.name);
}

async function getMysqlTables(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    ORDER BY TABLE_NAME
  `);
  return new Set(rows.map((row) => row.TABLE_NAME));
}

async function getMysqlColumns(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM ${escapeIdentifier(table)}`);
  return rows.map((row) => row.Field);
}

async function getMysqlColumnDefinitions(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM ${escapeIdentifier(table)}`);
  return Object.fromEntries(rows.map((row) => [row.Field, row.Type]));
}

async function ensureCheckinHistoryTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS checkin_history (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      user_id INTEGER NOT NULL,
      checkin_date VARCHAR(32) NOT NULL,
      timezone VARCHAR(128),
      base_reward DOUBLE NOT NULL,
      bonus_reward DOUBLE NOT NULL DEFAULT 0,
      total_reward DOUBLE NOT NULL,
      streak_days INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_checkin_date (user_id, checkin_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await prisma.$executeRawUnsafe(
    'CREATE INDEX idx_checkin_history_user_created ON checkin_history(user_id, created_at DESC)'
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    'CREATE INDEX idx_checkin_history_user_date ON checkin_history(user_id, checkin_date DESC)'
  ).catch(() => {});
}

async function ensureMySqlTableAdjustments(prisma) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE SystemConfig
      MODIFY value LONGTEXT NOT NULL,
      MODIFY description TEXT NULL
  `).catch(() => {});
}

async function deleteTargetRows(prisma, tables) {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
  try {
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`DELETE FROM ${escapeIdentifier(table)}`);
    }
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
  }
}

async function getMysqlCount(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM ${escapeIdentifier(table)}`);
  return Number(rows[0]?.count || 0);
}

async function importTable(prisma, sqlite, table) {
  const sourceColumns = getSqliteColumns(sqlite, table);
  const targetColumns = await getMysqlColumns(prisma, table);
  const targetColumnDefinitions = await getMysqlColumnDefinitions(prisma, table);
  const importColumns = sourceColumns.filter((name) => targetColumns.includes(name));
  const rows = sqlite.prepare(`SELECT * FROM ${escapeIdentifier(table)}`).all();

  if (importColumns.length === 0) {
    return {
      table,
      sourceCount: rows.length,
      targetCount: 0,
      imported: 0,
      skipped: true,
      reason: 'no shared columns',
    };
  }

  if (rows.length === 0) {
    return {
      table,
      sourceCount: 0,
      targetCount: 0,
      imported: 0,
      skipped: false,
      reason: 'empty source table',
    };
  }

  if (!dryRun && !verifyOnly) {
    for (const batch of chunk(rows, batchSize)) {
      const valuesSql = batch
        .map((row) => {
          const normalizedRowValues = importColumns.map((column) => {
            const columnType = targetColumnDefinitions[column];
            if (isDateLikeColumnType(columnType)) {
              const normalizedDate =
                normalizeDateTimeValue(row[column]) ??
                (column === 'created_at'
                  ? normalizeDateTimeValue(row.updated_at)
                  : column === 'updated_at'
                    ? normalizeDateTimeValue(row.created_at)
                    : null) ??
                '1970-01-01 00:00:00.000';
              return toSqlLiteral(normalizedDate);
            }
            return toSqlLiteral(row[column]);
          });
          return `(${normalizedRowValues.join(', ')})`;
        })
        .join(', ');
      const sql = `INSERT INTO ${escapeIdentifier(table)} (${importColumns
        .map(escapeIdentifier)
        .join(', ')}) VALUES ${valuesSql}`;
      await prisma.$executeRawUnsafe(sql);
    }
  }

  const targetCount = verifyOnly || dryRun ? 0 : await getMysqlCount(prisma, table);
  return {
    table,
    sourceCount: rows.length,
    targetCount,
    imported: rows.length,
    skipped: false,
    columns: importColumns,
  };
}

async function main() {
  ensurePrerequisites();

  log(`SQLite source: ${sqlitePath}`);
  log(`MySQL target: ${mysqlUrl.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, '//***:***@')}`);
  log(`Mode: ${verifyOnly ? 'verify-only' : dryRun ? 'dry-run' : 'import'}`);

  const sqlite = new DatabaseSync(sqlitePath, { open: true, readOnly: true });
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: mysqlUrl,
      },
    },
  });

  const report = {
    executedAt: new Date().toISOString(),
    sqlitePath,
    dryRun,
    skipDelete,
    verifyOnly,
    tables: [],
  };

  try {
    const sourceTables = getSourceTables(sqlite);
    const mysqlTables = await getMysqlTables(prisma);

    if (!dryRun && !verifyOnly) {
      await ensureMySqlTableAdjustments(prisma);
    }

    if (sourceTables.includes('checkin_history') && !mysqlTables.has('checkin_history')) {
      log('Ensuring MySQL checkin_history exists...');
      if (!dryRun && !verifyOnly) {
        await ensureCheckinHistoryTable(prisma);
      }
      mysqlTables.add('checkin_history');
    }

    const tablesToImport = sortTablesForImport(sourceTables.filter((table) => mysqlTables.has(table)));
    const sourceOnlyTables = sourceTables.filter((table) => !mysqlTables.has(table));

    if (sourceOnlyTables.length > 0) {
      log(`Skipping source-only tables: ${sourceOnlyTables.join(', ')}`);
      for (const table of sourceOnlyTables) {
        report.tables.push({
          table,
          sourceCount: sqlite.prepare(`SELECT COUNT(*) AS count FROM ${escapeIdentifier(table)}`).get().count,
          targetCount: 0,
          imported: 0,
          skipped: true,
          reason: 'target table missing',
        });
      }
    }

    log(`Tables selected for import: ${tablesToImport.join(', ')}`);

    if (!skipDelete && !dryRun && !verifyOnly) {
      log('Clearing target tables before import...');
      await deleteTargetRows(prisma, [...tablesToImport].reverse());
    }

    for (const table of tablesToImport) {
      const result = await importTable(prisma, sqlite, table);
      report.tables.push(result);
      log(`${table}: source=${result.sourceCount} imported=${result.imported}${result.skipped ? ` skipped=${result.reason}` : ''}`);
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Migration report written to ${reportPath}`);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[migrate-sqlite-to-mysql] failed:', error);
  process.exit(1);
});

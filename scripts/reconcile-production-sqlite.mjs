import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationNames = [
  '20260714132000_schema_parity',
  '20260714133000_promo_reward_idempotency',
  '20260714192000_promo_claim_sequences',
  '20260715040000_marketplace_listing_integrity',
];

const requiredAuditColumns = new Map([
  ['method', 'TEXT'],
  ['endpoint', 'TEXT'],
  ['user_agent', 'TEXT'],
  ['session_id', 'TEXT'],
]);

const schemaSql = `
  CREATE TABLE IF NOT EXISTS "ServerFavorite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerFavorite_server_id_fkey"
      FOREIGN KEY ("server_id") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerFavorite_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "user_id" INTEGER,
    "permissions" TEXT DEFAULT '[]',
    "expires_at" DATETIME,
    "last_used_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS "ServerFavorite_server_id_idx" ON "ServerFavorite"("server_id");
  CREATE INDEX IF NOT EXISTS "ServerFavorite_user_id_idx" ON "ServerFavorite"("user_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "ServerFavorite_server_id_user_id_key"
    ON "ServerFavorite"("server_id", "user_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_key_hash_key" ON "ApiKey"("key_hash");
  CREATE INDEX IF NOT EXISTS "ApiKey_key_hash_idx" ON "ApiKey"("key_hash");
  CREATE INDEX IF NOT EXISTS "ApiKey_user_id_idx" ON "ApiKey"("user_id");
  CREATE INDEX IF NOT EXISTS "AuditLog_rechecked_at_idx" ON "AuditLog"("rechecked_at");
  CREATE INDEX IF NOT EXISTS "AuditLog_recheck_status_idx" ON "AuditLog"("recheck_status");
  CREATE INDEX IF NOT EXISTS "AuditLog_ip_address_idx" ON "AuditLog"("ip_address");
  CREATE UNIQUE INDEX IF NOT EXISTS "PromoWalletTransaction_ref_type_ref_id_key"
    ON "PromoWalletTransaction"("ref_type", "ref_id");
`;

function migrationChecksum(name) {
  const sqlPath = path.join(repoRoot, 'prisma', 'migrations', name, 'migration.sql');
  const sql = readFileSync(sqlPath);
  return createHash('sha256').update(sql).digest('hex');
}

function assertNoDuplicateRewards(db) {
  const duplicate = db.prepare(`
    SELECT "ref_type", "ref_id", COUNT(*) AS "count"
    FROM "PromoWalletTransaction"
    GROUP BY "ref_type", "ref_id"
    HAVING COUNT(*) > 1
    LIMIT 1
  `).get();

  if (duplicate) {
    throw new Error('PromoWalletTransaction contains duplicate reward references; reconcile aborted');
  }
}

function addAuditColumns(db) {
  const rows = db.prepare('PRAGMA table_info("AuditLog")').all();
  const existing = new Set(rows.map(({ name }) => name));
  const added = [];

  for (const [name, type] of requiredAuditColumns) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE "AuditLog" ADD COLUMN "${name}" ${type}`);
    added.push(name);
  }

  return added;
}

function tableColumns(db, tableName) {
  const rows = db.prepare(`PRAGMA table_info("${tableName}")`).all();
  if (rows.length === 0) {
    throw new Error(`${tableName} is missing; reconcile aborted`);
  }
  return new Set(rows.map(({ name }) => name));
}

function addColumn(db, tableName, columnName, definition) {
  const columns = tableColumns(db, tableName);
  if (columns.has(columnName)) return false;

  db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
  return true;
}

function assertNoDuplicatePromoClaims(db) {
  const duplicateClaimNumber = db.prepare(`
    SELECT "user_id", "task_id", "claim_no", COUNT(*) AS "count"
    FROM "PromoClaimRecord"
    GROUP BY "user_id", "task_id", "claim_no"
    HAVING COUNT(*) > 1
    LIMIT 1
  `).get();
  if (duplicateClaimNumber) {
    throw new Error('PromoClaimRecord contains duplicate claim numbers; reconcile aborted');
  }

  const duplicateIdempotencyKey = db.prepare(`
    SELECT "user_id", "task_id", "idempotency_key", COUNT(*) AS "count"
    FROM "PromoClaimRecord"
    GROUP BY "user_id", "task_id", "idempotency_key"
    HAVING COUNT(*) > 1
    LIMIT 1
  `).get();
  if (duplicateIdempotencyKey) {
    throw new Error('PromoClaimRecord contains duplicate idempotency keys; reconcile aborted');
  }
}

function reconcilePromoClaimSequences(db) {
  addColumn(db, 'PromoClaimRecord', 'claim_no', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'PromoClaimRecord', 'idempotency_key', "TEXT NOT NULL DEFAULT ''");
  db.exec(`
    UPDATE "PromoClaimRecord"
    SET "idempotency_key" = "claim_request_no"
    WHERE "idempotency_key" IS NULL OR "idempotency_key" = '';
  `);
  assertNoDuplicatePromoClaims(db);

  // The old index limits a user to one claim and conflicts with claim_no.
  db.exec(`
    DROP INDEX IF EXISTS "PromoClaimRecord_user_id_task_id_key";
    CREATE UNIQUE INDEX IF NOT EXISTS "PromoClaimRecord_user_id_task_id_claim_no_key"
      ON "PromoClaimRecord"("user_id", "task_id", "claim_no");
    CREATE UNIQUE INDEX IF NOT EXISTS "PromoClaimRecord_user_id_task_id_idempotency_key_key"
      ON "PromoClaimRecord"("user_id", "task_id", "idempotency_key");
  `);
}

function reconcileMarketplaceListingIntegrity(db) {
  addColumn(db, 'MarketplaceProduct', 'is_published', 'BOOLEAN NOT NULL DEFAULT true');
  tableColumns(db, 'MarketplaceReview');
  db.exec(`
    DELETE FROM "MarketplaceReview"
    WHERE "user_id" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "MarketplaceReview" AS "newer"
        WHERE "newer"."product_id" = "MarketplaceReview"."product_id"
          AND "newer"."user_id" = "MarketplaceReview"."user_id"
          AND (
            "newer"."updated_at" > "MarketplaceReview"."updated_at"
            OR (
              "newer"."updated_at" = "MarketplaceReview"."updated_at"
              AND "newer"."created_at" > "MarketplaceReview"."created_at"
            )
            OR (
              "newer"."updated_at" = "MarketplaceReview"."updated_at"
              AND "newer"."created_at" = "MarketplaceReview"."created_at"
              AND "newer"."id" > "MarketplaceReview"."id"
            )
          )
      );

    UPDATE "MarketplaceProduct"
    SET
      "review_count" = (
        SELECT COUNT(*)
        FROM "MarketplaceReview"
        WHERE "MarketplaceReview"."product_id" = "MarketplaceProduct"."id"
      ),
      "rating" = COALESCE((
        SELECT ROUND(AVG("rating"), 2)
        FROM "MarketplaceReview"
        WHERE "MarketplaceReview"."product_id" = "MarketplaceProduct"."id"
      ), 0);

    CREATE INDEX IF NOT EXISTS "MarketplaceProduct_is_published_idx"
      ON "MarketplaceProduct"("is_published");
    CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceReview_product_id_user_id_key"
      ON "MarketplaceReview"("product_id", "user_id");
  `);
}

function retireUnfinishedMigration(db, name, now) {
  return db.prepare(`
    UPDATE "_prisma_migrations"
    SET "rolled_back_at" = ?
    WHERE "migration_name" = ?
      AND "finished_at" IS NULL
      AND "rolled_back_at" IS NULL
  `).run(now, name).changes > 0;
}

function markMigrationApplied(db, name, now) {
  retireUnfinishedMigration(db, name, now);
  const applied = db.prepare(`
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = ?
      AND "finished_at" IS NOT NULL
      AND "rolled_back_at" IS NULL
    LIMIT 1
  `).get(name);

  if (applied) return false;

  db.prepare(`
    INSERT INTO "_prisma_migrations" (
      "id", "checksum", "finished_at", "migration_name", "logs",
      "rolled_back_at", "started_at", "applied_steps_count"
    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
  `).run(randomUUID(), migrationChecksum(name), now, name, now);
  return true;
}

export function reconcileProductionSqlite(db) {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000; BEGIN IMMEDIATE;');
  try {
    assertNoDuplicateRewards(db);
    const addedAuditColumns = addAuditColumns(db);
    db.exec(schemaSql);
    reconcilePromoClaimSequences(db);
    reconcileMarketplaceListingIntegrity(db);

    const now = new Date().toISOString();
    const markedMigrations = migrationNames.filter((name) => markMigrationApplied(db, name, now));
    db.exec('COMMIT;');
    return { addedAuditColumns, markedMigrations };
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

function main() {
  const dbPath = process.argv[2];
  if (!dbPath) {
    throw new Error('Usage: node scripts/reconcile-production-sqlite.mjs <database-path>');
  }
  if (!existsSync(dbPath) || !statSync(dbPath).isFile()) {
    throw new Error(`SQLite database does not exist: ${dbPath}`);
  }

  const db = new DatabaseSync(path.resolve(dbPath));
  try {
    const summary = reconcileProductionSqlite(db);
    const check = db.prepare('PRAGMA quick_check').get();
    if (check?.quick_check !== 'ok') {
      throw new Error(`SQLite quick_check failed: ${JSON.stringify(check)}`);
    }
    console.log(JSON.stringify({ ok: true, ...summary }));
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

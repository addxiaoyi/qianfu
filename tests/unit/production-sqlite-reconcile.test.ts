import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const dbPath = resolve(process.cwd(), `.runtime/reconcile-${randomUUID()}.db`);
const reconcileScript = resolve(process.cwd(), 'scripts/reconcile-production-sqlite.mjs');

const runReconcile = () => {
  execFileSync(process.execPath, [reconcileScript, dbPath], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
};

describe('production SQLite reconcile', () => {
  beforeEach(() => {
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE "User" ("id" INTEGER PRIMARY KEY);
      CREATE TABLE "Server" ("id" INTEGER PRIMARY KEY);
      CREATE TABLE "AuditLog" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER,
        "action" TEXT NOT NULL,
        "ip_address" TEXT,
        "rechecked_at" DATETIME,
        "recheck_status" TEXT,
        "rechecked_by" INTEGER,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE "PromoWalletTransaction" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL,
        "change_amount" INTEGER NOT NULL,
        "direction" TEXT NOT NULL,
        "change_type" TEXT NOT NULL,
        "ref_type" TEXT NOT NULL,
        "ref_id" INTEGER NOT NULL,
        "before_balance" INTEGER NOT NULL,
        "after_balance" INTEGER NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX "PromoWalletTransaction_ref_type_ref_id_idx"
        ON "PromoWalletTransaction"("ref_type", "ref_id");
      CREATE TABLE "MarketplaceProduct" (
        "id" TEXT PRIMARY KEY,
        "rating" REAL NOT NULL DEFAULT 0,
        "review_count" INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE "MarketplaceReview" (
        "id" TEXT PRIMARY KEY,
        "product_id" TEXT NOT NULL,
        "user_id" INTEGER,
        "rating" INTEGER NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO "MarketplaceReview" (
        "id", "product_id", "user_id", "rating", "created_at", "updated_at"
      ) VALUES
        ('legacy-review', 'legacy-product', 1, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('current-review', 'legacy-product', 1, 5, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z'),
        ('anonymous-review', 'legacy-product', NULL, 3, '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z');
      CREATE TABLE "PromoClaimRecord" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "task_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "claim_request_no" TEXT NOT NULL
      );
      CREATE UNIQUE INDEX "PromoClaimRecord_user_id_task_id_key"
        ON "PromoClaimRecord"("user_id", "task_id");
      INSERT INTO "MarketplaceProduct" ("id") VALUES ('legacy-product');
      INSERT INTO "PromoClaimRecord" ("task_id", "user_id", "claim_request_no")
        VALUES (1, 1, 'legacy-claim');
      CREATE TABLE "checkin_history" ("id" INTEGER PRIMARY KEY, "note" TEXT NOT NULL);
      CREATE INDEX "checkin_history_note_idx" ON "checkin_history"("note");
      INSERT INTO "checkin_history" ("id", "note") VALUES (1, 'keep-me');
      CREATE TABLE "_prisma_migrations" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
      );
      INSERT INTO "_prisma_migrations" (
        "id", "checksum", "migration_name", "logs", "started_at", "applied_steps_count"
      ) VALUES (
        'failed-schema-parity', 'stale-checksum', '20260714132000_schema_parity',
        'duplicate column name: recheck_status', current_timestamp, 0
      );
    `);
    db.close();
  });

  afterEach(() => {
    rmSync(dbPath, { force: true });
  });

  it('adds only the required production structures and is idempotent', () => {
    runReconcile();
    runReconcile();

    const db = new DatabaseSync(dbPath, { readOnly: true });
    const auditColumns = db.prepare('PRAGMA table_info("AuditLog")').all() as Array<{ name: string }>;
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
    const migrationRows = db.prepare(`
      SELECT migration_name, COUNT(*) AS count
      FROM "_prisma_migrations"
      WHERE migration_name IN (?, ?, ?, ?)
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL
      GROUP BY migration_name
      ORDER BY migration_name
    `).all(
      '20260714132000_schema_parity',
      '20260714133000_promo_reward_idempotency',
      '20260714192000_promo_claim_sequences',
      '20260715040000_marketplace_listing_integrity',
    ) as Array<{
      migration_name: string;
      count: number;
    }>;
    const failedSchemaParityRows = db.prepare(`
      SELECT COUNT(*) AS count
      FROM "_prisma_migrations"
      WHERE "migration_name" = '20260714132000_schema_parity'
        AND "finished_at" IS NULL
        AND "rolled_back_at" IS NULL
    `).get() as { count: number };
    const marketplaceColumns = db.prepare('PRAGMA table_info("MarketplaceProduct")').all() as Array<{ name: string }>;
    const promoClaimColumns = db.prepare('PRAGMA table_info("PromoClaimRecord")').all() as Array<{ name: string }>;
    const promoClaim = db.prepare(`
      SELECT "claim_no", "idempotency_key"
      FROM "PromoClaimRecord"
      WHERE "claim_request_no" = 'legacy-claim'
    `).get() as { claim_no: number; idempotency_key: string };
    const product = db.prepare(`
      SELECT "rating", "review_count"
      FROM "MarketplaceProduct"
      WHERE "id" = 'legacy-product'
    `).get() as { rating: number; review_count: number };
    const reviewIds = db.prepare(`
      SELECT "id"
      FROM "MarketplaceReview"
      WHERE "product_id" = 'legacy-product'
      ORDER BY "id"
    `).all() as Array<{ id: string }>;
    const sentinel = db.prepare('SELECT note FROM "checkin_history" WHERE id = 1').get() as { note: string };
    db.close();

    expect(auditColumns.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'method',
      'endpoint',
      'user_agent',
      'session_id',
    ]));
    expect(tables.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'ServerFavorite',
      'ApiKey',
      'checkin_history',
    ]));
    expect(indexes.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'ServerFavorite_server_id_user_id_key',
      'ApiKey_key_hash_key',
      'PromoWalletTransaction_ref_type_ref_id_key',
      'PromoWalletTransaction_ref_type_ref_id_idx',
      'MarketplaceProduct_is_published_idx',
      'MarketplaceReview_product_id_user_id_key',
      'PromoClaimRecord_user_id_task_id_claim_no_key',
      'PromoClaimRecord_user_id_task_id_idempotency_key_key',
      'checkin_history_note_idx',
    ]));
    expect(indexes.map(({ name }) => name)).not.toContain('PromoClaimRecord_user_id_task_id_key');
    expect(migrationRows).toEqual([
      { migration_name: '20260714132000_schema_parity', count: 1 },
      { migration_name: '20260714133000_promo_reward_idempotency', count: 1 },
      { migration_name: '20260714192000_promo_claim_sequences', count: 1 },
      { migration_name: '20260715040000_marketplace_listing_integrity', count: 1 },
    ]);
    expect(failedSchemaParityRows.count).toBe(0);
    expect(marketplaceColumns.map(({ name }) => name)).toContain('is_published');
    expect(promoClaimColumns.map(({ name }) => name)).toEqual(expect.arrayContaining(['claim_no', 'idempotency_key']));
    expect(promoClaim).toEqual({ claim_no: 1, idempotency_key: 'legacy-claim' });
    expect(product).toEqual({ rating: 4, review_count: 2 });
    expect(reviewIds).toEqual([{ id: 'anonymous-review' }, { id: 'current-review' }]);
    expect(sentinel.note).toBe('keep-me');
  }, 30_000);
});

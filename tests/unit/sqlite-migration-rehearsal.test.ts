import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDirectories: string[] = [];
const migrationRoot = path.join(process.cwd(), 'prisma/migrations');
const normalizationMigration = readFileSync(
  path.join(migrationRoot, '20260731050000_checkin_and_server_facets/migration.sql'),
  'utf8',
);
const reconciliationMigration = readFileSync(
  path.join(migrationRoot, '20260731080000_checkin_history_fk_reconciliation/migration.sql'),
  'utf8',
);
const personalFilingAnnouncementMigration = readFileSync(
  path.join(migrationRoot, '20260812130000_personal_filing_announcement_cleanup/migration.sql'),
  'utf8',
);

function createLegacyDatabase(): DatabaseSync {
  const directory = mkdtempSync(path.join(tmpdir(), 'qianfu-migration-'));
  tempDirectories.push(directory);
  const database = new DatabaseSync(path.join(directory, 'legacy.db'));
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE "User" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "email" TEXT NOT NULL
    );

    CREATE TABLE "Server" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "owner_id" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "tags" TEXT,
      "supported_versions" TEXT,
      "network_env" TEXT
    );

    CREATE TABLE "checkin_history" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "user_id" INTEGER NOT NULL,
      "checkin_date" TEXT NOT NULL,
      "timezone" TEXT,
      "base_reward" REAL NOT NULL,
      "bonus_reward" REAL NOT NULL DEFAULT 0,
      "total_reward" REAL NOT NULL,
      "streak_days" INTEGER NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("user_id", "checkin_date")
    );

    CREATE TABLE "SystemConfig" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "description" TEXT
    );

    INSERT INTO "User" ("id", "email") VALUES (1, 'migration@example.invalid');
    INSERT INTO "Server" (
      "id", "owner_id", "name", "tags", "supported_versions", "network_env"
    ) VALUES
      (1, 1, 'Legacy Valid', '["PVP", " pvp ", "Modded"]', '["1.20.1", "1.21"]', '["Java", "Velocity"]'),
      (2, 1, 'Legacy Invalid', 'not-json', '["1.19"]', NULL);

    INSERT INTO "checkin_history" (
      "id", "user_id", "checkin_date", "timezone", "base_reward",
      "bonus_reward", "total_reward", "streak_days"
    ) VALUES
      (1, 1, '2026-07-30', 'Asia/Tokyo', 0.10, 0.05, 0.15, 3),
      (2, 999, '2026-07-30', 'UTC', 0.10, 0, 0.10, 1);

    INSERT INTO "SystemConfig" ("key", "value", "description") VALUES
      ('PUBLIC_ANNOUNCEMENT:legacy', '{"status":"PUBLISHED","message":"支持支付、充值和推广交易","updatedAt":"2026-01-01T00:00:00.000Z"}', 'legacy'),
      ('PUBLIC_ANNOUNCEMENT:clean', '{"status":"PUBLISHED","message":"服务器展示和新闻","updatedAt":"2026-01-01T00:00:00.000Z"}', 'current');
  `);
  return database;
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    rmSync(tempDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('SQLite migration rehearsal', () => {
  it('upgrades a runtime-created check-in table without mutating an applied migration', () => {
    const database = createLegacyDatabase();

    try {
      database.exec(normalizationMigration);
      expect(database.prepare('PRAGMA foreign_key_list(checkin_history)').all()).toHaveLength(0);

      database.exec(reconciliationMigration);

      const foreignKeys = database.prepare('PRAGMA foreign_key_list(checkin_history)').all() as Array<{
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>;
      expect(foreignKeys).toEqual(expect.arrayContaining([
        expect.objectContaining({
          table: 'User',
          from: 'user_id',
          to: 'id',
          on_delete: 'CASCADE',
        }),
      ]));

      expect(database.prepare(
        'SELECT user_id, checkin_date, total_reward, streak_days FROM checkin_history ORDER BY id',
      ).all()).toEqual([
        expect.objectContaining({
          user_id: 1,
          checkin_date: '2026-07-30',
          total_reward: 0.15,
          streak_days: 3,
        }),
      ]);

      const facets = database.prepare(`
        SELECT s.name, f.kind, f.value, f.normalized_value
        FROM server_facets f
        JOIN "Server" s ON s.id = f.server_id
        ORDER BY s.name, f.kind, f.normalized_value
      `).all();
      expect(facets).toHaveLength(7);
      expect(facets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'Legacy Valid',
          kind: 'TAG',
          value: 'PVP',
          normalized_value: 'pvp',
        }),
        expect.objectContaining({
          name: 'Legacy Invalid',
          kind: 'VERSION',
          normalized_value: '1.19',
        }),
      ]));

      database.exec(normalizationMigration);
      database.exec(reconciliationMigration);
      expect(database.prepare('SELECT COUNT(*) AS count FROM server_facets').get()).toEqual({ count: 7 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM checkin_history').get()).toEqual({ count: 1 });

      database.prepare('DELETE FROM "User" WHERE id = 1').run();
      expect(database.prepare('SELECT COUNT(*) AS count FROM checkin_history').get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  }, 20_000);

  it('repairs commercial announcement copy with SQLite-compatible SQL', () => {
    const database = createLegacyDatabase();

    try {
      database.exec(personalFilingAnnouncementMigration);

      const repaired = database.prepare(
        'SELECT value, description FROM "SystemConfig" WHERE key = ?',
      ).get('PUBLIC_ANNOUNCEMENT:legacy') as { value: string; description: string };
      const untouched = database.prepare(
        'SELECT value, description FROM "SystemConfig" WHERE key = ?',
      ).get('PUBLIC_ANNOUNCEMENT:clean') as { value: string; description: string };

      expect(JSON.parse(repaired.value)).toMatchObject({
        status: 'PUBLISHED',
        message: '平台现已切换为个人备案模式，提供服务器展示、资料发布、新闻和工单支持；不提供支付、钱包、商城或推广交易服务。',
      });
      expect(repaired.description).toContain('个人备案模式');
      expect(JSON.parse(untouched.value).message).toBe('服务器展示和新闻');
      expect(untouched.description).toBe('current');
    } finally {
      database.close();
    }
  });
});

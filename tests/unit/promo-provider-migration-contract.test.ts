import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDir = resolve(
  process.cwd(),
  'prisma/migrations/20260724050000_promo_video_tier_settlement',
);

const read = (name: string) => readFileSync(resolve(migrationDir, name), 'utf8');
const mysql = read('migration.mysql.sql');
const postgresql = read('migration.postgresql.sql');

const requiredTokens = [
  'PromoMetricSnapshot',
  'PromoRewardSettlement',
  'platform_video_id',
  'settlement_status',
  'highest_rewarded_tier',
  'total_rewarded_amount',
  'PromoClaimRecord_task_id_platform_video_id_key',
  'PromoRewardSettlement_claim_id_tier_key_key',
  'ON DELETE CASCADE',
];

const destructivePattern = /\b(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE|RENAME\s+TABLE)\b/i;

describe('popular video provider migration SQL', () => {
  it.each([
    ['MySQL', mysql],
    ['PostgreSQL', postgresql],
  ])('%s contains the complete additive contract', (_provider, sql) => {
    for (const token of requiredTokens) expect(sql).toContain(token);
    expect(sql).not.toMatch(destructivePattern);
    expect((sql.match(/CREATE TABLE/g) ?? []).length).toBe(2);
    expect((sql.match(/ADD CONSTRAINT/g) ?? []).length).toBe(2);
  });

  it('keeps provider-specific quoting and column types', () => {
    expect(mysql).toContain('ALTER TABLE `PromoClaimRecord`');
    expect(mysql).toContain('`video_url` TEXT NULL');
    expect(mysql).toContain('`raw_summary` LONGTEXT NULL');
    expect(postgresql).toContain('ALTER TABLE "PromoClaimRecord"');
    expect(postgresql).toContain('"video_url" TEXT');
    expect(postgresql).toContain('"id" SERIAL NOT NULL');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDir = resolve(
  process.cwd(),
  'prisma/migrations/20260804114500_marketplace_evidence_closure',
);
const read = (name: string) => readFileSync(resolve(migrationDir, name), 'utf8');
const sqlite = read('migration.sql');
const mysql = read('migration.mysql.sql');
const postgresql = read('migration.postgresql.sql');
const providers = [
  ['SQLite', sqlite],
  ['MySQL', mysql],
  ['PostgreSQL', postgresql],
] as const;
const requiredTables = [
  'MarketplaceProductVersion',
  'MarketplaceOrderEvidence',
  'MarketplaceDeliveryEvidence',
  'MarketplaceAppeal',
];
const destructivePattern = /\b(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM|RENAME\s+TABLE)\b/i;

describe('marketplace evidence provider migration', () => {
  it.each(providers)('%s creates every marketplace closure table additively', (_provider, sql) => {
    for (const table of requiredTables) expect(sql).toContain(table);
    expect(sql).not.toMatch(destructivePattern);
    expect((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length).toBe(4);
  });

  it('keeps the PostgreSQL contract, foreign keys, indexes and pending-appeal uniqueness', () => {
    expect(postgresql).toContain('TIMESTAMP(3)');
    expect(postgresql).toContain('MarketplaceProductVersion_product_id_fkey');
    expect(postgresql).toContain('MarketplaceOrderEvidence_order_id_fkey');
    expect(postgresql).toContain('MarketplaceDeliveryEvidence_order_id_fkey');
    expect(postgresql).toContain('MarketplaceAppeal_appellant_id_fkey');
    expect(postgresql).toContain('MarketplaceAppeal_reviewer_id_fkey');
    expect(postgresql).toContain('MarketplaceAppeal_pending_target_key');
    expect(postgresql).toContain("WHERE \"status\" = 'PENDING'");
  });

  it('uses provider-specific identifier and text types', () => {
    expect(sqlite).toContain('DATETIME');
    expect(mysql).toContain('`MarketplaceProductVersion`');
    expect(mysql).toContain('LONGTEXT');
    expect(mysql).toContain('DATETIME(3)');
    expect(postgresql).toContain('"MarketplaceProductVersion"');
    expect(postgresql).toContain('TEXT NOT NULL');
  });
});

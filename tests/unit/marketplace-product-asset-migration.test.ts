import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDir = resolve(
  process.cwd(),
  'prisma/migrations/20260808120000_marketplace_product_asset_columns',
);

const readMigration = (name: string) => readFileSync(resolve(migrationDir, name), 'utf8');

describe('marketplace product asset migration', () => {
  it.each(['migration.sql', 'migration.mysql.sql', 'migration.postgresql.sql'])(
    'adds asset metadata to MarketplaceProduct in %s',
    (name) => {
      const migration = readMigration(name);

      expect(migration).toContain('MarketplaceProduct');
      expect(migration).toMatch(/ALTER TABLE[^\n]*MarketplaceProduct[^\n]*ADD COLUMN[^\n]*file_sha256/i);
      expect(migration).toMatch(/ALTER TABLE[^\n]*MarketplaceProduct[^\n]*ADD COLUMN[^\n]*asset_size/i);
      expect(migration).toMatch(/ALTER TABLE[^\n]*MarketplaceProduct[^\n]*ADD COLUMN[^\n]*asset_mime/i);
      expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM|RENAME\s+TABLE/i);
    },
  );
});

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const schemaFiles = [
  'prisma/schema.prisma',
  'prisma/schema.mysql.prisma',
  'prisma/schema.postgresql.prisma',
];
const migrations = readdirSync(resolve(root, 'prisma/migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => readFileSync(resolve(root, 'prisma/migrations', entry.name, 'migration.sql'), 'utf8'))
  .join('\n');

describe('marketplace shop persistence schema', () => {
  it.each(schemaFiles)('%s stores one current shop per seller', (file) => {
    const schema = readFileSync(resolve(root, file), 'utf8');

    expect(schema).toContain('model MarketplaceShop {');
    expect(schema).toMatch(/owner_id\s+Int\s+@id/);
    expect(schema).toMatch(/announcement_click_count\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/featured_click_count\s+Int\s+@default\(0\)/);
  });

  it.each(schemaFiles)('%s keeps verification separate from seller suspension', (file) => {
    const schema = readFileSync(resolve(root, file), 'utf8');

    expect(schema).toContain('marketplace_verification_status');
    expect(schema).toContain('marketplace_verification_submitted_at');
    expect(schema).toContain('marketplace_verification_reviewed_at');
    expect(schema).toContain('marketplace_verification_reviewed_by');
    expect(schema).toContain('marketplace_verification_note');
    expect(schema).toContain('marketplace_verification_expires_at');
    expect(schema).toContain('@@index([marketplace_verification_status])');
  });

  it('deploys the shop table and verification audit fields through a migration', () => {
    expect(migrations).toContain('CREATE TABLE "MarketplaceShop"');
    expect(migrations).toContain('marketplace_verification_status');
    expect(migrations).toContain('marketplace_verification_reviewed_by');
  });
});

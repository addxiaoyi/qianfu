import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const suffix = randomUUID();
const dbName = `test-migration-${suffix}.db`;
const dbPath = resolve(process.cwd(), `prisma/${dbName}`);
const schemaPath = resolve(process.cwd(), `prisma/test-migration-${suffix}.prisma`);
const prismaCli = resolve(process.cwd(), 'node_modules/prisma/build/index.js');

describe('Prisma migration parity', () => {
  beforeAll(() => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const isolatedSchema = schema.replace(
      'url      = "file:./dev.db"',
      `url      = "file:./${dbName}"`,
    );
    writeFileSync(schemaPath, isolatedSchema, 'utf8');
    new DatabaseSync(dbPath).close();

    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', `--schema=${schemaPath}`], {
      cwd: resolve(process.cwd()),
      env: process.env,
      stdio: 'pipe',
    });
  }, 60_000);

  afterAll(() => {
    rmSync(schemaPath, { force: true });
    rmSync(dbPath, { force: true });
  });

  it('rebuilds every AuditLog column required by the Prisma schema', () => {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const columns = db.prepare('PRAGMA table_info("AuditLog")').all() as Array<{ name: string }>;
    db.close();

    expect(columns.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'method',
      'endpoint',
      'user_agent',
      'session_id',
      'rechecked_at',
      'recheck_status',
      'rechecked_by',
      'hash',
      'previous_hash',
    ]));
  });

  it('keeps marketplace product commerce fields in the deployed schema', () => {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const columns = db.prepare('PRAGMA table_info("MarketplaceProduct")').all() as Array<{ name: string }>;
    db.close();

    expect(columns.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'currency',
      'tax_included',
      'additional_fees',
      'validity_text',
      'delivery_method',
      'delivery_eta',
      'compatibility',
      'is_platform_operated',
      'seller_identity',
      'after_sales_contact',
      'refund_terms',
      'ip_source',
      'prohibited_use',
      'risk_notice',
      'product_version',
    ]));
  });
});

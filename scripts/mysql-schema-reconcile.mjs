#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const prismaCli = resolve(ROOT, 'node_modules/prisma/build/index.js');
const schemaPath = 'prisma/schema.mysql.prisma';
const outDir = resolve(ROOT, 'output/mysql-schema-reconcile');

const sourceUrl = process.env.MYSQL_SCHEMA_DIFF_URL || process.env.DATABASE_URL || '';
if (!sourceUrl || !sourceUrl.startsWith('mysql://')) {
  console.error('[mysql-schema-reconcile] missing mysql url. Set MYSQL_SCHEMA_DIFF_URL (or DATABASE_URL=mysql://...) first.');
  process.exit(1);
}

const maskUrl = (url) => url.replace(/(mysql:\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(outDir, { recursive: true });

const runDiff = (name, args) => {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    console.error(`[mysql-schema-reconcile] ${name} failed`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.status || 1);
  }

  const output = result.stdout || '';
  const outFile = resolve(outDir, `${ts}-${name}.sql`);
  writeFileSync(outFile, output, 'utf8');
  console.log(`[mysql-schema-reconcile] wrote ${outFile}`);
  return { outFile, bytes: Buffer.byteLength(output, 'utf8') };
};

console.log(`[mysql-schema-reconcile] target=${maskUrl(sourceUrl)}`);

const forward = runDiff('schema-to-db', [
  'migrate',
  'diff',
  '--from-schema-datamodel',
  schemaPath,
  '--to-url',
  sourceUrl,
  '--script',
]);

const reverse = runDiff('db-to-schema', [
  'migrate',
  'diff',
  '--from-url',
  sourceUrl,
  '--to-schema-datamodel',
  schemaPath,
  '--script',
]);

console.log('[mysql-schema-reconcile] summary:');
console.log(`- schema->db bytes: ${forward.bytes}`);
console.log(`- db->schema bytes: ${reverse.bytes}`);

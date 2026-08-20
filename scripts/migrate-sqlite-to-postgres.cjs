'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient: SqliteClient, Prisma: SqlitePrisma } = require('../prisma/generated/client/index.js');
const { PrismaClient: PostgresClient } = require('../prisma/generated/postgres-client/index.js');

const sqlitePath = path.resolve(process.env.SQLITE_PATH || 'prisma/dev.db');
const targetUrl = process.env.TARGET_DATABASE_URL || '';
const batchSize = Number.parseInt(process.env.MIGRATION_BATCH_SIZE || '250', 10);

if (!fs.existsSync(sqlitePath)) {
  throw new Error(`SQLite database does not exist: ${sqlitePath}`);
}
if (!targetUrl.startsWith('postgresql://') && !targetUrl.startsWith('postgres://')) {
  throw new Error('TARGET_DATABASE_URL must be a PostgreSQL connection URL.');
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
  throw new Error('MIGRATION_BATCH_SIZE must be between 1 and 5000.');
}

const sqliteUrl = `file:${sqlitePath.replace(/\\/g, '/')}`;
const source = new SqliteClient({ datasources: { db: { url: sqliteUrl } } });
const target = new PostgresClient({ datasources: { db: { url: targetUrl } } });
const models = SqlitePrisma.dmmf.datamodel.models;

const delegateName = (modelName) => modelName[0].toLowerCase() + modelName.slice(1);
const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

async function loadSource() {
  const rowsByModel = new Map();
  for (const model of models) {
    const delegate = source[delegateName(model.name)];
    if (!delegate?.findMany) throw new Error(`Missing SQLite delegate for ${model.name}.`);
    const rows = await delegate.findMany();
    rowsByModel.set(model.name, rows);
    process.stdout.write(`source ${model.name}=${rows.length}\n`);
  }
  return rowsByModel;
}

async function requireEmptyTarget(tx) {
  const occupied = [];
  for (const model of models) {
    const delegate = tx[delegateName(model.name)];
    const count = await delegate.count();
    if (count > 0) occupied.push(`${model.name}=${count}`);
  }
  if (occupied.length > 0) {
    throw new Error(`PostgreSQL target is not empty: ${occupied.join(', ')}`);
  }
}

async function insertAll(tx, rowsByModel) {
  await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');

  for (const model of models) {
    const rows = rowsByModel.get(model.name) || [];
    const delegate = tx[delegateName(model.name)];
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      await delegate.createMany({ data: rows.slice(offset, offset + batchSize) });
    }
    process.stdout.write(`target ${model.name}=${rows.length}\n`);
  }

  for (const model of models) {
    const id = model.fields.find((field) => field.isId && field.default?.name === 'autoincrement');
    if (!id) continue;
    const table = quote(model.dbName || model.name);
    const column = quote(id.dbName || id.name);
    await tx.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', '${id.dbName || id.name}'), COALESCE(MAX(${column}), 1), MAX(${column}) IS NOT NULL) FROM ${table}`,
    );
  }
}

async function verify(rowsByModel) {
  const mismatches = [];
  for (const model of models) {
    const expected = rowsByModel.get(model.name)?.length || 0;
    const actual = await target[delegateName(model.name)].count();
    if (actual !== expected) mismatches.push(`${model.name}: sqlite=${expected}, postgres=${actual}`);
  }
  if (mismatches.length > 0) {
    throw new Error(`Row count verification failed:\n${mismatches.join('\n')}`);
  }
}

async function main() {
  const rowsByModel = await loadSource();
  await target.$transaction(
    async (tx) => {
      await requireEmptyTarget(tx);
      await insertAll(tx, rowsByModel);
    },
    { maxWait: 30_000, timeout: 300_000 },
  );
  await verify(rowsByModel);
  process.stdout.write(`migration_ok=true models=${models.length}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
  });

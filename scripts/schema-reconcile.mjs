#!/usr/bin/env node
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

dotenv.config();

const ROOT = process.cwd();

const PROVIDERS = {
  mysql: {
    provider: 'mysql',
    schemaPath: 'prisma/schema.mysql.prisma',
    outputDir: 'output/mysql-schema-reconcile',
    protocols: new Set(['mysql:']),
    envNames: ['MYSQL_SCHEMA_DIFF_URL', 'DATABASE_URL'],
  },
  postgresql: {
    provider: 'postgresql',
    schemaPath: 'prisma/schema.postgresql.prisma',
    outputDir: 'output/postgresql-schema-reconcile',
    protocols: new Set(['postgresql:', 'postgres:']),
    envNames: ['POSTGRES_SCHEMA_DIFF_URL', 'POSTGRESQL_SCHEMA_DIFF_URL', 'DATABASE_URL'],
  },
};

function usage() {
  console.log(`Usage: node scripts/schema-reconcile.mjs [options]

Options:
  --provider <mysql|postgresql>  Explicit provider; otherwise inferred from URL
  --output-dir <path>            Override report/SQL output directory
  --assert-clean                 Exit 2 when live DB differs from Prisma schema
  --fail-on-destructive          Exit 3 when forward SQL contains destructive statements
  -h, --help                     Show help

Environment:
  SCHEMA_DIFF_URL, DATABASE_URL
  MYSQL_SCHEMA_DIFF_URL
  POSTGRES_SCHEMA_DIFF_URL / POSTGRESQL_SCHEMA_DIFF_URL`);
}

function normalizeProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'postgres' || normalized === 'postgresql') return 'postgresql';
  if (normalized === 'mysql') return 'mysql';
  return '';
}

function parseArgs(argv) {
  const result = {
    provider: '',
    outputDir: '',
    assertClean: false,
    failOnDestructive: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--provider' && argv[index + 1]) {
      result.provider = normalizeProvider(argv[index + 1]);
      index += 1;
    } else if (arg === '--output-dir' && argv[index + 1]) {
      result.outputDir = argv[index + 1];
      index += 1;
    } else if (arg === '--assert-clean') {
      result.assertClean = true;
    } else if (arg === '--fail-on-destructive') {
      result.failOnDestructive = true;
    } else if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }

  return result;
}

function firstConfigured(env, names) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return { name, value };
  }
  return null;
}

function parseDatabaseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    throw new Error('Schema reconciliation URL must be a valid database URL');
  }
}

function inferProviderFromUrl(raw) {
  const protocol = parseDatabaseUrl(raw).protocol.toLowerCase();
  if (protocol === 'mysql:') return 'mysql';
  if (protocol === 'postgres:' || protocol === 'postgresql:') return 'postgresql';
  throw new Error('Schema reconciliation supports only MySQL and PostgreSQL URLs');
}

function resolveConnection(env, forcedProvider) {
  const explicitProvider = normalizeProvider(forcedProvider);
  if (forcedProvider && !explicitProvider) {
    throw new Error(`Unsupported provider: ${forcedProvider}`);
  }

  if (explicitProvider) {
    const config = PROVIDERS[explicitProvider];
    const configured = firstConfigured(env, config.envNames);
    if (!configured) {
      throw new Error(`Missing ${config.envNames.join(' or ')} for ${explicitProvider} reconciliation`);
    }
    const url = parseDatabaseUrl(configured.value);
    if (!config.protocols.has(url.protocol.toLowerCase())) {
      throw new Error(`${configured.name} does not match the requested ${explicitProvider} provider`);
    }
    return { config, url: configured.value, sourceEnv: configured.name };
  }

  const generic = firstConfigured(env, ['SCHEMA_DIFF_URL', 'DATABASE_URL']);
  if (generic) {
    const provider = inferProviderFromUrl(generic.value);
    return { config: PROVIDERS[provider], url: generic.value, sourceEnv: generic.name };
  }

  const mysql = firstConfigured(env, ['MYSQL_SCHEMA_DIFF_URL']);
  const postgres = firstConfigured(env, ['POSTGRES_SCHEMA_DIFF_URL', 'POSTGRESQL_SCHEMA_DIFF_URL']);
  if (mysql && postgres) {
    throw new Error('Both MySQL and PostgreSQL reconciliation URLs are configured; pass --provider explicitly');
  }
  const configured = mysql || postgres;
  if (!configured) {
    throw new Error('Missing schema reconciliation URL');
  }
  const provider = inferProviderFromUrl(configured.value);
  return { config: PROVIDERS[provider], url: configured.value, sourceEnv: configured.name };
}

function maskDatabaseUrl(raw) {
  const url = parseDatabaseUrl(raw);
  const port = url.port ? `:${url.port}` : '';
  const database = url.pathname || '/';
  return `${url.protocol}//${url.hostname}${port}${database}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeOutput(text, databaseUrl) {
  let sanitized = String(text || '');
  if (databaseUrl) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(databaseUrl), 'g'), '[REDACTED_DATABASE_URL]');
  }
  return sanitized.replace(/\b(?:mysql|postgresql|postgres):\/\/[^\s'"`]+/gi, '[REDACTED_DATABASE_URL]');
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '')
    .trim();
}

function analyzeSql(sql, clean) {
  const normalized = stripSqlComments(sql);
  const statements = normalized
    ? normalized.split(';').map((statement) => statement.trim()).filter(Boolean)
    : [];
  const destructive = statements.filter((statement) => (
    /\bDROP\s+(?:TABLE|COLUMN|INDEX|CONSTRAINT|FOREIGN\s+KEY|TYPE|DATABASE)\b/i.test(statement)
    || /\bTRUNCATE\b/i.test(statement)
    || /\bDELETE\s+FROM\b/i.test(statement)
  ));

  return {
    clean,
    bytes: Buffer.byteLength(sql, 'utf8'),
    sha256: createHash('sha256').update(sql).digest('hex'),
    statementCount: statements.length,
    destructiveStatementCount: destructive.length,
  };
}

function runDiff({ name, args, prismaCli, schemaPath, outputDir, childEnv, databaseUrl, timestamp }) {
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'diff', ...args, '--script', '--exit-code'], {
    cwd: ROOT,
    env: childEnv,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`${name} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0 && result.status !== 2) {
    const detail = sanitizeOutput([result.stdout, result.stderr].filter(Boolean).join('\n'), databaseUrl).trim();
    throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
  }

  const sql = result.stdout || '';
  const clean = result.status === 0;
  const filePath = resolve(outputDir, `${timestamp}-${name}.sql`);
  writeFileSync(filePath, sql, 'utf8');

  return {
    name,
    file: filePath,
    schemaPath,
    ...analyzeSql(sql, clean),
  };
}

export function runSchemaReconcile({ argv = process.argv.slice(2), env = process.env, forcedProvider = '' } = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    usage();
    return 0;
  }

  const providerArg = options.provider || forcedProvider;
  const { config, url, sourceEnv } = resolveConnection(env, providerArg);
  const schemaPath = resolve(ROOT, config.schemaPath);
  if (!existsSync(schemaPath)) {
    throw new Error(`Prisma schema not found: ${config.schemaPath}`);
  }

  const prismaCli = resolve(env.PRISMA_CLI_PATH || resolve(ROOT, 'node_modules/prisma/build/index.js'));
  if (!existsSync(prismaCli)) {
    throw new Error(`Prisma CLI not found: ${prismaCli}`);
  }

  const outputDir = resolve(ROOT, options.outputDir || env.SCHEMA_RECONCILE_OUTPUT_DIR || config.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const childEnv = { ...env, DATABASE_URL: url };

  const forward = runDiff({
    name: 'db-to-schema',
    args: ['--from-schema-datasource', schemaPath, '--to-schema-datamodel', schemaPath],
    prismaCli,
    schemaPath: config.schemaPath,
    outputDir,
    childEnv,
    databaseUrl: url,
    timestamp,
  });
  const reverse = runDiff({
    name: 'schema-to-db',
    args: ['--from-schema-datamodel', schemaPath, '--to-schema-datasource', schemaPath],
    prismaCli,
    schemaPath: config.schemaPath,
    outputDir,
    childEnv,
    databaseUrl: url,
    timestamp,
  });

  const report = {
    version: 1,
    timestamp: new Date().toISOString(),
    provider: config.provider,
    schemaPath: config.schemaPath,
    connectionSource: sourceEnv,
    target: maskDatabaseUrl(url),
    clean: forward.clean,
    forward,
    reverse,
  };
  const reportPath = resolve(outputDir, `${timestamp}-report.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[schema-reconcile] provider=${config.provider}`);
  console.log(`[schema-reconcile] target=${report.target}`);
  console.log(`[schema-reconcile] forward=${forward.clean ? 'clean' : 'drift'} statements=${forward.statementCount} destructive=${forward.destructiveStatementCount}`);
  console.log(`[schema-reconcile] reverse=${reverse.clean ? 'clean' : 'drift'} statements=${reverse.statementCount} destructive=${reverse.destructiveStatementCount}`);
  console.log(`[schema-reconcile] report=${reportPath}`);

  if (options.failOnDestructive && forward.destructiveStatementCount > 0) {
    console.error('[schema-reconcile] destructive forward statements detected');
    return 3;
  }
  if (options.assertClean && !forward.clean) {
    console.error('[schema-reconcile] live database schema differs from the Prisma deployment schema');
    return 2;
  }
  return 0;
}

export function runCli(options = {}) {
  try {
    const exitCode = runSchemaReconcile(options);
    process.exitCode = exitCode;
    return exitCode;
  } catch (error) {
    const databaseUrl = process.env.SCHEMA_DIFF_URL
      || process.env.MYSQL_SCHEMA_DIFF_URL
      || process.env.POSTGRES_SCHEMA_DIFF_URL
      || process.env.POSTGRESQL_SCHEMA_DIFF_URL
      || process.env.DATABASE_URL
      || '';
    console.error(`[schema-reconcile] ${sanitizeOutput(error instanceof Error ? error.message : String(error), databaseUrl)}`);
    process.exitCode = 1;
    return 1;
  }
}

const isMain = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(fileURLToPath(import.meta.url)).href
  : false;
if (isMain) runCli();

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const tempDirectories: string[] = [];
const root = process.cwd();

function createFakePrisma(mode: 'clean' | 'drift') {
  const directory = mkdtempSync(path.join(tmpdir(), 'qianfu-schema-reconcile-'));
  tempDirectories.push(directory);
  const cliPath = path.join(directory, 'fake-prisma.cjs');
  const invocationPath = path.join(directory, 'invocations.ndjson');
  writeFileSync(cliPath, `
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_INVOCATION_PATH, JSON.stringify({ args, databaseUrl: process.env.DATABASE_URL }) + '\\n');
const forward = args.includes('--from-schema-datasource');
if (process.env.FAKE_DIFF_MODE === 'clean') {
  process.stdout.write('-- This is an empty migration.\\n');
  process.exit(0);
}
process.stdout.write(forward
  ? 'ALTER TABLE "User" DROP COLUMN "legacy_secret";\\n'
  : 'ALTER TABLE "User" ADD COLUMN "legacy_secret" TEXT;\\n');
process.exit(2);
`, 'utf8');
  return { directory, cliPath, invocationPath, mode };
}

function runScript(script: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function readOnlyReport(directory: string) {
  const reports = readdirSync(directory).filter((file) => file.endsWith('-report.json'));
  expect(reports).toHaveLength(1);
  return JSON.parse(readFileSync(path.join(directory, reports[0]), 'utf8')) as {
    provider: string;
    target: string;
    clean: boolean;
    forward: { clean: boolean; destructiveStatementCount: number; statementCount: number; file: string };
    reverse: { clean: boolean; file: string };
  };
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    rmSync(tempDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('schema reconcile security', () => {
  it('generates an auditable MySQL drift report without exposing credentials in argv or output', () => {
    const fake = createFakePrisma('drift');
    const outputDir = path.join(fake.directory, 'output');
    const secretUrl = 'mysql://release_user:super-secret-password@db.internal:3306/qianfu?sslaccept=strict';
    const result = runScript('scripts/mysql-schema-reconcile.mjs', [
      '--assert-clean',
      '--output-dir', outputDir,
    ], {
      MYSQL_SCHEMA_DIFF_URL: secretUrl,
      PRISMA_CLI_PATH: fake.cliPath,
      FAKE_INVOCATION_PATH: fake.invocationPath,
      FAKE_DIFF_MODE: fake.mode,
    });

    expect(result.status).toBe(2);
    const visibleOutput = `${result.stdout}\n${result.stderr}`;
    expect(visibleOutput).not.toContain('super-secret-password');
    expect(visibleOutput).not.toContain(secretUrl);

    const report = readOnlyReport(outputDir);
    expect(report.provider).toBe('mysql');
    expect(report.target).toBe('mysql://db.internal:3306/qianfu');
    expect(report.clean).toBe(false);
    expect(report.forward).toMatchObject({
      clean: false,
      statementCount: 1,
      destructiveStatementCount: 1,
    });
    expect(readFileSync(report.forward.file, 'utf8')).toContain('DROP COLUMN');

    const invocations = readFileSync(fake.invocationPath, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as { args: string[]; databaseUrl: string });
    expect(invocations).toHaveLength(2);
    for (const invocation of invocations) {
      expect(invocation.databaseUrl).toBe(secretUrl);
      expect(invocation.args.join(' ')).not.toContain(secretUrl);
      expect(invocation.args).not.toContain('--from-url');
      expect(invocation.args).not.toContain('--to-url');
    }
  }, 20_000);

  it('accepts a clean PostgreSQL deployment schema and supports postgres URLs', () => {
    const fake = createFakePrisma('clean');
    const outputDir = path.join(fake.directory, 'output');
    const result = runScript('scripts/postgresql-schema-reconcile.mjs', [
      '--assert-clean',
      '--output-dir', outputDir,
    ], {
      POSTGRES_SCHEMA_DIFF_URL: 'postgres://release:another-secret@postgres.internal:5432/qianfu',
      PRISMA_CLI_PATH: fake.cliPath,
      FAKE_INVOCATION_PATH: fake.invocationPath,
      FAKE_DIFF_MODE: fake.mode,
    });

    expect(result.status).toBe(0);
    const report = readOnlyReport(outputDir);
    expect(report.provider).toBe('postgresql');
    expect(report.target).toBe('postgres://postgres.internal:5432/qianfu');
    expect(report.clean).toBe(true);
    expect(report.forward).toMatchObject({ clean: true, statementCount: 0, destructiveStatementCount: 0 });
  }, 20_000);

  it('exposes provider-neutral release commands without executing migrations', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['db:schema:assert-clean']).toContain('--assert-clean');
    expect(packageJson.scripts['db:mysql:assert-clean']).toContain('mysql-schema-reconcile.mjs');
    expect(packageJson.scripts['db:postgres:assert-clean']).toContain('postgresql-schema-reconcile.mjs');
    expect(packageJson.scripts['release:staging:verify']).toContain('smoke:deploy -- --strict-ready');
    expect(packageJson.scripts['release:staging:verify']).not.toContain('migrate deploy');
    expect(packageJson.scripts['release:staging:verify']).not.toContain('db execute');
  });
});

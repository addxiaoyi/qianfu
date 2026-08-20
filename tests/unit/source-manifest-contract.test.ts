// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createSourceManifest,
  verifySourceManifest,
  writeSourceManifest,
} from '../../scripts/source-manifest.mjs';

const roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'qianfu-source-manifest-'));
  roots.push(root);
  mkdirSync(path.join(root, 'server'), { recursive: true });
  mkdirSync(path.join(root, 'scripts/__pycache__'), { recursive: true });
  mkdirSync(path.join(root, 'output'), { recursive: true });
  mkdirSync(path.join(root, 'prisma/generated/client'), { recursive: true });
  mkdirSync(path.join(root, 'prisma/migrations/20260804_contract'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), '{"name":"fixture"}\n', 'utf8');
  writeFileSync(path.join(root, 'server/index.ts'), 'export const ready = true;\n', 'utf8');
  writeFileSync(path.join(root, 'scripts/tool.mjs'), 'export const tool = true;\n', 'utf8');
  writeFileSync(path.join(root, 'scripts/__pycache__/tool.cpython-311.pyc'), 'runtime', 'utf8');
  writeFileSync(path.join(root, 'output/evidence.html'), '<html></html>\n', 'utf8');
  writeFileSync(
    path.join(root, 'prisma/schema.prisma'),
    'datasource db { provider = "sqlite" url = "file:./dev.db" }\n',
    'utf8',
  );
  writeFileSync(
    path.join(root, 'prisma/migrations/20260804_contract/migration.sql'),
    'CREATE TABLE Example (id INTEGER PRIMARY KEY);\n',
    'utf8',
  );
  writeFileSync(path.join(root, 'prisma/generated/client/index.js'), 'generated', 'utf8');
  writeFileSync(path.join(root, 'packages.tsbuildinfo'), 'runtime', 'utf8');
  writeFileSync(
    path.join(root, 'prisma/migrations/migration_lock.toml'),
    'provider = sqlite\n',
    'utf8',
  );
  writeFileSync(path.join(root, 'prisma/dev.db-wal'), 'runtime', 'utf8');
  writeFileSync(path.join(root, 'prisma/dev.db-shm'), 'runtime', 'utf8');
  writeFileSync(
    path.join(root, 'prisma/dev.db.before-reconcile-20260804.bak'),
    'runtime',
    'utf8',
  );
  writeFileSync(
    path.join(root, 'prisma/test-migration-029c8f6d-86ec-407c-a84a-e8e451598b11.prisma'),
    'runtime',
    'utf8',
  );
  writeFileSync(path.join(root, '.env'), 'SECRET=[REDACTED]', 'utf8');
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('source manifest contract', () => {
  it('hashes eligible source and detects later changes', async () => {
    const rootDir = createRoot();
    const outputFile = 'reports/source-manifest.json';

    const initial = await createSourceManifest({ rootDir });
    expect(initial.files.map((entry) => entry.path)).toEqual([
      'package.json',
      'prisma/migrations/20260804_contract/migration.sql',
      'prisma/schema.prisma',
      'scripts/tool.mjs',
      'server/index.ts',
    ]);

    await writeSourceManifest({ rootDir, outputFile });
    const passing = await verifySourceManifest({ rootDir, outputFile });
    expect(passing.ok, JSON.stringify(passing.findings)).toBe(true);

    writeFileSync(path.join(rootDir, 'server/index.ts'), 'export const ready = false;\n', 'utf8');
    const failing = await verifySourceManifest({ rootDir, outputFile });
    expect(failing.ok).toBe(false);
    expect(failing.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'manifest_root_hash_mismatch' }),
      expect.objectContaining({
        code: 'manifest_file_changed',
        target: 'server/index.ts',
      }),
    ]));
  });
});

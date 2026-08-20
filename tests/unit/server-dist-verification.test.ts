// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyServerDist } from '../../scripts/verify-server-dist.mjs';

const roots: string[] = [];

function createFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'qianfu-server-dist-'));
  roots.push(root);
  const required = [
    'server/index.js',
    'server/app.js',
    'packages/shared/src/index.js',
    'prisma/generated/client/index.js',
    'prisma/generated/local-client/index.js',
    'prisma/generated/postgres-client/index.js',
    'prisma/generated/mysql-client/index.js',
  ];

  for (const relativePath of required) {
    const file = path.join(root, relativePath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, relativePath === 'server/index.js'
      ? "import './app.js';\n"
      : 'export {};\n', 'utf8');
    if (!relativePath.startsWith('prisma/generated/')) {
      writeFileSync(`${file}.map`, '{}\n', 'utf8');
    }
  }

  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('server dist verification', () => {
  it('accepts a complete dist and rejects unresolved imports and runtime files', async () => {
    const distDir = createFixture();

    const passing = await verifyServerDist({ distDir });
    expect(passing.ok, JSON.stringify(passing.findings)).toBe(true);

    writeFileSync(path.join(distDir, 'server/index.js'), "import './missing.js';\n", 'utf8');
    writeFileSync(path.join(distDir, 'server/runtime.log'), 'secret\n', 'utf8');

    const failing = await verifyServerDist({ distDir });
    expect(failing.ok).toBe(false);
    expect(failing.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'unresolved_relative_import',
        target: 'server/index.js',
      }),
      expect.objectContaining({
        code: 'forbidden_release_file',
        target: 'server/runtime.log',
      }),
    ]));
  }, 20_000);
});

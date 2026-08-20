// @vitest-environment node

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateCompression } from '../../scripts/generate-frontend-compression.mjs';
import { verifyCompression } from '../../scripts/verify-frontend-compression.mjs';

const roots: string[] = [];

function createDist(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'qianfu-compression-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('frontend compression contract', () => {
  it('generates deterministic beneficial variants and detects corruption', async () => {
    const dist = createDist();
    const app = path.join(dist, 'app.js');
    const small = path.join(dist, 'small.css');
    writeFileSync(app, 'export const ready = true;\n'.repeat(600), 'utf8');
    writeFileSync(small, 'body{}\n', 'utf8');

    const generated = await generateCompression({ distDir: dist, minBytes: 128 });
    expect(generated.summary.generated).toBe(2);
    expect(existsSync(`${app}.br`)).toBe(true);
    expect(existsSync(`${app}.gz`)).toBe(true);
    expect(existsSync(`${small}.br`)).toBe(false);
    expect(existsSync(`${small}.gz`)).toBe(false);

    const second = await generateCompression({ distDir: dist, minBytes: 128 });
    expect(second.summary.generated).toBe(0);
    expect(second.summary.unchanged).toBe(2);

    const passing = await verifyCompression({ distDir: dist, minBytes: 128 });
    expect(passing.ok, JSON.stringify(passing.findings)).toBe(true);
    expect(passing.summary.verifiedVariants).toBe(2);

    writeFileSync(`${app}.gz`, Buffer.from('corrupted'));
    const failing = await verifyCompression({ distDir: dist, minBytes: 128 });
    expect(failing.ok).toBe(false);
    expect(failing.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'compressed_variant_mismatch',
        target: 'app.js.gz',
      }),
    ]));
  }, 20_000);
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('root package install contract', () => {
  it('does not install the unused flat-config package with legacy ESLint', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { devDependencies?: Record<string, string> };

    expect(packageJson.devDependencies).not.toHaveProperty('@eslint/js');
  });

  it('keeps editor-only Tiptap packages in the frontend project', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const rootTiptapPackages = Object.keys(packageJson.dependencies ?? {})
      .filter((name) => name.startsWith('@tiptap/'));

    expect(rootTiptapPackages).toEqual([]);
  });

  it('allows the root Zod major in the contracts workspace', () => {
    const contractsPackage = JSON.parse(
      readFileSync(resolve(process.cwd(), 'packages/contracts/package.json'), 'utf8'),
    ) as { peerDependencies?: Record<string, string> };

    expect(contractsPackage.peerDependencies?.zod).toContain('^4.0.0');
  });

  it('includes npm 10-compatible lock entries for optional WASM packages', () => {
    const packageLock = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8'),
    ) as { packages?: Record<string, unknown> };

    const packages = packageLock.packages ?? {};
    const hasLegacyWasmRuntime =
      'node_modules/@emnapi/core' in packages &&
      'node_modules/@emnapi/runtime' in packages;
    const hasSharpWasmRuntime =
      'node_modules/@img/sharp-wasm32' in packages &&
      'node_modules/@img/sharp-webcontainers-wasm32' in packages;

    expect(hasLegacyWasmRuntime || hasSharpWasmRuntime).toBe(true);
  });

  it('starts the Vite development server from the frontend workspace', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.dev).toBe('npm --prefix qianfu-liandeng run dev --');
    expect(packageJson.scripts?.['dev:open']).toBe('npm --prefix qianfu-liandeng run dev -- --open');
    expect(packageJson.scripts?.['dev:poll']).toBe(
      'cross-env VITE_USE_POLLING=1 npm --prefix qianfu-liandeng run dev --',
    );
    expect(packageJson.scripts?.['dev:stack']).toContain(
      'npm --prefix qianfu-liandeng run dev --',
    );
    expect(packageJson.scripts?.['dev:stack:open']).toContain(
      'npm --prefix qianfu-liandeng run dev -- --open',
    );
  });
});

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string): string => fs.readFileSync(file, 'utf8');

describe('frontend compression pipeline', () => {
  it('keeps compression in the deterministic post-build step', () => {
    const viteConfig = read('qianfu-liandeng/vite.config.ts');
    const packageJson = read('qianfu-liandeng/package.json');
    const deployScript = read('scripts/linux/deploy-frontend-dist.sh');

    expect(viteConfig).not.toContain('vite-plugin-compression');
    expect(viteConfig).not.toContain('viteCompression(');
    expect(packageJson).not.toContain('vite-plugin-compression');
    expect(deployScript).toContain('scripts/generate-frontend-compression.mjs');
  });
});

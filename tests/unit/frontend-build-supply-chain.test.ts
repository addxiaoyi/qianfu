import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJson = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/package.json'), 'utf8');
const viteConfig = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/vite.config.ts'), 'utf8');

describe('frontend build supply chain', () => {
  it('does not use the vulnerable vite-plugin-imagemin binary chain', () => {
    expect(packageJson).not.toContain('vite-plugin-imagemin');
    expect(viteConfig).not.toContain('vite-plugin-imagemin');
    expect(viteConfig).not.toContain('viteImagemin(');
  });

  it('self-hosts runtime dependencies instead of injecting CDN scripts', () => {
    expect(packageJson).not.toContain('vite-plugin-cdn-import');
    expect(viteConfig).not.toContain('vite-plugin-cdn-import');
    expect(viteConfig).not.toContain('cdnImport(');
    expect(viteConfig).not.toContain('cdn.jsdelivr.net');
  });
});

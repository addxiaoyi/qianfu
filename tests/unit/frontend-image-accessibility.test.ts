import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('frontend image accessibility', () => {
  it('requires an explicit alt attribute on every native image', () => {
    const output = execFileSync(process.execPath, ['scripts/audit-frontend-images.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('FRONTEND_IMAGE_FINDINGS=0');
  }, 20_000);

  it('describes public profile server images with the server name', () => {
    const page = read('qianfu-liandeng/src/pages/UserPublicProfile.tsx');

    expect(page).toContain('alt={`${getServerName(server)} 展示图`}');
  });

  it('exposes the image audit as an npm script', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['audit:frontend:images']).toBe('node scripts/audit-frontend-images.mjs');
  });
});

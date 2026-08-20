import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const listSource = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/ServerList.tsx'), 'utf8');

describe('server discovery density contract', () => {
  it('keeps the first result grid ahead of the long directory explanation', () => {
    const resultGridIndex = listSource.indexOf('aria-label="服务器列表"');
    const directoryCopyIndex = listSource.indexOf('公开索引');

    expect(resultGridIndex).toBeGreaterThan(-1);
    expect(directoryCopyIndex).toBeGreaterThan(-1);
    expect(resultGridIndex).toBeLessThan(directoryCopyIndex);
  });

  it('keeps the desktop title and header compact enough for the first result fold', () => {
    expect(listSource).toContain('lg:text-5xl');
    expect(listSource).toContain('pt-10 sm:pt-14');
    expect(listSource).toContain('mb-10');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('server directory card layout contract', () => {
  const card = read('qianfu-liandeng/src/components/business/ServerCard.tsx');
  const list = read('qianfu-liandeng/src/pages/ServerList.tsx');

  it('caps the public directory at three cards per desktop row', () => {
    expect(list).toContain('grid-cols-1');
    expect(list).toContain('sm:grid-cols-2');
    expect(list).toContain('lg:grid-cols-3');
    expect(list).not.toContain('grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]');
    expect(list).not.toContain('xl:grid-cols-4');
  });

  it('keeps card media and metadata visually compact', () => {
    expect(card).toContain('aspect-[4/3]');
    expect(card).toContain('flex h-full flex-col');
    expect(card).toContain('flex flex-1 flex-col');
    expect(card).toContain('gap-4 px-4 pb-4');
    expect(card).toContain('text-3xl');
  });
});

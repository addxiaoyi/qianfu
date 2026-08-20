import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/index.css'), 'utf8');
const serverList = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/ServerList.tsx'), 'utf8');

describe('typography defaults', () => {
  it('keeps headings sentence-case and restrained by default', () => {
    expect(css).toContain('@apply font-semibold tracking-tight text-foreground break-words;');
    expect(css).not.toContain('@apply font-black tracking-tighter text-foreground uppercase italic break-words;');
  });

  it('keeps the server discovery title below display scale', () => {
    expect(serverList).toContain('text-3xl sm:text-4xl lg:text-5xl');
    expect(serverList).not.toContain('text-5xl sm:text-6xl lg:text-7xl font-black');
  });
});

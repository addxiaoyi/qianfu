import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('team member contract', () => {
  it('does not publish removed members in the public team page', () => {
    const page = read('qianfu-liandeng/src/pages/Team.tsx');

    expect(page).not.toMatch(/name:\s*["']封神["']/);
    expect(page).not.toMatch(/name:\s*["']倔强男孩["']/);
  });

  it('copies the management QQ number from team cards', () => {
    const page = read('qianfu-liandeng/src/pages/Team.tsx');

    expect(page).toContain("navigator.clipboard.writeText(TEAM_QQ)");
    expect(page).toContain('复制 QQ 号');
    expect(page).toContain('QQ 已复制');
  });
});

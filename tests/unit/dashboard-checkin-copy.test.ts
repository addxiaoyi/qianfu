import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('dashboard check-in copy', () => {
  it('does not retain the legacy 25 XP fallback', () => {
    const sourcePath = path.resolve(process.cwd(), 'qianfu-liandeng/src/pages/Dashboard.tsx');
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).not.toContain('checkinStatus?.rewardXp ?? 25');
  });
});

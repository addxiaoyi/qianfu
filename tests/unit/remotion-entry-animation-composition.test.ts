import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/components/entry/MinecraftFlightComposition.tsx'),
  'utf8',
);

describe('Minecraft flight composition', () => {
  it('defines the approved B2 timing and local visual layers', () => {
    expect(source).toContain('durationInFrames = 72');
    expect(source).toContain('fps = 60');
    expect(source).toContain('useCurrentFrame');
    expect(source).toContain('interpolate');
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/<audio|<video/);
  });
});

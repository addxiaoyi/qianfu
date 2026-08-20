import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('qianfu-liandeng/src/components/ui/GeometricLantern.tsx', 'utf8');

describe('lantern icon contract', () => {
  it('uses a lamp instead of repeated sparkle branding', () => {
    expect(source).toContain("spark: { Icon: LampDesk, name: 'lamp-desk' }");
    expect(source).not.toContain("Icon: Sparkles");
  });
});

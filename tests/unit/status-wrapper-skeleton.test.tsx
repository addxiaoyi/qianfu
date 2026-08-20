import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const component = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/components/ui/StatusWrapper.tsx'),
  'utf8',
);

describe('StatusWrapper', () => {
  it('uses the skeleton block component instead of the default export object', () => {
    expect(component).toContain("import { SkeletonBlock } from './Skeleton';");
    expect(component).not.toContain("import Skeleton from './Skeleton';");
  });

  it('renders four card placeholders without an unsupported count prop', () => {
    expect(component).toContain('Array.from({ length: 4 }, (_, index) => (');
    expect(component).toContain('<SkeletonBlock key={index} className="h-48 rounded-[2.5rem]" />');
    expect(component).not.toContain('count={4}');
  });
});

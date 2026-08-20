import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/MarketplaceEdit.tsx'),
  'utf8',
);

describe('marketplace edit preview contract', () => {
  it('does not render an image element when no cover preview is available', () => {
    expect(source).toContain('{coverPreview ? <img src={coverPreview} alt="封面预览"');
  });
});

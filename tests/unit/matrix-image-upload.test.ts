import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = path.resolve(
  process.cwd(),
  'qianfu-liandeng/src/components/form/MatrixImageUpload.tsx',
);

describe('MatrixImageUpload upload state', () => {
  it('does not reference progress state that the component does not own', () => {
    const source = fs.readFileSync(componentPath, 'utf8');

    expect(source).not.toMatch(/uploadProgress/);
    expect(source).toContain('正在上传并同步图床');
  });
});

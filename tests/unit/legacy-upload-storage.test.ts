import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const uploadRoute = path.resolve('qianfu-liandeng/server/routes/upload.ts');

describe('legacy upload route storage', () => {
  it('uses disk-backed multipart storage instead of retaining upload buffers', () => {
    const source = fs.readFileSync(uploadRoute, 'utf8');

    expect(source).not.toContain('multer.memoryStorage()');
    expect(source).toContain('multer.diskStorage(');
    expect(source).toContain('await fs.rm');
  });
});

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveUploadDirectory } from '../../server/config/uploadStorage';

const root = process.cwd();

describe('persistent upload storage contract', () => {
  it('resolves a configured upload directory to one absolute path', () => {
    const configured = path.resolve('persistent/uploads');
    expect(resolveUploadDirectory({ UPLOAD_DIR: configured }, root)).toBe(configured);
  });

  it('uses the same directory for writes and static delivery', () => {
    const service = readFileSync(path.resolve(root, 'server/services/uploadService.ts'), 'utf8');
    const staticServer = readFileSync(path.resolve(root, 'server/bootstrap/proxyAndStatic.ts'), 'utf8');
    expect(service).toContain("from '../config/uploadStorage'");
    expect(service).toContain('private static readonly uploadsDir = UPLOADS_DIR');
    expect(staticServer).toContain("from '../config/uploadStorage'");
    expect(staticServer).toContain("express.static(UPLOADS_DIR");
  });

  it('keeps large marketplace assets on disk instead of buffering the multipart file', () => {
    const route = readFileSync(path.resolve(root, 'server/routes/upload.ts'), 'utf8');
    const service = readFileSync(path.resolve(root, 'server/services/uploadService.ts'), 'utf8');

    expect(route).toContain('processAndSaveAssetFile(tempPath');
    expect(route).toContain("if (kind !== 'asset') {\n        buffer = await fs.readFile(tempPath);\n      }");
    expect(service).toContain('static async processAndSaveAssetFile');
    expect(service).toContain('fs.promises.copyFile');
    expect(service).toContain('fs.createReadStream');
  });

  it('rejects oversized image files before reading the temporary file into memory', () => {
    const route = readFileSync(path.resolve(root, 'server/routes/upload.ts'), 'utf8');
    const sizeGuard = route.indexOf('if (req.file.size > maxSize)');
    const readFile = route.indexOf('buffer = await fs.readFile(tempPath);');

    expect(sizeGuard).toBeGreaterThanOrEqual(0);
    expect(readFile).toBeGreaterThan(sizeGuard);
  });

  it('cleans processed image files after remote image storage succeeds', () => {
    const route = readFileSync(path.resolve(root, 'server/routes/upload.ts'), 'utf8');

    expect(route).toContain("storage !== 'local'");
    expect(route).toContain('processedImagePath &&');
  });

  it('streams processed images to R2 instead of reading them into a second buffer', () => {
    const route = readFileSync(path.resolve(root, 'server/routes/upload.ts'), 'utf8');
    const r2 = readFileSync(path.resolve(root, 'server/services/r2StorageService.ts'), 'utf8');

    expect(route).toContain('uploadToR2File');
    expect(route).not.toContain('const processedBuffer = await fs.readFile(processedImagePath)');
    expect(route).not.toMatch(/uploadToR2\(processedBuffer/);
    expect(r2).toContain('createReadStream');
  });
});

import { describe, expect, it } from 'vitest';

describe('payment project upstream timeout contract', () => {
  it('routes XPay admin requests through the shared timeout helper', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('server/controllers/paymentProjectController.ts', 'utf8');
    expect(source).toContain("from '../utils/fetchWithTimeout'");
    expect(source).not.toMatch(/const (loginResponse|profileResponse|response) = await fetch\(/);
  });

  it('streams the QR file into multipart form data without creating a full Buffer copy', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('server/controllers/paymentProjectController.ts', 'utf8');
    expect(source).toContain("from 'node:fs'");
    expect(source).toContain('openAsBlob(file.path');
    expect(source).not.toContain('fs.readFile(file.path)');
  });
});

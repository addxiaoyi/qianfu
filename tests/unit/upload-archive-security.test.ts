import { describe, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { inspectArchiveBuffer } from '../../server/security/archiveInspection';
import { assertSafeImageMetadata } from '../../server/security/imageInspection';

interface ZipEntryInput {
  name: string;
  data: Buffer | string;
  compress?: boolean;
  mode?: number;
}

async function makeZip(entries: ZipEntryInput[]): Promise<Buffer> {
  const zip = new ZipFile();
  const chunks: Buffer[] = [];
  const output = zip.outputStream;
  const result = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    output.on('error', reject);
    output.on('end', () => resolve(Buffer.concat(chunks)));
  });
  for (const entry of entries) {
    zip.addBuffer(Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data), entry.name, {
      compress: entry.compress ?? true,
      mode: entry.mode,
    });
  }
  zip.end();
  return result;
}

function replaceAllSameLength(buffer: Buffer, from: string, to: string): Buffer {
  expect(Buffer.byteLength(from)).toBe(Buffer.byteLength(to));
  const output = Buffer.from(buffer);
  const needle = Buffer.from(from);
  const replacement = Buffer.from(to);
  let cursor = 0;
  let replacements = 0;
  while ((cursor = output.indexOf(needle, cursor)) >= 0) {
    replacement.copy(output, cursor);
    cursor += replacement.length;
    replacements += 1;
  }
  expect(replacements).toBeGreaterThanOrEqual(2);
  return output;
}

async function nestedZip(levels: number): Promise<Buffer> {
  if (levels <= 0) return makeZip([{ name: 'payload.txt', data: 'safe' }]);
  const child = await nestedZip(levels - 1);
  return makeZip([{ name: `level-${levels}.jar`, data: child }]);
}

describe('archive upload security', () => {
  it('accepts a bounded normal ZIP', async () => {
    const archive = await makeZip([
      { name: 'pack/readme.txt', data: 'hello' },
      { name: 'pack/data/config.json', data: '{"enabled":true}' },
    ]);
    await expect(inspectArchiveBuffer(archive)).resolves.toMatchObject({
      entryCount: 2,
      nestedArchiveCount: 0,
      maxDepth: 0,
    });
  });

  it('rejects traversal paths even when the ZIP writer originally emitted a safe path', async () => {
    const safe = await makeZip([{ name: 'aa/evil.txt', data: 'nope' }]);
    const malicious = replaceAllSameLength(safe, 'aa/evil.txt', '../evil.txt');
    await expect(inspectArchiveBuffer(malicious)).rejects.toThrow(/path|relative path|archive/i);
  });

  it('rejects case-insensitive duplicate extraction paths', async () => {
    const archive = await makeZip([
      { name: 'mods/Library.jar.txt', data: 'one' },
      { name: 'mods/library.jar.txt', data: 'two' },
    ]);
    await expect(inspectArchiveBuffer(archive)).rejects.toThrow('duplicate entry path');
  });

  it('rejects high-ratio compressed payloads', async () => {
    const archive = await makeZip([{ name: 'bomb.bin', data: Buffer.alloc(2 * 1024 * 1024), compress: true }]);
    await expect(inspectArchiveBuffer(archive)).rejects.toThrow('compression ratio exceeded');
  });

  it('rejects nested archives beyond the configured depth', async () => {
    const archive = await nestedZip(4);
    await expect(inspectArchiveBuffer(archive)).rejects.toThrow('nested archive depth exceeded');
  });

  it('rejects Unix symbolic-link entries', async () => {
    const archive = await makeZip([{ name: 'link', data: '../target', mode: 0o120777, compress: false }]);
    await expect(inspectArchiveBuffer(archive)).rejects.toThrow('symbolic links are not allowed');
  });
});

describe('image decode resource budgets', () => {
  it('rejects excessive animation frames', () => {
    expect(() => assertSafeImageMetadata({ width: 320, height: 40000, pageHeight: 200, pages: 200 }))
      .toThrow('frame limit exceeded');
  });

  it('rejects excessive total decoded pixels', () => {
    expect(() => assertSafeImageMetadata({ width: 4096, height: 4096, pageHeight: 4096, pages: 8 }))
      .toThrow('pixel budget exceeded');
  });

  it('accepts a normal static image budget', () => {
    expect(() => assertSafeImageMetadata({ width: 1920, height: 1080 })).not.toThrow();
  });
});

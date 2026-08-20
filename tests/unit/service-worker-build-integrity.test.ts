import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createServiceWorkerMetadata,
  readStampedMetadata,
  stampServiceWorker,
} from '../../scripts/stamp-service-worker-build.mjs';

const root = process.cwd();
const hash = (hexByte: string) => hexByte.repeat(64);

function createManifest() {
  const paths = [
    '/index.html',
    '/manifest.json',
    '/offline.html',
    '/logo.png',
    '/fonts/minecraft.ttf',
    '/assets/css/index.css',
    '/assets/js/index.js',
  ];
  return {
    entrypointAssets: ['/assets/css/index.css', '/assets/js/index.js'],
    files: paths.map((filePath, index) => ({
      path: filePath,
      bytes: index + 1,
      sha256: hash((index + 1).toString(16).padStart(2, '0')),
    })),
  };
}

describe('Service Worker build integrity', () => {
  it('creates deterministic build IDs and SRI metadata from the dist manifest', () => {
    const manifest = createManifest();
    const first = createServiceWorkerMetadata(manifest);
    const second = createServiceWorkerMetadata(manifest);

    expect(first).toEqual(second);
    expect(first.buildId).toMatch(/^[a-f0-9]{20}$/);
    expect(first.assets).toEqual([
      '/assets/css/index.css',
      '/assets/js/index.js',
      '/fonts/minecraft.ttf',
      '/index.html',
      '/logo.png',
      '/manifest.json',
      '/offline.html',
    ]);
    expect(first.integrity['/assets/js/index.js']).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
  });

  it('stamps and reads Service Worker metadata without duplicating prior stamps', () => {
    const metadata = createServiceWorkerMetadata(createManifest());
    const source = "const STATIC_CACHE = 'example';\n";
    const stamped = stampServiceWorker(source, metadata);
    const restamped = stampServiceWorker(stamped, metadata);

    expect(readStampedMetadata(stamped)).toEqual(metadata);
    expect(readStampedMetadata(restamped)).toEqual(metadata);
    expect(restamped.match(/QIANFU_BUILD_METADATA_START/g)).toHaveLength(1);
  });

  it('rejects precache assets that are absent from the dist manifest', () => {
    const manifest = createManifest();
    manifest.files = manifest.files.filter((item) => item.path !== '/offline.html');
    expect(() => createServiceWorkerMetadata(manifest)).toThrow(/offline\.html/);
  });

  it('keeps source Service Worker caches build-scoped and uses an existing fallback image', () => {
    const source = fs.readFileSync(
      path.join(root, 'qianfu-liandeng', 'public', 'sw.js'),
      'utf8',
    );
    expect(source).toContain('self.__QIANFU_BUILD_ID__');
    expect(source).toContain('self.__QIANFU_PRECACHE_INTEGRITY__');
    expect(source).toContain('qianfu-static-${BUILD_ID}');
    expect(source).toContain('new Request(asset');
    expect(source).toContain("caches.match('/logo.png')");
    expect(source).not.toContain('/icons/fallback-image.png');
  });
});

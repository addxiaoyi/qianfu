import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'qianfu-liandeng', 'dist');
const MANIFEST_PATH = path.join(DIST_DIR, 'qianfu-dist-manifest.json');
const SW_PATH = path.join(DIST_DIR, 'sw.js');
const START = '/* QIANFU_BUILD_METADATA_START */';
const END = '/* QIANFU_BUILD_METADATA_END */';
const BASE_PRECACHE_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/logo.png',
  '/fonts/minecraft.ttf',
];

function sha256SriFromHex(hex) {
  return `sha256-${Buffer.from(hex, 'hex').toString('base64')}`;
}

export function createServiceWorkerMetadata(manifest) {
  const files = new Map(manifest.files.map((item) => [item.path, item]));
  const assets = [...new Set([...BASE_PRECACHE_ASSETS, ...manifest.entrypointAssets])].sort();
  const missing = assets.filter((asset) => !files.has(asset));
  if (missing.length > 0) {
    throw new Error(`Service Worker precache assets missing from dist manifest: ${missing.join(', ')}`);
  }

  const integrity = Object.fromEntries(
    assets.map((asset) => [asset, sha256SriFromHex(files.get(asset).sha256)]),
  );
  const buildId = crypto
    .createHash('sha256')
    .update(assets.map((asset) => `${asset}\0${files.get(asset).sha256}\n`).join(''))
    .digest('hex')
    .slice(0, 20);

  return { buildId, assets, integrity };
}

export function stampServiceWorker(source, metadata) {
  const withoutExisting = source.replace(
    /\/\* QIANFU_BUILD_METADATA_START \*\/[\s\S]*?\/\* QIANFU_BUILD_METADATA_END \*\/\r?\n?/,
    '',
  );
  const header = [
    START,
    `self.__QIANFU_BUILD_ID__ = ${JSON.stringify(metadata.buildId)};`,
    `self.__QIANFU_PRECACHE_ASSETS__ = ${JSON.stringify(metadata.assets)};`,
    `self.__QIANFU_PRECACHE_INTEGRITY__ = ${JSON.stringify(metadata.integrity)};`,
    END,
    '',
  ].join('\n');
  return `${header}${withoutExisting}`;
}

export function readStampedMetadata(source) {
  const buildMatch = source.match(/self\.__QIANFU_BUILD_ID__\s*=\s*("[^"]+")/);
  const assetsMatch = source.match(/self\.__QIANFU_PRECACHE_ASSETS__\s*=\s*(\[[^\n]+\])/);
  const integrityMatch = source.match(/self\.__QIANFU_PRECACHE_INTEGRITY__\s*=\s*(\{[^\n]+\})/);
  if (!buildMatch || !assetsMatch || !integrityMatch) return null;
  return {
    buildId: JSON.parse(buildMatch[1]),
    assets: JSON.parse(assetsMatch[1]),
    integrity: JSON.parse(integrityMatch[1]),
  };
}

function assertSameMetadata(actual, expected) {
  if (!actual) throw new Error('Service Worker build metadata is missing');
  if (actual.buildId !== expected.buildId) {
    throw new Error(`Service Worker buildId mismatch: ${actual.buildId} !== ${expected.buildId}`);
  }
  if (JSON.stringify(actual.assets) !== JSON.stringify(expected.assets)) {
    throw new Error('Service Worker precache asset list does not match the dist manifest');
  }
  if (JSON.stringify(actual.integrity) !== JSON.stringify(expected.integrity)) {
    throw new Error('Service Worker integrity map does not match the dist manifest');
  }
}

export function main(argv = process.argv.slice(2)) {
  const checkOnly = argv.includes('--check');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const metadata = createServiceWorkerMetadata(manifest);
  const source = fs.readFileSync(SW_PATH, 'utf8');

  if (checkOnly) {
    assertSameMetadata(readStampedMetadata(source), metadata);
  } else {
    fs.writeFileSync(SW_PATH, stampServiceWorker(source, metadata), 'utf8');
  }

  console.log(JSON.stringify({
    ok: true,
    mode: checkOnly ? 'check' : 'stamp',
    buildId: metadata.buildId,
    precacheAssets: metadata.assets.length,
    serviceWorker: SW_PATH,
    manifest: MANIFEST_PATH,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

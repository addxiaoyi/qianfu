#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST_NAME = 'qianfu-dist-manifest.json';

function parseArgs(argv) {
  const options = {
    distDir: process.env.FRONTEND_DIST_DIR || 'qianfu-liandeng/dist',
    outFile: process.env.FRONTEND_DIST_MANIFEST || '',
    remoteBase: process.env.QIANFU_BASE_URL || process.env.SMOKE_BASE_URL || '',
    remoteManifestPath: `/${MANIFEST_NAME}`,
    checkRemoteManifest: false,
    verifyRemoteFiles: false,
    allowPartial: false,
    reportOnly: false,
    outputMode: 'json',
    maxFiles: 0,
    concurrency: Number(process.env.FRONTEND_MANIFEST_CONCURRENCY || '6'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--dist' && next) {
      options.distDir = next;
      index += 1;
      continue;
    }
    if ((token === '--out' || token === '--out-file') && next) {
      options.outFile = next;
      index += 1;
      continue;
    }
    if (token === '--remote-base' && next) {
      options.remoteBase = next;
      index += 1;
      continue;
    }
    if (token === '--remote-manifest-path' && next) {
      options.remoteManifestPath = next.startsWith('/') ? next : `/${next}`;
      index += 1;
      continue;
    }
    if (token === '--check-remote') {
      options.checkRemoteManifest = true;
      if (next && !next.startsWith('--')) {
        options.remoteBase = next;
        index += 1;
      }
      continue;
    }
    if (token === '--verify-remote-files') {
      options.verifyRemoteFiles = true;
      if (next && !next.startsWith('--')) {
        options.remoteBase = next;
        index += 1;
      }
      continue;
    }
    if (token === '--max-files' && next) {
      options.maxFiles = Number(next);
      index += 1;
      continue;
    }
    if (token === '--concurrency' && next) {
      options.concurrency = Number(next);
      index += 1;
      continue;
    }
    if (token === '--report-only') {
      options.reportOnly = true;
      continue;
    }
    if (token === '--allow-partial') {
      options.allowPartial = true;
      continue;
    }
    if (token === '--kv') {
      options.outputMode = 'kv';
      continue;
    }
    if (token === '--json') {
      options.outputMode = 'json';
    }
  }

  options.distDir = resolve(process.cwd(), options.distDir);
  options.outFile = resolve(options.distDir, options.outFile || MANIFEST_NAME);
  options.remoteBase = options.remoteBase.replace(/\/+$/, '');
  options.concurrency = Number.isFinite(options.concurrency) && options.concurrency > 0
    ? Math.min(Math.round(options.concurrency), 16)
    : 6;
  options.maxFiles = Number.isFinite(options.maxFiles) && options.maxFiles > 0 ? Math.round(options.maxFiles) : 0;

  return options;
}

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(rootDir, absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const relativePath = toPosixPath(relative(rootDir, absolutePath));
    if (relativePath === MANIFEST_NAME) {
      continue;
    }
    files.push({ absolutePath, path: `/${relativePath}` });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function hashFile(filePath) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      const digest = hash.digest();
      resolvePromise({
        sha256: digest.toString('hex'),
        sri: `sha256-${digest.toString('base64')}`,
      });
    });
  });
}

function hashManifestEntries(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(`${entry.sha256}  ${entry.path}  ${entry.bytes}\n`);
  }
  return hash.digest('hex');
}

function parseEntrypointAssets(indexHtml) {
  const refs = new Set();
  const tags = indexHtml.match(/<(script|link)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const src = tag.match(/\s(?:src|href)=["']([^"']+)["']/i)?.[1] || '';
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
      continue;
    }
    try {
      const parsed = new URL(src, 'https://qianfu.local/');
      if (parsed.pathname.startsWith('/assets/')) {
        refs.add(parsed.pathname);
      }
    } catch {
      if (src.startsWith('/assets/')) {
        refs.add(src);
      }
    }
  }
  return [...refs].sort();
}

async function buildManifest(options) {
  const files = await listFiles(options.distDir);
  const entries = [];
  let totalBytes = 0;

  for (const file of files) {
    const fileStat = await stat(file.absolutePath);
    const bytes = fileStat.size;
    totalBytes += bytes;
    const integrity = await hashFile(file.absolutePath);
    entries.push({
      path: file.path,
      bytes,
      ...integrity,
    });
  }

  const indexHtmlPath = resolve(options.distDir, 'index.html');
  let entrypointAssets = [];
  try {
    entrypointAssets = parseEntrypointAssets(await readFile(indexHtmlPath, 'utf8'));
  } catch {
    entrypointAssets = [];
  }

  const distHash = hashManifestEntries(entries);
  return {
    schemaVersion: 2,
    app: 'qianfu-liandeng',
    generatedAt: new Date().toISOString(),
    distRoot: toPosixPath(relative(process.cwd(), options.distDir)) || '.',
    manifestPath: `/${MANIFEST_NAME}`,
    fileCount: entries.length,
    totalBytes,
    buildId: distHash,
    distHash,
    entrypointAssets,
    files: entries,
  };
}

async function writeManifest(outFile, manifest) {
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function remoteUrl(base, pathname) {
  return new URL(pathname, `${base}/`).toString();
}

async function fetchRemoteJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'qianfu-dist-manifest/1.0',
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}; body=${text.slice(0, 180).replace(/\s+/g, ' ')}`);
  }
  return {
    status: response.status,
    json: JSON.parse(text),
  };
}

function compareManifests(localManifest, remoteManifest) {
  const localByPath = new Map(localManifest.files.map((entry) => [entry.path, entry]));
  const remoteByPath = new Map((remoteManifest.files || []).map((entry) => [entry.path, entry]));
  const missing = [];
  const extra = [];
  const mismatched = [];

  for (const [path, localEntry] of localByPath) {
    const remoteEntry = remoteByPath.get(path);
    if (!remoteEntry) {
      missing.push(path);
      continue;
    }
    if (remoteEntry.bytes !== localEntry.bytes || remoteEntry.sha256 !== localEntry.sha256) {
      mismatched.push(path);
    }
  }

  for (const path of remoteByPath.keys()) {
    if (!localByPath.has(path)) {
      extra.push(path);
    }
  }

  return {
    ok:
      remoteManifest.schemaVersion === localManifest.schemaVersion &&
      remoteManifest.app === localManifest.app &&
      remoteManifest.fileCount === localManifest.fileCount &&
      remoteManifest.totalBytes === localManifest.totalBytes &&
      remoteManifest.distHash === localManifest.distHash &&
      missing.length === 0 &&
      extra.length === 0 &&
      mismatched.length === 0,
    remoteFileCount: remoteManifest.fileCount ?? null,
    remoteTotalBytes: remoteManifest.totalBytes ?? null,
    remoteDistHash: remoteManifest.distHash ?? '',
    missing,
    extra,
    mismatched,
  };
}

async function fetchRemoteFileCheck(base, entry) {
  const url = remoteUrl(base, entry.path);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: '*/*',
        'User-Agent': 'qianfu-dist-manifest/1.0',
      },
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const remoteSha256 = createHash('sha256').update(bytes).digest('hex');
    return {
      path: entry.path,
      ok: response.status === 200 && bytes.length === entry.bytes && remoteSha256 === entry.sha256,
      status: response.status,
      expectedBytes: entry.bytes,
      remoteBytes: bytes.length,
      expectedSha256: entry.sha256,
      remoteSha256,
      error: '',
    };
  } catch (error) {
    return {
      path: entry.path,
      ok: false,
      status: null,
      expectedBytes: entry.bytes,
      remoteBytes: 0,
      expectedSha256: entry.sha256,
      remoteSha256: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function verifyRemoteFiles(manifest, options) {
  const files = options.maxFiles > 0 ? manifest.files.slice(0, options.maxFiles) : manifest.files;
  const results = await mapLimit(files, options.concurrency, (entry) => fetchRemoteFileCheck(options.remoteBase, entry));
  const failed = results.filter((result) => !result.ok);
  const partial = results.length < manifest.files.length;
  return {
    checked: results.length,
    totalManifestFiles: manifest.files.length,
    partial,
    ok: failed.length === 0 && results.length > 0 && (!partial || options.allowPartial),
    failed,
    sampleFailures: failed.slice(0, 20),
  };
}

function printKv(summary) {
  const remoteManifest = summary.remoteManifest || {};
  const remoteFiles = summary.remoteFiles || {};
  const lines = [
    ['ok', String(summary.ok)],
    ['manifest_path', summary.outFile],
    ['dist_dir', summary.distDir],
    ['file_count', String(summary.local.fileCount)],
    ['total_bytes', String(summary.local.totalBytes)],
    ['dist_hash', summary.local.distHash],
    ['entrypoint_assets', summary.local.entrypointAssets.length ? summary.local.entrypointAssets.join(',') : 'none'],
    ['remote_base', summary.remoteBase || ''],
    ['remote_manifest_checked', remoteManifest.checked ? 'true' : 'false'],
    ['remote_manifest_status', remoteManifest.status == null ? '' : String(remoteManifest.status)],
    ['remote_manifest_match', remoteManifest.checked ? String(remoteManifest.ok) : ''],
    ['remote_manifest_error', remoteManifest.error || ''],
    ['remote_manifest_missing', remoteManifest.missing?.length ? remoteManifest.missing.join(',') : 'none'],
    ['remote_manifest_extra', remoteManifest.extra?.length ? remoteManifest.extra.join(',') : 'none'],
    ['remote_manifest_mismatched', remoteManifest.mismatched?.length ? remoteManifest.mismatched.join(',') : 'none'],
    ['remote_files_checked', remoteFiles.checked == null ? '' : String(remoteFiles.checked)],
    ['remote_files_total_manifest_files', remoteFiles.totalManifestFiles == null ? '' : String(remoteFiles.totalManifestFiles)],
    ['remote_files_partial', remoteFiles.partial == null ? '' : String(remoteFiles.partial)],
    ['remote_files_match', remoteFiles.checked == null ? '' : String(remoteFiles.ok)],
    ['remote_file_failures', remoteFiles.sampleFailures?.length ? remoteFiles.sampleFailures.map((failure) => `${failure.path}:${failure.status ?? 'error'}`).join(',') : 'none'],
  ];

  for (const [key, value] of lines) {
    console.log(`${key}=${value}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await buildManifest(options);
  await writeManifest(options.outFile, manifest);

  const summary = {
    ok: true,
    distDir: options.distDir,
    outFile: options.outFile,
    remoteBase: options.remoteBase,
    local: {
      fileCount: manifest.fileCount,
      totalBytes: manifest.totalBytes,
      distHash: manifest.distHash,
      entrypointAssets: manifest.entrypointAssets,
    },
    remoteManifest: {
      checked: false,
    },
    remoteFiles: {
      checked: null,
    },
  };

  if ((options.checkRemoteManifest || options.verifyRemoteFiles) && !options.remoteBase) {
    throw new Error('Missing --remote-base or URL after --check-remote / --verify-remote-files');
  }

  if (options.checkRemoteManifest) {
    const url = remoteUrl(options.remoteBase, options.remoteManifestPath);
    try {
      const remote = await fetchRemoteJson(url);
      const comparison = compareManifests(manifest, remote.json);
      summary.remoteManifest = {
        checked: true,
        url,
        status: remote.status,
        ...comparison,
      };
      summary.ok = summary.ok && comparison.ok;
    } catch (error) {
      summary.remoteManifest = {
        checked: true,
        url,
        status: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        missing: [],
        extra: [],
        mismatched: [],
      };
      summary.ok = false;
    }
  }

  if (options.verifyRemoteFiles) {
    const remoteFiles = await verifyRemoteFiles(manifest, options);
    summary.remoteFiles = remoteFiles;
    summary.ok = summary.ok && remoteFiles.ok;
  }

  if (options.outputMode === 'kv') {
    printKv(summary);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }

  if (!summary.ok && !options.reportOnly) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[frontend-dist-manifest] Unexpected error:', error);
    process.exitCode = 1;
  });
}

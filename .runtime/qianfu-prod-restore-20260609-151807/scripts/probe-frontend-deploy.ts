import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { setDefaultResultOrder } from 'node:dns';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

try {
  setDefaultResultOrder('ipv4first');
} catch {
  // Older Node builds may not expose configurable DNS result ordering.
}

type ProbeResult = {
  ok: boolean;
  code: string;
  detail: string;
};

type ParsedHtmlSignals = {
  canonical: string | null;
  moduleScriptSrc: string | null;
  stylesheetHref: string | null;
  legacyHashMarkers: string[];
  sameAsLinks: string[];
  searchTarget: string | null;
};

type AssetRef = {
  path: string;
  tag: string;
  kind: string;
};

type AssetCheck = {
  path: string;
  ok: boolean;
  remoteStatus: number | null;
  localBytes: number;
  remoteBytes: number;
  localSha256: string;
  remoteSha256: string;
  error: string;
};

type OutputMode = 'json' | 'kv';

type RemoteHtmlPayload = {
  status: number;
  headers: {
    etag: string | null;
    lastModified: string | null;
  };
  html: string;
};

type RemoteAssetPayload = {
  status: number;
  bytes: Buffer;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = process.env.QIANFU_BASE_URL || process.env.SMOKE_BASE_URL || 'https://mc-u.top';
  let localHtmlPath = process.env.FRONTEND_DIST_HTML || resolve(process.cwd(), 'qianfu-liandeng', 'dist', 'index.html');
  let reportOnly = false;
  let outputMode: OutputMode = 'json';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--base' && args[i + 1]) {
      baseUrl = args[i + 1];
      i++;
      continue;
    }
    if (arg === '--local-html' && args[i + 1]) {
      localHtmlPath = resolve(process.cwd(), args[i + 1]);
      i++;
      continue;
    }
    if (arg === '--report-only') {
      reportOnly = true;
      continue;
    }
    if (arg === '--kv') {
      outputMode = 'kv';
    }
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    localHtmlPath,
    reportOnly,
    outputMode,
  };
}

async function fetchHtmlWithFetch(url: string): Promise<RemoteHtmlPayload> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'qianfu-frontend-deploy-probe/1.0',
    },
  });

  const html = await response.text();
  return {
    status: response.status,
    headers: {
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    },
    html,
  };
}

function parseCurlHeaders(rawHeaders: string) {
  const statusMatches = [...rawHeaders.matchAll(/HTTP\/\d+(?:\.\d+)?\s+(\d{3})/g)];
  const status = statusMatches.length > 0 ? Number(statusMatches[statusMatches.length - 1][1]) : 0;
  const etagMatches = [...rawHeaders.matchAll(/^etag:\s*(.+)$/gim)];
  const lastModifiedMatches = [...rawHeaders.matchAll(/^last-modified:\s*(.+)$/gim)];
  return {
    status,
    headers: {
      etag: etagMatches.length > 0 ? etagMatches[etagMatches.length - 1][1].trim() : null,
      lastModified: lastModifiedMatches.length > 0 ? lastModifiedMatches[lastModifiedMatches.length - 1][1].trim() : null,
    },
  };
}

async function fetchHtmlWithCurl(url: string): Promise<RemoteHtmlPayload> {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'qianfu-frontend-probe-'));
  const headerPath = resolve(tempDir, 'headers.txt');
  const curlBinary = process.platform === 'win32' ? 'curl.exe' : 'curl';

  try {
    const { stdout } = await execFile(curlBinary, [
      '-L',
      '-sS',
      '-m',
      '20',
      '-D',
      headerPath,
      '-o',
      '-',
      '-H',
      'Accept: text/html,application/xhtml+xml',
      '-H',
      'User-Agent: qianfu-frontend-deploy-probe/1.0',
      url,
    ], {
      maxBuffer: 2 * 1024 * 1024,
    });

    const headerBlock = await readFile(headerPath, 'utf8');
    const parsed = parseCurlHeaders(headerBlock);

    return {
      status: parsed.status,
      headers: parsed.headers,
      html: stdout,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchHtml(url: string) {
  const retryCount = Number(process.env.PROBE_FRONTEND_FETCH_RETRIES || '3');
  let lastError: unknown;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      return await fetchHtmlWithFetch(url);
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) {
        await delay(750 * attempt);
      }
    }
  }

  try {
    return await fetchHtmlWithCurl(url);
  } catch (curlError) {
    const reasons = [lastError, curlError]
      .filter(Boolean)
      .map((error) => error instanceof Error ? error.message : String(error))
      .join(' | ');
    throw new Error(`Unable to fetch ${url} after ${retryCount} fetch attempt(s) and curl fallback: ${reasons}`);
  }
}

function matchOne(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1] ?? null;
}

function collectMatches(html: string, pattern: RegExp) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  return [...html.matchAll(globalPattern)].map((match) => match[1]).filter(Boolean);
}

function parseAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function normalizeAssetPath(value: string) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) {
    return '';
  }

  try {
    const parsed = new URL(value, 'https://qianfu.local/');
    return parsed.pathname.startsWith('/assets/') ? parsed.pathname : '';
  } catch {
    return value.startsWith('/assets/') ? value : '';
  }
}

function collectDeployAssetRefs(html: string) {
  const refs = new Map<string, AssetRef>();
  const tags = html.match(/<(script|link)\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const tagName = tag.match(/^<(\w+)/)?.[1]?.toLowerCase() || '';
    const attrs = parseAttributes(tag);
    const rel = attrs.rel || '';
    const src = attrs.src || attrs.href || '';
    const path = normalizeAssetPath(src);
    if (!path) {
      continue;
    }

    const isEntrypointScript = tagName === 'script' && (!attrs.type || attrs.type === 'module');
    const isStylesheet = tagName === 'link' && /\bstylesheet\b/i.test(rel);
    const isModulePreload = tagName === 'link' && /\bmodulepreload\b/i.test(rel);
    if (!isEntrypointScript && !isStylesheet && !isModulePreload) {
      continue;
    }

    refs.set(path, {
      path,
      tag: tagName,
      kind: isEntrypointScript ? 'script' : isStylesheet ? 'stylesheet' : 'modulepreload',
    });
  }

  return [...refs.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function collectLegacyHashMarkers(html: string) {
  const markers = new Set<string>();
  const legacyPatterns = [
    /https:\/\/mc-u\.top\/#\/search/g,
    /https:\/\/mc-u\.top\/#\/servers/g,
    /https:\/\/mc-u\.top\/#\/resources/g,
    /#\/search/g,
    /#\/servers/g,
    /#\/resources/g,
  ];

  for (const pattern of legacyPatterns) {
    const hits = html.match(pattern) || [];
    for (const hit of hits) {
      markers.add(hit);
    }
  }

  return [...markers];
}

function parseHtmlSignals(html: string): ParsedHtmlSignals {
  return {
    canonical: matchOne(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i),
    moduleScriptSrc: matchOne(html, /<script\s+type="module"[^>]*src="([^"]+)"/i),
    stylesheetHref: matchOne(html, /<link\s+rel="stylesheet"[^>]*href="([^"]+)"/i),
    legacyHashMarkers: collectLegacyHashMarkers(html),
    sameAsLinks: collectMatches(html, /"sameAs"\s*:\s*\[(.*?)\]/is)
      .flatMap((block) => [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1])),
    searchTarget: matchOne(html, /"target"\s*:\s*"([^"]+)"/i),
  };
}

function sha256(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sameStringList(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

async function fetchAsset(url: string): Promise<RemoteAssetPayload> {
  const retryCount = Number(process.env.PROBE_FRONTEND_FETCH_RETRIES || '3');
  let lastError: unknown;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: '*/*',
          'User-Agent': 'qianfu-frontend-deploy-probe/1.0',
        },
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        status: response.status,
        bytes,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) {
        await delay(750 * attempt);
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Unable to fetch ${url} after ${retryCount} attempt(s): ${reason}`);
}

async function checkAsset(baseUrl: string, localDistRoot: string, assetPath: string): Promise<AssetCheck> {
  const localPath = resolve(localDistRoot, assetPath.replace(/^\/+/, ''));
  const remoteUrl = new URL(assetPath, `${baseUrl}/`).toString();

  try {
    const [localBytes, remote] = await Promise.all([
      readFile(localPath),
      fetchAsset(remoteUrl),
    ]);
    const localSha256 = sha256(localBytes);
    const remoteSha256 = sha256(remote.bytes);
    const ok = remote.status === 200 && localSha256 === remoteSha256;
    return {
      path: assetPath,
      ok,
      remoteStatus: remote.status,
      localBytes: localBytes.length,
      remoteBytes: remote.bytes.length,
      localSha256,
      remoteSha256,
      error: '',
    };
  } catch (error) {
    return {
      path: assetPath,
      ok: false,
      remoteStatus: null,
      localBytes: 0,
      remoteBytes: 0,
      localSha256: '',
      remoteSha256: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeSignals(label: string, signals: ParsedHtmlSignals) {
  return {
    label,
    canonical: signals.canonical,
    moduleScriptSrc: signals.moduleScriptSrc,
    stylesheetHref: signals.stylesheetHref,
    searchTarget: signals.searchTarget,
    sameAsLinks: signals.sameAsLinks,
    legacyHashMarkers: signals.legacyHashMarkers,
  };
}

function printKvSummary(summary: {
  remoteUrl: string;
  localHtmlPath: string;
  remoteStatus: number;
  remoteHeaders: { etag: string | null; lastModified: string | null };
  local: ReturnType<typeof summarizeSignals>;
  remote: ReturnType<typeof summarizeSignals>;
  localAssets: AssetRef[];
  remoteAssets: AssetRef[];
  assetReferenceMatch: boolean;
  assetChecks: AssetCheck[];
}) {
  const bundleMatch =
    summary.local.moduleScriptSrc && summary.remote.moduleScriptSrc
      ? String(summary.local.moduleScriptSrc === summary.remote.moduleScriptSrc)
      : 'unknown';
  const searchTargetMatch =
    summary.local.searchTarget && summary.remote.searchTarget
      ? String(summary.local.searchTarget === summary.remote.searchTarget)
      : 'unknown';
  const failedAssetChecks = summary.assetChecks.filter((check) => !check.ok);
  const assetContentMatch = summary.assetChecks.length > 0 && failedAssetChecks.length === 0 ? 'true' : 'false';

  const lines = [
    ['remote_url', summary.remoteUrl],
    ['local_html_path', summary.localHtmlPath],
    ['remote_root_status', String(summary.remoteStatus)],
    ['remote_etag', summary.remoteHeaders.etag || ''],
    ['remote_last_modified', summary.remoteHeaders.lastModified || ''],
    ['remote_bundle', summary.remote.moduleScriptSrc || ''],
    ['local_bundle', summary.local.moduleScriptSrc || ''],
    ['bundle_match', bundleMatch],
    ['remote_legacy_hash_markers', summary.remote.legacyHashMarkers.length ? summary.remote.legacyHashMarkers.join(',') : 'none'],
    ['local_legacy_hash_markers', summary.local.legacyHashMarkers.length ? summary.local.legacyHashMarkers.join(',') : 'none'],
    ['remote_search_target', summary.remote.searchTarget || ''],
    ['local_search_target', summary.local.searchTarget || ''],
    ['search_target_match', searchTargetMatch],
    ['remote_same_as', summary.remote.sameAsLinks.length ? summary.remote.sameAsLinks.join(',') : 'none'],
    ['local_same_as', summary.local.sameAsLinks.length ? summary.local.sameAsLinks.join(',') : 'none'],
    ['local_asset_refs', summary.localAssets.length ? summary.localAssets.map((asset) => asset.path).join(',') : 'none'],
    ['remote_asset_refs', summary.remoteAssets.length ? summary.remoteAssets.map((asset) => asset.path).join(',') : 'none'],
    ['asset_reference_match', String(summary.assetReferenceMatch)],
    ['asset_check_count', String(summary.assetChecks.length)],
    ['asset_content_match', assetContentMatch],
    ['missing_or_mismatched_assets', failedAssetChecks.length ? failedAssetChecks.map((check) => `${check.path}:${check.remoteStatus ?? 'error'}`).join(',') : 'none'],
  ];

  for (const [key, value] of lines) {
    console.log(`${key}=${value}`);
  }
}

async function main() {
  const { baseUrl, localHtmlPath, reportOnly, outputMode } = parseArgs();
  const remoteUrl = `${baseUrl}/`;

  const localHtml = await readFile(localHtmlPath, 'utf8');
  const remote = await fetchHtml(remoteUrl);
  const localDistRoot = dirname(localHtmlPath);

  const localSignals = parseHtmlSignals(localHtml);
  const remoteSignals = parseHtmlSignals(remote.html);
  const localAssets = collectDeployAssetRefs(localHtml);
  const remoteAssets = collectDeployAssetRefs(remote.html);
  const localAssetPaths = localAssets.map((asset) => asset.path);
  const remoteAssetPaths = remoteAssets.map((asset) => asset.path);
  const assetReferenceMatch = sameStringList(localAssetPaths, remoteAssetPaths);
  const assetChecks = await Promise.all(
    localAssetPaths.map((assetPath) => checkAsset(baseUrl, localDistRoot, assetPath)),
  );

  const results: ProbeResult[] = [];

  if (remote.status !== 200) {
    results.push({
      ok: false,
      code: 'remote_root_status',
      detail: `Expected ${remoteUrl} to return HTTP 200, got ${remote.status}`,
    });
  } else {
    results.push({
      ok: true,
      code: 'remote_root_status',
      detail: `Remote root returned HTTP ${remote.status}`,
    });
  }

  if (!localSignals.moduleScriptSrc || !remoteSignals.moduleScriptSrc) {
    results.push({
      ok: false,
      code: 'module_script_missing',
      detail: `Missing module script reference. local=${localSignals.moduleScriptSrc ?? 'null'} remote=${remoteSignals.moduleScriptSrc ?? 'null'}`,
    });
  } else if (localSignals.moduleScriptSrc !== remoteSignals.moduleScriptSrc) {
    results.push({
      ok: false,
      code: 'bundle_mismatch',
      detail: `Remote bundle ${remoteSignals.moduleScriptSrc} does not match local build ${localSignals.moduleScriptSrc}`,
    });
  } else {
    results.push({
      ok: true,
      code: 'bundle_mismatch',
      detail: `Remote bundle matches local build: ${remoteSignals.moduleScriptSrc}`,
    });
  }

  if (remoteSignals.legacyHashMarkers.length > 0) {
    results.push({
      ok: false,
      code: 'remote_legacy_hash_markers',
      detail: `Remote HTML still contains legacy hash-route markers: ${remoteSignals.legacyHashMarkers.join(', ')}`,
    });
  } else {
    results.push({
      ok: true,
      code: 'remote_legacy_hash_markers',
      detail: 'Remote HTML no longer contains legacy hash-route markers',
    });
  }

  if (localSignals.legacyHashMarkers.length > 0) {
    results.push({
      ok: false,
      code: 'local_build_has_legacy_hash_markers',
      detail: `Local dist still contains legacy hash-route markers: ${localSignals.legacyHashMarkers.join(', ')}`,
    });
  } else {
    results.push({
      ok: true,
      code: 'local_build_has_legacy_hash_markers',
      detail: 'Local dist no longer contains legacy hash-route markers',
    });
  }

  if (localSignals.searchTarget && remoteSignals.searchTarget && localSignals.searchTarget !== remoteSignals.searchTarget) {
    results.push({
      ok: false,
      code: 'search_target_mismatch',
      detail: `Remote SearchAction target ${remoteSignals.searchTarget} does not match local build ${localSignals.searchTarget}`,
    });
  } else {
    results.push({
      ok: true,
      code: 'search_target_mismatch',
      detail: `SearchAction target aligned at ${remoteSignals.searchTarget ?? 'null'}`,
    });
  }

  if (!assetReferenceMatch) {
    results.push({
      ok: false,
      code: 'asset_reference_mismatch',
      detail: `Remote entry asset refs ${remoteAssetPaths.join(',') || 'none'} do not match local dist ${localAssetPaths.join(',') || 'none'}`,
    });
  } else {
    results.push({
      ok: true,
      code: 'asset_reference_mismatch',
      detail: `Remote entry asset refs match local dist: ${localAssetPaths.join(',') || 'none'}`,
    });
  }

  const failedAssetChecks = assetChecks.filter((check) => !check.ok);
  if (failedAssetChecks.length > 0) {
    results.push({
      ok: false,
      code: 'asset_content_mismatch',
      detail: failedAssetChecks
        .map((check) =>
          check.error
            ? `${check.path}: ${check.error}`
            : `${check.path}: remoteStatus=${check.remoteStatus} localSha256=${check.localSha256} remoteSha256=${check.remoteSha256}`,
        )
        .join('; '),
    });
  } else {
    results.push({
      ok: true,
      code: 'asset_content_mismatch',
      detail: `Remote entry asset contents match local dist (${assetChecks.length} checked)`,
    });
  }

  const summary = {
    timestamp: new Date().toISOString(),
    remoteUrl,
    localHtmlPath,
    remoteStatus: remote.status,
    remoteHeaders: remote.headers,
    local: summarizeSignals('local', localSignals),
    remote: summarizeSignals('remote', remoteSignals),
    localAssets,
    remoteAssets,
    assetReferenceMatch,
    assetChecks,
    results,
  };

  if (outputMode === 'kv') {
    printKvSummary(summary);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0 && !reportOnly) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[probe:frontend-deploy] Unexpected error:', error);
  process.exitCode = 1;
});

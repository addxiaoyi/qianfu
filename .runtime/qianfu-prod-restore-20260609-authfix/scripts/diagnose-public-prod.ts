import { execFile as execFileCallback } from 'node:child_process';
import { setDefaultResultOrder } from 'node:dns';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

try {
  setDefaultResultOrder('ipv4first');
} catch {
  // Older Node builds may not expose configurable DNS result ordering.
}

type OutputMode = 'text' | 'json' | 'kv';

type HttpProbe = {
  url: string;
  status: number | null;
  ok: boolean;
  contentType: string;
  bodyPreview: string;
  error: string;
};

type DiagnosisSummary = {
  timestamp: string;
  baseUrl: string;
  mainSiteHost: string;
  payHost: string;
  reportFile?: string;
  main: {
    apiHealth: HttpProbe;
    apiReady: HttpProbe;
    diagnosis: string;
  };
  frontend: {
    probeOk: boolean;
    probeError: string;
    remoteRootStatus: string;
    remoteBundle: string;
    localBundle: string;
    bundleMatch: string;
    remoteLegacyHashMarkers: string;
    searchTargetMatch: string;
    assetReferenceMatch: string;
    assetContentMatch: string;
    missingOrMismatchedAssets: string;
    manifestChecked: string;
    manifestMatch: string;
    manifestError: string;
    manifestDistHash: string;
    diagnosis: string;
  };
  pay: {
    root: HttpProbe;
    health: HttpProbe;
    apiHealth: HttpProbe;
    probeOk: boolean;
    probeError: string;
    tlsStatus: string;
    certCn: string;
    certSan: string;
    htmlStatus: string;
    looksLikeMainSite: string;
    rootMarkerMatch: string;
    canonicalUrl: string;
    ogUrl: string;
    diagnosis: string;
  };
  findings: string[];
  recommendedActions: string[];
};

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = process.env.QIANFU_BASE_URL || process.env.SMOKE_BASE_URL || 'https://mc-u.top';
  let payHost = process.env.PAY_DOMAIN_HOST || 'pay.star-web.top';
  let mainSiteHost = process.env.PAY_MAIN_SITE_HOST || '';
  let reportOnly = false;
  let outputMode: OutputMode = 'text';
  let outFile = process.env.PROD_DIAGNOSE_PUBLIC_OUT || '';

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--base' && args[index + 1]) {
      baseUrl = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--pay-host' && args[index + 1]) {
      payHost = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--main-site-host' && args[index + 1]) {
      mainSiteHost = args[index + 1];
      index += 1;
      continue;
    }
    if ((token === '--out' || token === '--out-file') && args[index + 1]) {
      outFile = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--report-only') {
      reportOnly = true;
      continue;
    }
    if (token === '--json') {
      outputMode = 'json';
      continue;
    }
    if (token === '--kv') {
      outputMode = 'kv';
    }
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return {
    baseUrl: normalizedBaseUrl,
    payHost: extractHost(payHost),
    mainSiteHost: mainSiteHost ? extractHost(mainSiteHost) : extractHost(normalizedBaseUrl),
    reportOnly,
    outputMode,
    outFile,
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function extractHost(value: string) {
  const normalized = value.trim();
  if (/^https?:\/\//i.test(normalized)) {
    return new URL(normalized).host;
  }

  return normalized
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

function truncate(text: string, max = 200) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function createHttpProbe(url: string): HttpProbe {
  return {
    url,
    status: null,
    ok: false,
    contentType: '',
    bodyPreview: '',
    error: '',
  };
}

async function requestTextOnce(url: string, options?: { allowInvalidTls?: boolean; timeoutMs?: number; redirectsLeft?: number }): Promise<HttpProbe> {
  const allowInvalidTls = options?.allowInvalidTls ?? false;
  const timeoutMs = options?.timeoutMs ?? 12000;
  const redirectsLeft = options?.redirectsLeft ?? 5;
  const target = new URL(url);
  const transport = target.protocol === 'https:' ? https : http;
  const probe = createHttpProbe(url);

  return new Promise<HttpProbe>((resolve) => {
    const request = transport.request(
      target,
      {
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          Accept: 'application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'qianfu-public-diagnose/1.0',
        },
        ...(target.protocol === 'https:' ? { rejectUnauthorized: !allowInvalidTls } : {}),
      },
      (response) => {
        const status = response.statusCode || null;
        const location = response.headers.location;

        if (status && status >= 300 && status < 400 && location && redirectsLeft > 0) {
          const nextUrl = new URL(location, target).toString();
          response.resume();
          request.destroy();
          requestText(nextUrl, { allowInvalidTls, timeoutMs, redirectsLeft: redirectsLeft - 1 }).then(resolve);
          return;
        }

        const chunks: string[] = [];
        let capturedLength = 0;
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          if (capturedLength >= 16384) {
            return;
          }

          const remaining = 16384 - capturedLength;
          const slice = chunk.slice(0, remaining);
          chunks.push(slice);
          capturedLength += slice.length;
        });
        response.on('end', () => {
          const body = chunks.join('');
          resolve({
            url,
            status,
            ok: status !== null && status >= 200 && status < 300,
            contentType: typeof response.headers['content-type'] === 'string' ? response.headers['content-type'] : '',
            bodyPreview: truncate(body),
            error: '',
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
    request.on('error', (error) => {
      resolve({
        ...probe,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    request.end();
  });
}

async function requestText(url: string, options?: { allowInvalidTls?: boolean; timeoutMs?: number; redirectsLeft?: number; retries?: number }): Promise<HttpProbe> {
  const retries = options?.retries ?? 3;
  let lastProbe = createHttpProbe(url);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const probe = await requestTextOnce(url, options);
    lastProbe = probe;

    if (probe.status !== null || !probe.error) {
      return probe;
    }

    if (attempt < retries) {
      await delay(500 * attempt);
    }
  }

  return lastProbe;
}

async function runFrontendProbe(baseUrl: string) {
  const bundledProbePath = resolve(process.cwd(), 'scripts', 'prod-restore-runners', 'probe-frontend-deploy.mjs');
  const tsxCliPath = resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');

  try {
    if (existsSync(bundledProbePath)) {
      const { stdout } = await execFile(
        process.execPath,
        [bundledProbePath, '--report-only', '--kv', '--base', baseUrl],
        {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024,
        },
      );

      return {
        ok: true,
        error: '',
        values: parseKv(stdout),
      };
    }

    if (!existsSync(tsxCliPath)) {
      throw new Error(`frontend probe runner not found at ${bundledProbePath}; tsx cli not found at ${tsxCliPath}`);
    }

    const { stdout } = await execFile(
      process.execPath,
      [tsxCliPath, 'scripts/probe-frontend-deploy.ts', '--report-only', '--kv', '--base', baseUrl],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024,
      },
    );

    return {
      ok: true,
      error: '',
      values: parseKv(stdout),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stdout = typeof error === 'object' && error && 'stdout' in error ? String((error as { stdout?: string }).stdout || '') : '';
    return {
      ok: false,
      error: stdout ? `${detail} | ${stdout}` : detail,
      values: {} as Record<string, string>,
    };
  }
}

async function runPayDomainProbe(payHost: string, mainSiteHost: string) {
  try {
    const { stdout } = await execFile(
      process.execPath,
      ['scripts/utils/domain-cert-probe.mjs', '--host', payHost, '--expect-host', payHost, '--main-site-host', mainSiteHost],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024,
      },
    );

    return {
      ok: true,
      error: '',
      values: parseKv(stdout),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stdout = typeof error === 'object' && error && 'stdout' in error ? String((error as { stdout?: string }).stdout || '') : '';
    return {
      ok: false,
      error: stdout ? `${detail} | ${stdout}` : detail,
      values: parseKv(stdout),
    };
  }
}

async function runFrontendManifestProbe(baseUrl: string) {
  try {
    const { stdout } = await execFile(
      process.execPath,
      ['scripts/frontend-dist-manifest.mjs', '--check-remote', baseUrl, '--report-only', '--kv'],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024,
      },
    );

    return {
      ok: true,
      error: '',
      values: parseKv(stdout),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stdout = typeof error === 'object' && error && 'stdout' in error ? String((error as { stdout?: string }).stdout || '') : '';
    return {
      ok: false,
      error: stdout ? `${detail} | ${stdout}` : detail,
      values: parseKv(stdout),
    };
  }
}

function parseKv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    values[key] = value;
  }

  return values;
}

function diagnoseMain(main: DiagnosisSummary['main']) {
  if (main.apiHealth.status === 502 || main.apiReady.status === 502) {
    return 'static_html_likely_alive_but_api_edge_broken';
  }
  if (!main.apiHealth.ok && !main.apiReady.ok) {
    return 'main_api_unreachable';
  }
  return 'ok';
}

function diagnoseFrontend(frontend: DiagnosisSummary['frontend']) {
  if (!frontend.probeOk) {
    return 'frontend_probe_failed';
  }
  if (frontend.bundleMatch === 'false') {
    return 'stale_bundle';
  }
  if (frontend.assetReferenceMatch === 'false') {
    return 'stale_asset_references';
  }
  if (frontend.assetContentMatch === 'false') {
    return 'stale_or_missing_assets';
  }
  if (frontend.manifestChecked === 'true' && frontend.manifestMatch === 'false') {
    return 'dist_manifest_mismatch';
  }
  if (frontend.remoteLegacyHashMarkers && frontend.remoteLegacyHashMarkers !== 'none') {
    return 'legacy_hash_markers_present';
  }
  if (frontend.searchTargetMatch === 'false') {
    return 'search_target_stale';
  }
  if (frontend.remoteRootStatus && frontend.remoteRootStatus !== '200') {
    return 'frontend_root_not_200';
  }
  return 'ok';
}

function diagnosePay(pay: DiagnosisSummary['pay']) {
  if (!pay.probeOk) {
    return 'pay_probe_failed';
  }
  if (pay.tlsStatus === 'wrong_principal' && pay.looksLikeMainSite === 'true') {
    return 'main_site_tls_vhost_fallback';
  }
  if (pay.tlsStatus === 'wrong_principal') {
    return 'wrong_certificate_principal';
  }
  if (pay.looksLikeMainSite === 'true') {
    return 'main_site_html_fallback';
  }
  if (pay.rootMarkerMatch !== 'true') {
    return 'pay_root_marker_missing';
  }
  if (pay.health.status === 502 || pay.apiHealth.status === 502) {
    return 'pay_upstream_broken';
  }
  return 'ok';
}

function collectFindings(summary: DiagnosisSummary) {
  const findings: string[] = [];

  if (summary.main.diagnosis === 'static_html_likely_alive_but_api_edge_broken') {
    findings.push('主站更像是静态根页还活着，但 /api 边缘或上游进程仍然损坏。');
  } else if (summary.main.diagnosis !== 'ok') {
    findings.push('主站 API 目前不可用或无法稳定访问。');
  }

  if (summary.frontend.diagnosis === 'stale_bundle') {
    findings.push(`主站前端仍在使用旧 bundle：remote=${summary.frontend.remoteBundle || 'unknown'} local=${summary.frontend.localBundle || 'unknown'}。`);
  } else if (summary.frontend.diagnosis === 'stale_asset_references') {
    findings.push('主站前端入口资源清单与本地 dist 不一致，线上 HTML 仍可能引用旧 JS/CSS。');
  } else if (summary.frontend.diagnosis === 'stale_or_missing_assets') {
    findings.push(`主站前端静态资源内容与本地 dist 不一致或缺失：${summary.frontend.missingOrMismatchedAssets || 'unknown'}。`);
  } else if (summary.frontend.diagnosis === 'dist_manifest_mismatch') {
    findings.push(`主站前端 dist manifest 与本地构建不一致或未部署：${summary.frontend.manifestError || 'manifest mismatch'}。`);
  } else if (summary.frontend.diagnosis === 'legacy_hash_markers_present') {
    findings.push(`主站前端 HTML 仍残留旧 hash 路由标记：${summary.frontend.remoteLegacyHashMarkers}。`);
  } else if (summary.frontend.diagnosis === 'search_target_stale') {
    findings.push('主站 SearchAction target 仍与本地构建不一致。');
  } else if (summary.frontend.diagnosis === 'frontend_probe_failed') {
    findings.push(`主站前端 freshness 探针执行失败：${summary.frontend.probeError}`);
  }
  if (
    summary.frontend.manifestChecked === 'true' &&
    summary.frontend.manifestMatch === 'false' &&
    summary.frontend.diagnosis !== 'dist_manifest_mismatch'
  ) {
    findings.push(`主站前端 dist manifest 未部署或与本地不一致：${summary.frontend.manifestError || 'manifest mismatch'}。`);
  }

  if (summary.pay.diagnosis === 'main_site_tls_vhost_fallback') {
    findings.push(`支付域 ${summary.pay.apiHealth.url.replace(/\/api\/health$/, '')} 很可能落到了主站 TLS/vhost，而不是独立支付站点。`);
  } else if (summary.pay.diagnosis === 'wrong_certificate_principal') {
    findings.push(`支付域证书主体不匹配：CN=${summary.pay.certCn || 'unknown'} SAN=${summary.pay.certSan || 'unknown'}。`);
  } else if (summary.pay.diagnosis === 'main_site_html_fallback') {
    findings.push('支付域根路径返回的 HTML 很像主站，而不是支付站点。');
  } else if (summary.pay.diagnosis === 'pay_root_marker_missing') {
    findings.push('支付域根路径没有返回 qianfu-pay-gateway 标记。');
  } else if (summary.pay.diagnosis === 'pay_upstream_broken') {
    findings.push('支付域健康检查仍然是 502，更像是支付站点 upstream 还没恢复。');
  } else if (summary.pay.diagnosis === 'pay_probe_failed') {
    findings.push(`支付域探针执行失败：${summary.pay.probeError}`);
  }

  return findings;
}

function collectRecommendedActions(summary: DiagnosisSummary) {
  const actions: string[] = [];

  if (summary.main.diagnosis === 'static_html_likely_alive_but_api_edge_broken') {
    actions.push('主站下一步：在生产机检查 pm2 qianfu-api、API_PORT/PORT、ss -lntp 和 Nginx /api upstream，先让 127.0.0.1:3000/api/health 与公网 /api/health 变绿。');
  } else if (summary.main.diagnosis === 'main_api_unreachable') {
    actions.push('主站下一步：先恢复 Node API 进程和本机健康检查，再 reload Nginx；不要只替换静态前端。');
  }

  if (summary.frontend.diagnosis === 'stale_bundle') {
    actions.push(`前端下一步：重新执行 npm run build 并部署 qianfu-liandeng/dist，确认线上入口从 ${summary.frontend.remoteBundle || 'unknown'} 更新为 ${summary.frontend.localBundle || '当前本地 bundle'}。`);
  } else if (summary.frontend.diagnosis === 'stale_asset_references' || summary.frontend.diagnosis === 'stale_or_missing_assets') {
    actions.push('前端下一步：重新发布完整 qianfu-liandeng/dist 目录，不要只替换 index.html；发布后用 probe:frontend-deploy 确认入口资源清单和 SHA-256 内容都与本地 dist 一致。');
  } else if (summary.frontend.diagnosis === 'dist_manifest_mismatch') {
    actions.push('前端下一步：使用 scripts/linux/deploy-frontend-dist.sh 原子发布完整 dist，确认 /qianfu-dist-manifest.json 返回 JSON 且 dist_hash 与本地一致。');
  } else if (summary.frontend.diagnosis === 'legacy_hash_markers_present' || summary.frontend.diagnosis === 'search_target_stale') {
    actions.push('前端下一步：重新部署当前 dist/index.html，确认旧 #/search/#/servers/#/resources SEO 标记和 SearchAction target 已被新构建替换。');
  } else if (summary.frontend.diagnosis === 'frontend_probe_failed') {
    actions.push('前端下一步：先修复 probe:frontend-deploy 运行环境或网络访问，再判断静态前端是否已更新。');
  }
  if (
    summary.frontend.manifestChecked === 'true' &&
    summary.frontend.manifestMatch === 'false' &&
    !actions.some((action) => action.includes('qianfu-dist-manifest.json'))
  ) {
    actions.push('前端整包验收下一步：使用 scripts/linux/deploy-frontend-dist.sh 原子发布完整 dist，确认 /qianfu-dist-manifest.json 返回 JSON 且 dist_hash 与本地一致。');
  }

  if (summary.pay.diagnosis === 'main_site_tls_vhost_fallback') {
    actions.push('支付域下一步：修复 pay.star-web.top 的 Nginx server_name 与证书绑定，确保证书来自 /etc/letsencrypt/live/pay.star-web.top/，根路径返回 qianfu-pay-gateway 而不是 mc-u.top HTML。');
  } else if (summary.pay.diagnosis === 'wrong_certificate_principal') {
    actions.push('支付域下一步：重新签发或绑定 pay.star-web.top 证书，并用 openssl s_client -servername pay.star-web.top 验证 SAN。');
  } else if (summary.pay.diagnosis === 'main_site_html_fallback' || summary.pay.diagnosis === 'pay_root_marker_missing') {
    actions.push('支付域下一步：检查 pay.star-web.top 的 443 vhost 是否命中支付站点块，确认 / 返回 qianfu-pay-gateway 标记。');
  } else if (summary.pay.diagnosis === 'pay_upstream_broken') {
    actions.push('支付域下一步：检查支付域 /health 与 /api/health 的 upstream，确认 127.0.0.1:3000 和 XPay 端口按模板可达。');
  } else if (summary.pay.diagnosis === 'pay_probe_failed') {
    actions.push('支付域下一步：先修复 domain-cert-probe 运行环境或 DNS/TLS 访问，再判断 vhost 是否恢复。');
  }

  if (actions.length === 0) {
    actions.push('无需额外动作：当前公网探针未发现主站 API、前端 freshness 或支付域 TLS/vhost 问题。');
  }

  return actions;
}

function printText(summary: DiagnosisSummary) {
  console.log(`timestamp=${summary.timestamp}`);
  if (summary.reportFile) {
    console.log(`report file: ${summary.reportFile}`);
  }
  console.log('');
  console.log('== Main site ==');
  console.log(`root status (from frontend probe): ${summary.frontend.remoteRootStatus || 'unknown'}`);
  console.log(`api health: ${formatHttpProbe(summary.main.apiHealth)}`);
  console.log(`api ready: ${formatHttpProbe(summary.main.apiReady)}`);
  console.log(`diagnosis: ${summary.main.diagnosis}`);
  console.log('');
  console.log('== Frontend ==');
  console.log(`bundle match: ${summary.frontend.bundleMatch || 'unknown'}`);
  console.log(`remote bundle: ${summary.frontend.remoteBundle || 'unknown'}`);
  console.log(`local bundle: ${summary.frontend.localBundle || 'unknown'}`);
  console.log(`legacy hash markers: ${summary.frontend.remoteLegacyHashMarkers || 'unknown'}`);
  console.log(`search target match: ${summary.frontend.searchTargetMatch || 'unknown'}`);
  console.log(`asset refs match: ${summary.frontend.assetReferenceMatch || 'unknown'}`);
  console.log(`asset content match: ${summary.frontend.assetContentMatch || 'unknown'}`);
  console.log(`missing/mismatched assets: ${summary.frontend.missingOrMismatchedAssets || 'unknown'}`);
  console.log(`manifest checked: ${summary.frontend.manifestChecked || 'unknown'}`);
  console.log(`manifest match: ${summary.frontend.manifestMatch || 'unknown'}`);
  console.log(`manifest error: ${summary.frontend.manifestError || 'none'}`);
  console.log(`manifest dist hash: ${summary.frontend.manifestDistHash || 'unknown'}`);
  console.log(`diagnosis: ${summary.frontend.diagnosis}`);
  console.log('');
  console.log('== Pay domain ==');
  console.log(`root: ${formatHttpProbe(summary.pay.root)}`);
  console.log(`health: ${formatHttpProbe(summary.pay.health)}`);
  console.log(`api health: ${formatHttpProbe(summary.pay.apiHealth)}`);
  console.log(`tls status: ${summary.pay.tlsStatus || 'unknown'}`);
  console.log(`cert cn: ${summary.pay.certCn || 'unknown'}`);
  console.log(`looks like main site: ${summary.pay.looksLikeMainSite || 'unknown'}`);
  console.log(`root marker match: ${summary.pay.rootMarkerMatch || 'unknown'}`);
  console.log(`diagnosis: ${summary.pay.diagnosis}`);
  console.log('');
  console.log('== Findings ==');
  if (summary.findings.length === 0) {
    console.log('PASS: no public production issues detected by this probe set');
  } else {
    for (const finding of summary.findings) {
      console.log(`FAIL: ${finding}`);
    }
  }
  console.log('');
  console.log('== Recommended actions ==');
  for (const action of summary.recommendedActions) {
    console.log(`NEXT: ${action}`);
  }
}

function formatHttpProbe(probe: HttpProbe) {
  if (probe.status !== null) {
    return `HTTP ${probe.status}${probe.bodyPreview ? `; body=${probe.bodyPreview}` : ''}`;
  }
  if (probe.error) {
    return `ERR ${probe.error}`;
  }
  return 'unknown';
}

function printKv(summary: DiagnosisSummary) {
  const lines = [
    ['timestamp', summary.timestamp],
    ['report_file', summary.reportFile || ''],
    ['base_url', summary.baseUrl],
    ['main_site_host', summary.mainSiteHost],
    ['pay_host', summary.payHost],
    ['main_root_status', summary.frontend.remoteRootStatus || ''],
    ['main_api_health_status', summary.main.apiHealth.status === null ? '' : String(summary.main.apiHealth.status)],
    ['main_api_ready_status', summary.main.apiReady.status === null ? '' : String(summary.main.apiReady.status)],
    ['main_diagnosis', summary.main.diagnosis],
    ['frontend_bundle_match', summary.frontend.bundleMatch || ''],
    ['frontend_remote_bundle', summary.frontend.remoteBundle || ''],
    ['frontend_local_bundle', summary.frontend.localBundle || ''],
    ['frontend_legacy_hash_markers', summary.frontend.remoteLegacyHashMarkers || ''],
    ['frontend_search_target_match', summary.frontend.searchTargetMatch || ''],
    ['frontend_asset_reference_match', summary.frontend.assetReferenceMatch || ''],
    ['frontend_asset_content_match', summary.frontend.assetContentMatch || ''],
    ['frontend_missing_or_mismatched_assets', summary.frontend.missingOrMismatchedAssets || ''],
    ['frontend_manifest_checked', summary.frontend.manifestChecked || ''],
    ['frontend_manifest_match', summary.frontend.manifestMatch || ''],
    ['frontend_manifest_error', summary.frontend.manifestError || ''],
    ['frontend_manifest_dist_hash', summary.frontend.manifestDistHash || ''],
    ['frontend_diagnosis', summary.frontend.diagnosis],
    ['pay_root_status', summary.pay.root.status === null ? '' : String(summary.pay.root.status)],
    ['pay_health_status', summary.pay.health.status === null ? '' : String(summary.pay.health.status)],
    ['pay_api_health_status', summary.pay.apiHealth.status === null ? '' : String(summary.pay.apiHealth.status)],
    ['pay_tls_status', summary.pay.tlsStatus || ''],
    ['pay_cert_cn', summary.pay.certCn || ''],
    ['pay_cert_san', summary.pay.certSan || ''],
    ['pay_html_status', summary.pay.htmlStatus || ''],
    ['pay_canonical_url', summary.pay.canonicalUrl || ''],
    ['pay_og_url', summary.pay.ogUrl || ''],
    ['pay_looks_like_main_site', summary.pay.looksLikeMainSite || ''],
    ['pay_root_marker_match', summary.pay.rootMarkerMatch || ''],
    ['pay_diagnosis', summary.pay.diagnosis],
    ['finding_count', String(summary.findings.length)],
    ['findings', summary.findings.length > 0 ? summary.findings.join(' | ') : 'none'],
    ['recommended_actions', summary.recommendedActions.join(' | ')],
  ];

  for (const [key, value] of lines) {
    console.log(`${key}=${value}`);
  }
}

async function writeSummaryFile(summary: DiagnosisSummary) {
  if (!summary.reportFile) {
    return '';
  }

  const resolved = summary.reportFile;
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return resolved;
}

function resolveOutFile(outFile: string) {
  const resolved = resolve(process.cwd(), outFile);
  return resolved;
}

async function main() {
  const { baseUrl, payHost, mainSiteHost, reportOnly, outputMode, outFile } = parseArgs();

  const [mainApiHealth, mainApiReady, payRoot, payHealth, payApiHealth, frontendProbe, frontendManifestProbe, payProbe] = await Promise.all([
    requestText(`${baseUrl}/api/health`),
    requestText(`${baseUrl}/api/ready`),
    requestText(`https://${payHost}/`, { allowInvalidTls: true }),
    requestText(`https://${payHost}/health`, { allowInvalidTls: true }),
    requestText(`https://${payHost}/api/health`, { allowInvalidTls: true }),
    runFrontendProbe(baseUrl),
    runFrontendManifestProbe(baseUrl),
    runPayDomainProbe(payHost, mainSiteHost),
  ]);

  const summary: DiagnosisSummary = {
    timestamp: new Date().toISOString(),
    baseUrl,
    mainSiteHost,
    payHost,
    main: {
      apiHealth: mainApiHealth,
      apiReady: mainApiReady,
      diagnosis: 'ok',
    },
    frontend: {
      probeOk: frontendProbe.ok,
      probeError: frontendProbe.error,
      remoteRootStatus: frontendProbe.values.remote_root_status || '',
      remoteBundle: frontendProbe.values.remote_bundle || '',
      localBundle: frontendProbe.values.local_bundle || '',
      bundleMatch: frontendProbe.values.bundle_match || '',
      remoteLegacyHashMarkers: frontendProbe.values.remote_legacy_hash_markers || '',
      searchTargetMatch: frontendProbe.values.search_target_match || '',
      assetReferenceMatch: frontendProbe.values.asset_reference_match || '',
      assetContentMatch: frontendProbe.values.asset_content_match || '',
      missingOrMismatchedAssets: frontendProbe.values.missing_or_mismatched_assets || '',
      manifestChecked: frontendManifestProbe.values.remote_manifest_checked || '',
      manifestMatch: frontendManifestProbe.values.remote_manifest_match || '',
      manifestError: frontendManifestProbe.values.remote_manifest_error || frontendManifestProbe.error || '',
      manifestDistHash: frontendManifestProbe.values.dist_hash || '',
      diagnosis: 'ok',
    },
    pay: {
      root: payRoot,
      health: payHealth,
      apiHealth: payApiHealth,
      probeOk: payProbe.ok,
      probeError: payProbe.error,
      tlsStatus: payProbe.values.tls_status || '',
      certCn: payProbe.values.cert_cn || '',
      certSan: payProbe.values.cert_san || '',
      htmlStatus: payProbe.values.html_status || '',
      looksLikeMainSite: payProbe.values.looks_like_main_site || '',
      rootMarkerMatch: payProbe.values.root_marker_match || '',
      canonicalUrl: payProbe.values.canonical_url || '',
      ogUrl: payProbe.values.og_url || '',
      diagnosis: 'ok',
    },
    findings: [],
    recommendedActions: [],
  };

  summary.main.diagnosis = diagnoseMain(summary.main);
  summary.frontend.diagnosis = diagnoseFrontend(summary.frontend);
  summary.pay.diagnosis = diagnosePay(summary.pay);
  summary.findings = collectFindings(summary);
  summary.recommendedActions = collectRecommendedActions(summary);

  if (outFile) {
    summary.reportFile = resolveOutFile(outFile);
    await writeSummaryFile(summary);
  }

  if (outputMode === 'json') {
    console.log(JSON.stringify(summary, null, 2));
  } else if (outputMode === 'kv') {
    printKv(summary);
  } else {
    printText(summary);
  }

  if (summary.findings.length > 0 && !reportOnly) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[diagnose-public-prod] Unexpected error:', error);
  process.exitCode = 1;
});

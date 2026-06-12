// scripts/diagnose-public-prod.ts
import { execFile as execFileCallback } from "node:child_process";
import { setDefaultResultOrder } from "node:dns";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
var execFile = promisify(execFileCallback);
try {
  setDefaultResultOrder("ipv4first");
} catch {
}
function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = process.env.QIANFU_BASE_URL || process.env.SMOKE_BASE_URL || "https://mc-u.top";
  let payHost = process.env.PAY_DOMAIN_HOST || "pay.star-web.top";
  let mainSiteHost = process.env.PAY_MAIN_SITE_HOST || "";
  let reportOnly = false;
  let outputMode = "text";
  let outFile = process.env.PROD_DIAGNOSE_PUBLIC_OUT || "";
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--base" && args[index + 1]) {
      baseUrl = args[index + 1];
      index += 1;
      continue;
    }
    if (token === "--pay-host" && args[index + 1]) {
      payHost = args[index + 1];
      index += 1;
      continue;
    }
    if (token === "--main-site-host" && args[index + 1]) {
      mainSiteHost = args[index + 1];
      index += 1;
      continue;
    }
    if ((token === "--out" || token === "--out-file") && args[index + 1]) {
      outFile = args[index + 1];
      index += 1;
      continue;
    }
    if (token === "--report-only") {
      reportOnly = true;
      continue;
    }
    if (token === "--json") {
      outputMode = "json";
      continue;
    }
    if (token === "--kv") {
      outputMode = "kv";
    }
  }
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return {
    baseUrl: normalizedBaseUrl,
    payHost: extractHost(payHost),
    mainSiteHost: mainSiteHost ? extractHost(mainSiteHost) : extractHost(normalizedBaseUrl),
    reportOnly,
    outputMode,
    outFile
  };
}
function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}
function extractHost(value) {
  const normalized = value.trim();
  if (/^https?:\/\//i.test(normalized)) {
    return new URL(normalized).host;
  }
  return normalized.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}
function truncate(text, max = 200) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}
function createHttpProbe(url) {
  return {
    url,
    status: null,
    ok: false,
    contentType: "",
    bodyPreview: "",
    error: ""
  };
}
async function requestTextOnce(url, options) {
  const allowInvalidTls = options?.allowInvalidTls ?? false;
  const timeoutMs = options?.timeoutMs ?? 12e3;
  const redirectsLeft = options?.redirectsLeft ?? 5;
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const probe = createHttpProbe(url);
  return new Promise((resolve2) => {
    const request = transport.request(
      target,
      {
        method: "GET",
        timeout: timeoutMs,
        headers: {
          Accept: "application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent": "qianfu-public-diagnose/1.0"
        },
        ...target.protocol === "https:" ? { rejectUnauthorized: !allowInvalidTls } : {}
      },
      (response) => {
        const status = response.statusCode || null;
        const location = response.headers.location;
        if (status && status >= 300 && status < 400 && location && redirectsLeft > 0) {
          const nextUrl = new URL(location, target).toString();
          response.resume();
          request.destroy();
          requestText(nextUrl, { allowInvalidTls, timeoutMs, redirectsLeft: redirectsLeft - 1 }).then(resolve2);
          return;
        }
        const chunks = [];
        let capturedLength = 0;
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          if (capturedLength >= 16384) {
            return;
          }
          const remaining = 16384 - capturedLength;
          const slice = chunk.slice(0, remaining);
          chunks.push(slice);
          capturedLength += slice.length;
        });
        response.on("end", () => {
          const body = chunks.join("");
          resolve2({
            url,
            status,
            ok: status !== null && status >= 200 && status < 300,
            contentType: typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : "",
            bodyPreview: truncate(body),
            error: ""
          });
        });
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
    request.on("error", (error) => {
      resolve2({
        ...probe,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    request.end();
  });
}
async function requestText(url, options) {
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
async function runFrontendProbe(baseUrl) {
  const bundledProbePath = resolve(process.cwd(), "scripts", "prod-restore-runners", "probe-frontend-deploy.mjs");
  const tsxCliPath = resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  try {
    if (existsSync(bundledProbePath)) {
      const { stdout: stdout2 } = await execFile(
        process.execPath,
        [bundledProbePath, "--report-only", "--kv", "--base", baseUrl],
        {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024
        }
      );
      return {
        ok: true,
        error: "",
        values: parseKv(stdout2)
      };
    }
    if (!existsSync(tsxCliPath)) {
      throw new Error(`frontend probe runner not found at ${bundledProbePath}; tsx cli not found at ${tsxCliPath}`);
    }
    const { stdout } = await execFile(
      process.execPath,
      [tsxCliPath, "scripts/probe-frontend-deploy.ts", "--report-only", "--kv", "--base", baseUrl],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024
      }
    );
    return {
      ok: true,
      error: "",
      values: parseKv(stdout)
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout || "") : "";
    return {
      ok: false,
      error: stdout ? `${detail} | ${stdout}` : detail,
      values: {}
    };
  }
}
async function runPayDomainProbe(payHost, mainSiteHost) {
  try {
    const { stdout } = await execFile(
      process.execPath,
      ["scripts/utils/domain-cert-probe.mjs", "--host", payHost, "--expect-host", payHost, "--main-site-host", mainSiteHost],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024
      }
    );
    return {
      ok: true,
      error: "",
      values: parseKv(stdout)
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout || "") : "";
    return {
      ok: false,
      error: stdout ? `${detail} | ${stdout}` : detail,
      values: parseKv(stdout)
    };
  }
}
async function runFrontendManifestProbe(baseUrl) {
  try {
    const { stdout } = await execFile(
      process.execPath,
      ["scripts/frontend-dist-manifest.mjs", "--check-remote", baseUrl, "--report-only", "--kv"],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024
      }
    );
    return {
      ok: true,
      error: "",
      values: parseKv(stdout)
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout || "") : "";
    return {
      ok: false,
      error: stdout ? `${detail} | ${stdout}` : detail,
      values: parseKv(stdout)
    };
  }
}
function parseKv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    values[key] = value;
  }
  return values;
}
function diagnoseMain(main2) {
  if (main2.apiHealth.status === 502 || main2.apiReady.status === 502) {
    return "static_html_likely_alive_but_api_edge_broken";
  }
  if (!main2.apiHealth.ok && !main2.apiReady.ok) {
    return "main_api_unreachable";
  }
  return "ok";
}
function diagnoseFrontend(frontend) {
  if (!frontend.probeOk) {
    return "frontend_probe_failed";
  }
  if (frontend.bundleMatch === "false") {
    return "stale_bundle";
  }
  if (frontend.assetReferenceMatch === "false") {
    return "stale_asset_references";
  }
  if (frontend.assetContentMatch === "false") {
    return "stale_or_missing_assets";
  }
  if (frontend.manifestChecked === "true" && frontend.manifestMatch === "false") {
    return "dist_manifest_mismatch";
  }
  if (frontend.remoteLegacyHashMarkers && frontend.remoteLegacyHashMarkers !== "none") {
    return "legacy_hash_markers_present";
  }
  if (frontend.searchTargetMatch === "false") {
    return "search_target_stale";
  }
  if (frontend.remoteRootStatus && frontend.remoteRootStatus !== "200") {
    return "frontend_root_not_200";
  }
  return "ok";
}
function diagnosePay(pay) {
  if (!pay.probeOk) {
    return "pay_probe_failed";
  }
  if (pay.tlsStatus === "wrong_principal" && pay.looksLikeMainSite === "true") {
    return "main_site_tls_vhost_fallback";
  }
  if (pay.tlsStatus === "wrong_principal") {
    return "wrong_certificate_principal";
  }
  if (pay.looksLikeMainSite === "true") {
    return "main_site_html_fallback";
  }
  if (pay.rootMarkerMatch !== "true") {
    return "pay_root_marker_missing";
  }
  if (pay.health.status === 502 || pay.apiHealth.status === 502) {
    return "pay_upstream_broken";
  }
  return "ok";
}
function collectFindings(summary) {
  const findings = [];
  if (summary.main.diagnosis === "static_html_likely_alive_but_api_edge_broken") {
    findings.push("\u4E3B\u7AD9\u66F4\u50CF\u662F\u9759\u6001\u6839\u9875\u8FD8\u6D3B\u7740\uFF0C\u4F46 /api \u8FB9\u7F18\u6216\u4E0A\u6E38\u8FDB\u7A0B\u4ECD\u7136\u635F\u574F\u3002");
  } else if (summary.main.diagnosis !== "ok") {
    findings.push("\u4E3B\u7AD9 API \u76EE\u524D\u4E0D\u53EF\u7528\u6216\u65E0\u6CD5\u7A33\u5B9A\u8BBF\u95EE\u3002");
  }
  if (summary.frontend.diagnosis === "stale_bundle") {
    findings.push(`\u4E3B\u7AD9\u524D\u7AEF\u4ECD\u5728\u4F7F\u7528\u65E7 bundle\uFF1Aremote=${summary.frontend.remoteBundle || "unknown"} local=${summary.frontend.localBundle || "unknown"}\u3002`);
  } else if (summary.frontend.diagnosis === "stale_asset_references") {
    findings.push("\u4E3B\u7AD9\u524D\u7AEF\u5165\u53E3\u8D44\u6E90\u6E05\u5355\u4E0E\u672C\u5730 dist \u4E0D\u4E00\u81F4\uFF0C\u7EBF\u4E0A HTML \u4ECD\u53EF\u80FD\u5F15\u7528\u65E7 JS/CSS\u3002");
  } else if (summary.frontend.diagnosis === "stale_or_missing_assets") {
    findings.push(`\u4E3B\u7AD9\u524D\u7AEF\u9759\u6001\u8D44\u6E90\u5185\u5BB9\u4E0E\u672C\u5730 dist \u4E0D\u4E00\u81F4\u6216\u7F3A\u5931\uFF1A${summary.frontend.missingOrMismatchedAssets || "unknown"}\u3002`);
  } else if (summary.frontend.diagnosis === "dist_manifest_mismatch") {
    findings.push(`\u4E3B\u7AD9\u524D\u7AEF dist manifest \u4E0E\u672C\u5730\u6784\u5EFA\u4E0D\u4E00\u81F4\u6216\u672A\u90E8\u7F72\uFF1A${summary.frontend.manifestError || "manifest mismatch"}\u3002`);
  } else if (summary.frontend.diagnosis === "legacy_hash_markers_present") {
    findings.push(`\u4E3B\u7AD9\u524D\u7AEF HTML \u4ECD\u6B8B\u7559\u65E7 hash \u8DEF\u7531\u6807\u8BB0\uFF1A${summary.frontend.remoteLegacyHashMarkers}\u3002`);
  } else if (summary.frontend.diagnosis === "search_target_stale") {
    findings.push("\u4E3B\u7AD9 SearchAction target \u4ECD\u4E0E\u672C\u5730\u6784\u5EFA\u4E0D\u4E00\u81F4\u3002");
  } else if (summary.frontend.diagnosis === "frontend_probe_failed") {
    findings.push(`\u4E3B\u7AD9\u524D\u7AEF freshness \u63A2\u9488\u6267\u884C\u5931\u8D25\uFF1A${summary.frontend.probeError}`);
  }
  if (summary.frontend.manifestChecked === "true" && summary.frontend.manifestMatch === "false" && summary.frontend.diagnosis !== "dist_manifest_mismatch") {
    findings.push(`\u4E3B\u7AD9\u524D\u7AEF dist manifest \u672A\u90E8\u7F72\u6216\u4E0E\u672C\u5730\u4E0D\u4E00\u81F4\uFF1A${summary.frontend.manifestError || "manifest mismatch"}\u3002`);
  }
  if (summary.pay.diagnosis === "main_site_tls_vhost_fallback") {
    findings.push(`\u652F\u4ED8\u57DF ${summary.pay.apiHealth.url.replace(/\/api\/health$/, "")} \u5F88\u53EF\u80FD\u843D\u5230\u4E86\u4E3B\u7AD9 TLS/vhost\uFF0C\u800C\u4E0D\u662F\u72EC\u7ACB\u652F\u4ED8\u7AD9\u70B9\u3002`);
  } else if (summary.pay.diagnosis === "wrong_certificate_principal") {
    findings.push(`\u652F\u4ED8\u57DF\u8BC1\u4E66\u4E3B\u4F53\u4E0D\u5339\u914D\uFF1ACN=${summary.pay.certCn || "unknown"} SAN=${summary.pay.certSan || "unknown"}\u3002`);
  } else if (summary.pay.diagnosis === "main_site_html_fallback") {
    findings.push("\u652F\u4ED8\u57DF\u6839\u8DEF\u5F84\u8FD4\u56DE\u7684 HTML \u5F88\u50CF\u4E3B\u7AD9\uFF0C\u800C\u4E0D\u662F\u652F\u4ED8\u7AD9\u70B9\u3002");
  } else if (summary.pay.diagnosis === "pay_root_marker_missing") {
    findings.push("\u652F\u4ED8\u57DF\u6839\u8DEF\u5F84\u6CA1\u6709\u8FD4\u56DE qianfu-pay-gateway \u6807\u8BB0\u3002");
  } else if (summary.pay.diagnosis === "pay_upstream_broken") {
    findings.push("\u652F\u4ED8\u57DF\u5065\u5EB7\u68C0\u67E5\u4ECD\u7136\u662F 502\uFF0C\u66F4\u50CF\u662F\u652F\u4ED8\u7AD9\u70B9 upstream \u8FD8\u6CA1\u6062\u590D\u3002");
  } else if (summary.pay.diagnosis === "pay_probe_failed") {
    findings.push(`\u652F\u4ED8\u57DF\u63A2\u9488\u6267\u884C\u5931\u8D25\uFF1A${summary.pay.probeError}`);
  }
  return findings;
}
function collectRecommendedActions(summary) {
  const actions = [];
  if (summary.main.diagnosis === "static_html_likely_alive_but_api_edge_broken") {
    actions.push("\u4E3B\u7AD9\u4E0B\u4E00\u6B65\uFF1A\u5728\u751F\u4EA7\u673A\u68C0\u67E5 pm2 qianfu-api\u3001API_PORT/PORT\u3001ss -lntp \u548C Nginx /api upstream\uFF0C\u5148\u8BA9 127.0.0.1:3000/api/health \u4E0E\u516C\u7F51 /api/health \u53D8\u7EFF\u3002");
  } else if (summary.main.diagnosis === "main_api_unreachable") {
    actions.push("\u4E3B\u7AD9\u4E0B\u4E00\u6B65\uFF1A\u5148\u6062\u590D Node API \u8FDB\u7A0B\u548C\u672C\u673A\u5065\u5EB7\u68C0\u67E5\uFF0C\u518D reload Nginx\uFF1B\u4E0D\u8981\u53EA\u66FF\u6362\u9759\u6001\u524D\u7AEF\u3002");
  }
  if (summary.frontend.diagnosis === "stale_bundle") {
    actions.push(`\u524D\u7AEF\u4E0B\u4E00\u6B65\uFF1A\u91CD\u65B0\u6267\u884C npm run build \u5E76\u90E8\u7F72 qianfu-liandeng/dist\uFF0C\u786E\u8BA4\u7EBF\u4E0A\u5165\u53E3\u4ECE ${summary.frontend.remoteBundle || "unknown"} \u66F4\u65B0\u4E3A ${summary.frontend.localBundle || "\u5F53\u524D\u672C\u5730 bundle"}\u3002`);
  } else if (summary.frontend.diagnosis === "stale_asset_references" || summary.frontend.diagnosis === "stale_or_missing_assets") {
    actions.push("\u524D\u7AEF\u4E0B\u4E00\u6B65\uFF1A\u91CD\u65B0\u53D1\u5E03\u5B8C\u6574 qianfu-liandeng/dist \u76EE\u5F55\uFF0C\u4E0D\u8981\u53EA\u66FF\u6362 index.html\uFF1B\u53D1\u5E03\u540E\u7528 probe:frontend-deploy \u786E\u8BA4\u5165\u53E3\u8D44\u6E90\u6E05\u5355\u548C SHA-256 \u5185\u5BB9\u90FD\u4E0E\u672C\u5730 dist \u4E00\u81F4\u3002");
  } else if (summary.frontend.diagnosis === "dist_manifest_mismatch") {
    actions.push("\u524D\u7AEF\u4E0B\u4E00\u6B65\uFF1A\u4F7F\u7528 scripts/linux/deploy-frontend-dist.sh \u539F\u5B50\u53D1\u5E03\u5B8C\u6574 dist\uFF0C\u786E\u8BA4 /qianfu-dist-manifest.json \u8FD4\u56DE JSON \u4E14 dist_hash \u4E0E\u672C\u5730\u4E00\u81F4\u3002");
  } else if (summary.frontend.diagnosis === "legacy_hash_markers_present" || summary.frontend.diagnosis === "search_target_stale") {
    actions.push("\u524D\u7AEF\u4E0B\u4E00\u6B65\uFF1A\u91CD\u65B0\u90E8\u7F72\u5F53\u524D dist/index.html\uFF0C\u786E\u8BA4\u65E7 #/search/#/servers/#/resources SEO \u6807\u8BB0\u548C SearchAction target \u5DF2\u88AB\u65B0\u6784\u5EFA\u66FF\u6362\u3002");
  } else if (summary.frontend.diagnosis === "frontend_probe_failed") {
    actions.push("\u524D\u7AEF\u4E0B\u4E00\u6B65\uFF1A\u5148\u4FEE\u590D probe:frontend-deploy \u8FD0\u884C\u73AF\u5883\u6216\u7F51\u7EDC\u8BBF\u95EE\uFF0C\u518D\u5224\u65AD\u9759\u6001\u524D\u7AEF\u662F\u5426\u5DF2\u66F4\u65B0\u3002");
  }
  if (summary.frontend.manifestChecked === "true" && summary.frontend.manifestMatch === "false" && !actions.some((action) => action.includes("qianfu-dist-manifest.json"))) {
    actions.push("\u524D\u7AEF\u6574\u5305\u9A8C\u6536\u4E0B\u4E00\u6B65\uFF1A\u4F7F\u7528 scripts/linux/deploy-frontend-dist.sh \u539F\u5B50\u53D1\u5E03\u5B8C\u6574 dist\uFF0C\u786E\u8BA4 /qianfu-dist-manifest.json \u8FD4\u56DE JSON \u4E14 dist_hash \u4E0E\u672C\u5730\u4E00\u81F4\u3002");
  }
  if (summary.pay.diagnosis === "main_site_tls_vhost_fallback") {
    actions.push("\u652F\u4ED8\u57DF\u4E0B\u4E00\u6B65\uFF1A\u4FEE\u590D pay.star-web.top \u7684 Nginx server_name \u4E0E\u8BC1\u4E66\u7ED1\u5B9A\uFF0C\u786E\u4FDD\u8BC1\u4E66\u6765\u81EA /etc/letsencrypt/live/pay.star-web.top/\uFF0C\u6839\u8DEF\u5F84\u8FD4\u56DE qianfu-pay-gateway \u800C\u4E0D\u662F mc-u.top HTML\u3002");
  } else if (summary.pay.diagnosis === "wrong_certificate_principal") {
    actions.push("\u652F\u4ED8\u57DF\u4E0B\u4E00\u6B65\uFF1A\u91CD\u65B0\u7B7E\u53D1\u6216\u7ED1\u5B9A pay.star-web.top \u8BC1\u4E66\uFF0C\u5E76\u7528 openssl s_client -servername pay.star-web.top \u9A8C\u8BC1 SAN\u3002");
  } else if (summary.pay.diagnosis === "main_site_html_fallback" || summary.pay.diagnosis === "pay_root_marker_missing") {
    actions.push("\u652F\u4ED8\u57DF\u4E0B\u4E00\u6B65\uFF1A\u68C0\u67E5 pay.star-web.top \u7684 443 vhost \u662F\u5426\u547D\u4E2D\u652F\u4ED8\u7AD9\u70B9\u5757\uFF0C\u786E\u8BA4 / \u8FD4\u56DE qianfu-pay-gateway \u6807\u8BB0\u3002");
  } else if (summary.pay.diagnosis === "pay_upstream_broken") {
    actions.push("\u652F\u4ED8\u57DF\u4E0B\u4E00\u6B65\uFF1A\u68C0\u67E5\u652F\u4ED8\u57DF /health \u4E0E /api/health \u7684 upstream\uFF0C\u786E\u8BA4 127.0.0.1:3000 \u548C XPay \u7AEF\u53E3\u6309\u6A21\u677F\u53EF\u8FBE\u3002");
  } else if (summary.pay.diagnosis === "pay_probe_failed") {
    actions.push("\u652F\u4ED8\u57DF\u4E0B\u4E00\u6B65\uFF1A\u5148\u4FEE\u590D domain-cert-probe \u8FD0\u884C\u73AF\u5883\u6216 DNS/TLS \u8BBF\u95EE\uFF0C\u518D\u5224\u65AD vhost \u662F\u5426\u6062\u590D\u3002");
  }
  if (actions.length === 0) {
    actions.push("\u65E0\u9700\u989D\u5916\u52A8\u4F5C\uFF1A\u5F53\u524D\u516C\u7F51\u63A2\u9488\u672A\u53D1\u73B0\u4E3B\u7AD9 API\u3001\u524D\u7AEF freshness \u6216\u652F\u4ED8\u57DF TLS/vhost \u95EE\u9898\u3002");
  }
  return actions;
}
function printText(summary) {
  console.log(`timestamp=${summary.timestamp}`);
  if (summary.reportFile) {
    console.log(`report file: ${summary.reportFile}`);
  }
  console.log("");
  console.log("== Main site ==");
  console.log(`root status (from frontend probe): ${summary.frontend.remoteRootStatus || "unknown"}`);
  console.log(`api health: ${formatHttpProbe(summary.main.apiHealth)}`);
  console.log(`api ready: ${formatHttpProbe(summary.main.apiReady)}`);
  console.log(`diagnosis: ${summary.main.diagnosis}`);
  console.log("");
  console.log("== Frontend ==");
  console.log(`bundle match: ${summary.frontend.bundleMatch || "unknown"}`);
  console.log(`remote bundle: ${summary.frontend.remoteBundle || "unknown"}`);
  console.log(`local bundle: ${summary.frontend.localBundle || "unknown"}`);
  console.log(`legacy hash markers: ${summary.frontend.remoteLegacyHashMarkers || "unknown"}`);
  console.log(`search target match: ${summary.frontend.searchTargetMatch || "unknown"}`);
  console.log(`asset refs match: ${summary.frontend.assetReferenceMatch || "unknown"}`);
  console.log(`asset content match: ${summary.frontend.assetContentMatch || "unknown"}`);
  console.log(`missing/mismatched assets: ${summary.frontend.missingOrMismatchedAssets || "unknown"}`);
  console.log(`manifest checked: ${summary.frontend.manifestChecked || "unknown"}`);
  console.log(`manifest match: ${summary.frontend.manifestMatch || "unknown"}`);
  console.log(`manifest error: ${summary.frontend.manifestError || "none"}`);
  console.log(`manifest dist hash: ${summary.frontend.manifestDistHash || "unknown"}`);
  console.log(`diagnosis: ${summary.frontend.diagnosis}`);
  console.log("");
  console.log("== Pay domain ==");
  console.log(`root: ${formatHttpProbe(summary.pay.root)}`);
  console.log(`health: ${formatHttpProbe(summary.pay.health)}`);
  console.log(`api health: ${formatHttpProbe(summary.pay.apiHealth)}`);
  console.log(`tls status: ${summary.pay.tlsStatus || "unknown"}`);
  console.log(`cert cn: ${summary.pay.certCn || "unknown"}`);
  console.log(`looks like main site: ${summary.pay.looksLikeMainSite || "unknown"}`);
  console.log(`root marker match: ${summary.pay.rootMarkerMatch || "unknown"}`);
  console.log(`diagnosis: ${summary.pay.diagnosis}`);
  console.log("");
  console.log("== Findings ==");
  if (summary.findings.length === 0) {
    console.log("PASS: no public production issues detected by this probe set");
  } else {
    for (const finding of summary.findings) {
      console.log(`FAIL: ${finding}`);
    }
  }
  console.log("");
  console.log("== Recommended actions ==");
  for (const action of summary.recommendedActions) {
    console.log(`NEXT: ${action}`);
  }
}
function formatHttpProbe(probe) {
  if (probe.status !== null) {
    return `HTTP ${probe.status}${probe.bodyPreview ? `; body=${probe.bodyPreview}` : ""}`;
  }
  if (probe.error) {
    return `ERR ${probe.error}`;
  }
  return "unknown";
}
function printKv(summary) {
  const lines = [
    ["timestamp", summary.timestamp],
    ["report_file", summary.reportFile || ""],
    ["base_url", summary.baseUrl],
    ["main_site_host", summary.mainSiteHost],
    ["pay_host", summary.payHost],
    ["main_root_status", summary.frontend.remoteRootStatus || ""],
    ["main_api_health_status", summary.main.apiHealth.status === null ? "" : String(summary.main.apiHealth.status)],
    ["main_api_ready_status", summary.main.apiReady.status === null ? "" : String(summary.main.apiReady.status)],
    ["main_diagnosis", summary.main.diagnosis],
    ["frontend_bundle_match", summary.frontend.bundleMatch || ""],
    ["frontend_remote_bundle", summary.frontend.remoteBundle || ""],
    ["frontend_local_bundle", summary.frontend.localBundle || ""],
    ["frontend_legacy_hash_markers", summary.frontend.remoteLegacyHashMarkers || ""],
    ["frontend_search_target_match", summary.frontend.searchTargetMatch || ""],
    ["frontend_asset_reference_match", summary.frontend.assetReferenceMatch || ""],
    ["frontend_asset_content_match", summary.frontend.assetContentMatch || ""],
    ["frontend_missing_or_mismatched_assets", summary.frontend.missingOrMismatchedAssets || ""],
    ["frontend_manifest_checked", summary.frontend.manifestChecked || ""],
    ["frontend_manifest_match", summary.frontend.manifestMatch || ""],
    ["frontend_manifest_error", summary.frontend.manifestError || ""],
    ["frontend_manifest_dist_hash", summary.frontend.manifestDistHash || ""],
    ["frontend_diagnosis", summary.frontend.diagnosis],
    ["pay_root_status", summary.pay.root.status === null ? "" : String(summary.pay.root.status)],
    ["pay_health_status", summary.pay.health.status === null ? "" : String(summary.pay.health.status)],
    ["pay_api_health_status", summary.pay.apiHealth.status === null ? "" : String(summary.pay.apiHealth.status)],
    ["pay_tls_status", summary.pay.tlsStatus || ""],
    ["pay_cert_cn", summary.pay.certCn || ""],
    ["pay_cert_san", summary.pay.certSan || ""],
    ["pay_html_status", summary.pay.htmlStatus || ""],
    ["pay_canonical_url", summary.pay.canonicalUrl || ""],
    ["pay_og_url", summary.pay.ogUrl || ""],
    ["pay_looks_like_main_site", summary.pay.looksLikeMainSite || ""],
    ["pay_root_marker_match", summary.pay.rootMarkerMatch || ""],
    ["pay_diagnosis", summary.pay.diagnosis],
    ["finding_count", String(summary.findings.length)],
    ["findings", summary.findings.length > 0 ? summary.findings.join(" | ") : "none"],
    ["recommended_actions", summary.recommendedActions.join(" | ")]
  ];
  for (const [key, value] of lines) {
    console.log(`${key}=${value}`);
  }
}
async function writeSummaryFile(summary) {
  if (!summary.reportFile) {
    return "";
  }
  const resolved = summary.reportFile;
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(summary, null, 2)}
`, "utf8");
  return resolved;
}
function resolveOutFile(outFile) {
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
    runPayDomainProbe(payHost, mainSiteHost)
  ]);
  const summary = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    baseUrl,
    mainSiteHost,
    payHost,
    main: {
      apiHealth: mainApiHealth,
      apiReady: mainApiReady,
      diagnosis: "ok"
    },
    frontend: {
      probeOk: frontendProbe.ok,
      probeError: frontendProbe.error,
      remoteRootStatus: frontendProbe.values.remote_root_status || "",
      remoteBundle: frontendProbe.values.remote_bundle || "",
      localBundle: frontendProbe.values.local_bundle || "",
      bundleMatch: frontendProbe.values.bundle_match || "",
      remoteLegacyHashMarkers: frontendProbe.values.remote_legacy_hash_markers || "",
      searchTargetMatch: frontendProbe.values.search_target_match || "",
      assetReferenceMatch: frontendProbe.values.asset_reference_match || "",
      assetContentMatch: frontendProbe.values.asset_content_match || "",
      missingOrMismatchedAssets: frontendProbe.values.missing_or_mismatched_assets || "",
      manifestChecked: frontendManifestProbe.values.remote_manifest_checked || "",
      manifestMatch: frontendManifestProbe.values.remote_manifest_match || "",
      manifestError: frontendManifestProbe.values.remote_manifest_error || frontendManifestProbe.error || "",
      manifestDistHash: frontendManifestProbe.values.dist_hash || "",
      diagnosis: "ok"
    },
    pay: {
      root: payRoot,
      health: payHealth,
      apiHealth: payApiHealth,
      probeOk: payProbe.ok,
      probeError: payProbe.error,
      tlsStatus: payProbe.values.tls_status || "",
      certCn: payProbe.values.cert_cn || "",
      certSan: payProbe.values.cert_san || "",
      htmlStatus: payProbe.values.html_status || "",
      looksLikeMainSite: payProbe.values.looks_like_main_site || "",
      rootMarkerMatch: payProbe.values.root_marker_match || "",
      canonicalUrl: payProbe.values.canonical_url || "",
      ogUrl: payProbe.values.og_url || "",
      diagnosis: "ok"
    },
    findings: [],
    recommendedActions: []
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
  if (outputMode === "json") {
    console.log(JSON.stringify(summary, null, 2));
  } else if (outputMode === "kv") {
    printKv(summary);
  } else {
    printText(summary);
  }
  if (summary.findings.length > 0 && !reportOnly) {
    process.exitCode = 1;
  }
}
main().catch((error) => {
  console.error("[diagnose-public-prod] Unexpected error:", error);
  process.exitCode = 1;
});

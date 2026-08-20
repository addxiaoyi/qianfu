const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = process.env.QA_BASE_URL || process.env.QIANFU_BASE_URL || 'https://mc-u.top';
  let payUrl = process.env.QA_PAY_URL || `https://${process.env.PAY_DOMAIN_HOST || 'pay.star-web.top'}`;
  let outDir = '';
  let outputMode = 'json';
  let reportOnly = false;
  let navTimeoutMs = process.env.PUBLIC_BROWSER_AUDIT_NAV_TIMEOUT_MS || process.env.BROWSER_AUDIT_NAV_TIMEOUT_MS || '15000';
  let domReadyTimeoutMs = process.env.PUBLIC_BROWSER_AUDIT_DOM_READY_TIMEOUT_MS || process.env.BROWSER_AUDIT_DOM_READY_TIMEOUT_MS || '5000';
  let routeReadyTimeoutMs = process.env.PUBLIC_BROWSER_AUDIT_ROUTE_READY_TIMEOUT_MS || process.env.BROWSER_AUDIT_ROUTE_READY_TIMEOUT_MS || '8000';
  let interactionTimeoutMs = process.env.PUBLIC_BROWSER_AUDIT_INTERACTION_TIMEOUT_MS || process.env.BROWSER_AUDIT_INTERACTION_TIMEOUT_MS || '3000';
  let stableWaitMs = process.env.PUBLIC_BROWSER_AUDIT_STABLE_WAIT_MS || process.env.BROWSER_AUDIT_STABLE_WAIT_MS || '1000';
  let waitUntil = process.env.PUBLIC_BROWSER_AUDIT_WAIT_UNTIL || process.env.BROWSER_AUDIT_WAIT_UNTIL || 'commit';
  let concurrency = process.env.PUBLIC_BROWSER_AUDIT_CONCURRENCY || process.env.BROWSER_AUDIT_CONCURRENCY || '3';
  let useSystemProxy = /^(1|true|yes)$/i.test(process.env.PUBLIC_BROWSER_AUDIT_USE_SYSTEM_PROXY || '');
  const includePay = /^(1|true|yes)$/i.test(process.env.PUBLIC_BROWSER_AUDIT_INCLUDE_PAY || '');
  let skipPay = !includePay || /^(1|true|yes)$/i.test(process.env.PUBLIC_BROWSER_AUDIT_SKIP_PAY || '');
  let executablePath = process.env.PUBLIC_BROWSER_AUDIT_EXECUTABLE_PATH || '';
  let hostResolverRules = process.env.PUBLIC_BROWSER_AUDIT_HOST_RESOLVER_RULES || '';

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--base' && args[index + 1]) {
      baseUrl = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--pay-url' && args[index + 1]) {
      payUrl = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--pay-host' && args[index + 1]) {
      payUrl = `https://${args[index + 1]}`;
      index += 1;
      continue;
    }
    if (token === '--out-dir' && args[index + 1]) {
      outDir = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--nav-timeout-ms' && args[index + 1]) {
      navTimeoutMs = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--dom-ready-timeout-ms' && args[index + 1]) {
      domReadyTimeoutMs = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--route-ready-timeout-ms' && args[index + 1]) {
      routeReadyTimeoutMs = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--interaction-timeout-ms' && args[index + 1]) {
      interactionTimeoutMs = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--stable-wait-ms' && args[index + 1]) {
      stableWaitMs = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--wait-until' && args[index + 1]) {
      waitUntil = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--concurrency' && args[index + 1]) {
      concurrency = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--use-system-proxy') {
      useSystemProxy = true;
      continue;
    }
    if (token === '--direct-proxy') {
      useSystemProxy = false;
      continue;
    }
    if (token === '--executable-path' && args[index + 1]) {
      executablePath = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--host-resolver-rules' && args[index + 1]) {
      hostResolverRules = args[index + 1];
      index += 1;
      continue;
    }
    if (token === '--skip-pay') {
      skipPay = true;
      continue;
    }
    if (token === '--include-pay') {
      skipPay = false;
      continue;
    }
    if (token === '--kv') {
      outputMode = 'kv';
      continue;
    }
    if (token === '--json-summary') {
      outputMode = 'json-summary';
      continue;
    }
    if (token === '--report-only') {
      reportOnly = true;
    }
  }

  return {
    baseUrl,
    payUrl,
    outDir,
    outputMode,
    reportOnly,
    navTimeoutMs,
    domReadyTimeoutMs,
    routeReadyTimeoutMs,
    interactionTimeoutMs,
    stableWaitMs,
    waitUntil,
    concurrency,
    useSystemProxy,
    skipPay,
    executablePath,
    hostResolverRules,
  };
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function parseWaitUntil(value) {
  const normalized = String(value || '').toLowerCase();
  return ['commit', 'domcontentloaded', 'load', 'networkidle'].includes(normalized) ? normalized : 'commit';
}

const CLI = parseArgs();
const BASE_URL = String(CLI.baseUrl).replace(/\/+$/, '');
const PAY_URL = String(CLI.payUrl).replace(/\/+$/, '');
const NAV_TIMEOUT_MS = parsePositiveInt(CLI.navTimeoutMs, 15000);
const DOM_READY_TIMEOUT_MS = parsePositiveInt(CLI.domReadyTimeoutMs, 5000);
const ROUTE_READY_TIMEOUT_MS = parsePositiveInt(CLI.routeReadyTimeoutMs, 8000);
const INTERACTION_TIMEOUT_MS = parsePositiveInt(CLI.interactionTimeoutMs, 3000);
const STABLE_WAIT_MS = parsePositiveInt(CLI.stableWaitMs, 1000);
const WAIT_UNTIL = parseWaitUntil(CLI.waitUntil);
const CONCURRENCY = Math.min(parsePositiveInt(CLI.concurrency, 3), 12);
const CHROMIUM_DIRECT_PROXY_ARGS = ['--proxy-server=direct://', '--proxy-bypass-list=*'];
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = CLI.outDir
  ? path.resolve(process.cwd(), CLI.outDir)
  : path.resolve(process.cwd(), 'output', 'playwright', `live-public-audit-${TS}`);

const BASE_ROUTES = [
  { label: 'home-history', url: `${BASE_URL}/`, expectText: '千服联灯', expectedTitleIncludes: 'Minecraft 服务器发现与发布平台' },
  { label: 'servers-history', url: `${BASE_URL}/servers`, expectText: '服务器', expectedTitleIncludes: '服务器' },
  { label: 'search-history', url: `${BASE_URL}/search`, expectText: '搜索', expectedTitleIncludes: '搜索', interaction: 'search-input' },
  { label: 'resources-history', url: `${BASE_URL}/resources`, expectText: '资源', expectedTitleIncludes: '资源' },
  { label: 'home-mobile', url: `${BASE_URL}/`, expectText: '千服联灯', expectedTitleIncludes: 'Minecraft 服务器发现与发布平台', viewport: { width: 360, height: 780 }, checkHorizontalOverflow: true },
  { label: 'servers-mobile', url: `${BASE_URL}/servers`, expectText: '服务器', expectedTitleIncludes: '服务器', viewport: { width: 360, height: 780 }, checkHorizontalOverflow: true },
  { label: 'resources-mobile', url: `${BASE_URL}/resources`, expectText: '资源', expectedTitleIncludes: '资源', viewport: { width: 360, height: 780 }, checkHorizontalOverflow: true },
  { label: 'rules-history', url: `${BASE_URL}/rules`, expectText: '规则', expectedTitleIncludes: '规则' },
  { label: 'login-history', url: `${BASE_URL}/login`, minInputs: 2, expectedTitleIncludes: '登录' },
  { label: 'oauth-selection-history', url: `${BASE_URL}/login/oauth`, expectText: '第三方快捷登录', expectedTitleIncludes: '登录' },
  { label: 'register-history', url: `${BASE_URL}/register`, minInputs: 2, expectedTitleIncludes: '注册' },
  { label: 'forgot-history', url: `${BASE_URL}/forgot-password`, minInputs: 1, expectedTitleIncludes: '找回密码' },
  { label: 'reset-password-history', url: `${BASE_URL}/reset-password`, expectText: '重置密码', expectedTitleIncludes: '重置密码' },
  { label: 'verify-code-history', url: `${BASE_URL}/verify-code`, expectText: '邮箱验证', expectedTitleIncludes: '邮箱验证' },
  { label: 'terms-history', url: `${BASE_URL}/terms/`, expectText: '服务条款', expectedTitleIncludes: 'Terms of Service' },
  { label: 'privacy-history', url: `${BASE_URL}/privacy/`, expectText: '隐私声明', expectedTitleIncludes: 'Privacy Notice' },
  { label: 'compliance-history', url: `${BASE_URL}/compliance`, expectText: '合规与信息服务规则中心', expectedTitleIncludes: '合规与信息服务规则中心' },
  { label: 'dashboard-billing-history', url: `${BASE_URL}/dashboard/billing`, expectText: '该功能暂未开放', expectedTitleIncludes: '控制台' },
  { label: 'search-hash', url: `${BASE_URL}/#/search`, expectText: '搜索', expectedTitleIncludes: '搜索', interaction: 'search-input' },
  { label: 'servers-hash', url: `${BASE_URL}/#/servers`, expectText: '服务器', expectedTitleIncludes: '服务器' },
  { label: 'resources-hash', url: `${BASE_URL}/#/resources`, expectText: '资源', expectedTitleIncludes: '资源' },
  { label: 'pay-root', url: `${PAY_URL}/`, expectText: 'PERSONAL_FILING_DISABLED', expectExactBody: 'PERSONAL_FILING_DISABLED', expectedStatus: 410, allowHttpsErrorInspect: true },
];
const ROUTES = CLI.skipPay ? BASE_ROUTES.filter((route) => route.label !== 'pay-root') : BASE_ROUTES;

function shortText(value, max = 220) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitStable(page, ms = STABLE_WAIT_MS) {
  await page.waitForLoadState('domcontentloaded', { timeout: DOM_READY_TIMEOUT_MS });
  await page.waitForTimeout(ms);
}

async function gotoWithRetry(page, route) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await page.goto(route.url, { waitUntil: WAIT_UNTIL, timeout: NAV_TIMEOUT_MS });
      return { response, error: null, retries: attempt };
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await delay(1000);
      }
    }
  }

  return { response: null, error: lastError, retries: 1 };
}

function shouldTrackResponse(response) {
  const status = response.status();
  if (status < 400) {
    return false;
  }

  const request = response.request();
  const type = request.resourceType();
  return ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type);
}

function isAllowedAnonymousAuthProbe(entry) {
  if (entry.status !== 401 && entry.status !== 403) {
    return false;
  }

  try {
    return new Set(['/api/v1/profile', '/api/v1/session-profile']).has(new URL(entry.url).pathname);
  } catch {
    return false;
  }
}

function splitConsoleEntries(consoleEntries, allowedAuthProbeResponses) {
  const hasAllowedAuthProbe = allowedAuthProbeResponses.length > 0;
  const tracked = [];
  const ignored = [];

  for (const entry of consoleEntries) {
    const isAuthProbeConsoleNoise =
      entry.type === 'error' &&
      hasAllowedAuthProbe &&
      /Failed to load resource: the server responded with a status of (401|403)/i.test(entry.text);

    if (isAuthProbeConsoleNoise) {
      ignored.push(entry);
    } else {
      tracked.push(entry);
    }
  }

  return { tracked, ignored };
}

function isRouteReadyAtInspection(route, { bodyText, inputCount, interactionResult }) {
  if (route.interaction === 'search-input') {
    return Boolean(interactionResult?.ok) || inputCount > 0;
  }

  if (route.minInputs) {
    return inputCount >= route.minInputs;
  }

  const expectedText = route.expectExactBody || route.expectText;
  return !expectedText || bodyText.includes(expectedText);
}

function aggregateErrorResponses(results) {
  const counts = new Map();
  for (const result of results) {
    for (const response of result.errorResponses || []) {
      const key = `${response.status}|${response.url}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [status, url] = key.split('|');
      return { status: Number(status), url, count };
    })
    .sort((a, b) => b.count - a.count || a.status - b.status || a.url.localeCompare(b.url));
}

function buildSummary(results) {
  const completedLabels = new Set(results.map((result) => result.label));
  const hasFinding = (result, prefixOrValue) =>
    result.findings.some((finding) =>
      finding === prefixOrValue || finding.startsWith(prefixOrValue),
    );
  const failedRoutes = results
    .filter((result) => !result.ok)
    .map((result) => ({
      label: result.label,
      url: result.url,
      finalUrl: result.finalUrl,
      documentStatus: result.documentStatus,
      findings: result.findings,
    }));

  const titleMismatchRoutes = results
    .filter((result) => hasFinding(result, 'title_mismatch='))
    .map((result) => result.label);

  const documentFailureRoutes = results
    .filter((result) => hasFinding(result, 'document_status=') || hasFinding(result, 'navigation_error='))
    .map((result) => result.label);

  const routeNotReadyRoutes = results
    .filter((result) => hasFinding(result, 'route_ready_error='))
    .map((result) => result.label);

  const stableWaitWarningRoutes = results
    .filter((result) => result.warnings?.some((warning) => warning.startsWith('stable_wait_error=')))
    .map((result) => result.label);

  const emptyBodyRoutes = results
    .filter((result) => hasFinding(result, 'empty_body'))
    .map((result) => result.label);

  const resourceFailureRoutes = results
    .filter((result) => hasFinding(result, 'request_failures=') || hasFinding(result, 'error_responses='))
    .map((result) => result.label);

  const renderedTitleMismatchRoutes = results
    .filter((result) =>
      hasFinding(result, 'title_mismatch=') &&
      !hasFinding(result, 'empty_body') &&
      !hasFinding(result, 'route_ready_error=') &&
      !hasFinding(result, 'stable_wait_error=') &&
      !hasFinding(result, 'document_status=') &&
      !hasFinding(result, 'navigation_error='),
    )
    .map((result) => result.label);

  const certificateErrorRoutes = results
    .filter((result) => result.findings.some((finding) => finding === 'certificate_error_detected' || finding.includes('ERR_CERT')))
    .map((result) => result.label);

  const interactionFailures = results
    .filter((result) => hasFinding(result, 'interaction_failed='))
    .map((result) => result.label);

  const searchInteractionResults = results
    .filter((result) => result.interactionResult)
    .map((result) => ({
      label: result.label,
      ok: result.interactionResult.ok,
      detail: result.interactionResult.detail,
    }));

  const payRoot = results.find((result) => result.label === 'pay-root') || null;
  const commonErrorResponses = aggregateErrorResponses(results);
  const allowedAuthProbeResponses = results.reduce(
    (count, result) => count + (result.allowedAuthProbeResponses?.length || 0),
    0,
  );

  return {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    payUrl: PAY_URL,
    outDir: OUT_DIR,
    plannedTotal: ROUTES.length,
    completed: results.length,
    partial: results.length < ROUTES.length,
    missingRoutes: ROUTES.filter((route) => !completedLabels.has(route.label)).map((route) => route.label),
    options: {
      navTimeoutMs: NAV_TIMEOUT_MS,
      domReadyTimeoutMs: DOM_READY_TIMEOUT_MS,
      routeReadyTimeoutMs: ROUTE_READY_TIMEOUT_MS,
      interactionTimeoutMs: INTERACTION_TIMEOUT_MS,
      stableWaitMs: STABLE_WAIT_MS,
      waitUntil: WAIT_UNTIL,
      concurrency: CONCURRENCY,
    },
    total: results.length,
    failed: failedRoutes.length,
    failedRoutes,
    titleMismatchRoutes,
    renderedTitleMismatchRoutes,
    documentFailureRoutes,
    routeNotReadyRoutes,
    stableWaitWarningRoutes,
    emptyBodyRoutes,
    resourceFailureRoutes,
    certificateErrorRoutes,
    interactionFailures,
    searchInteractionResults,
    commonErrorResponses,
    allowedAuthProbeResponses,
    payRoot: payRoot
      ? {
          finalUrl: payRoot.finalUrl,
          title: payRoot.title,
          canonicalHref: payRoot.canonicalHref,
          ogUrl: payRoot.ogUrl,
          textSnippet: payRoot.textSnippet,
          certificateErrorDetected: payRoot.findings.includes('certificate_error_detected'),
          bodyMismatch: payRoot.findings.find((finding) => finding.startsWith('body_mismatch=')) || '',
        }
      : null,
    results,
  };
}

function printKv(summary, outFile) {
  const lines = [
    ['timestamp', summary.timestamp],
    ['base_url', summary.baseUrl],
    ['pay_url', summary.payUrl],
    ['out_dir', summary.outDir],
    ['out_file', outFile],
    ['planned_routes', String(summary.plannedTotal)],
    ['completed_routes', String(summary.completed)],
    ['partial_report', summary.partial ? 'true' : 'false'],
    ['missing_routes', summary.missingRoutes.length ? summary.missingRoutes.join(',') : 'none'],
    ['nav_timeout_ms', String(summary.options.navTimeoutMs)],
    ['dom_ready_timeout_ms', String(summary.options.domReadyTimeoutMs)],
    ['route_ready_timeout_ms', String(summary.options.routeReadyTimeoutMs)],
    ['interaction_timeout_ms', String(summary.options.interactionTimeoutMs)],
    ['stable_wait_ms', String(summary.options.stableWaitMs)],
    ['wait_until', summary.options.waitUntil],
    ['concurrency', String(summary.options.concurrency)],
    ['total_routes', String(summary.total)],
    ['failed_routes', String(summary.failed)],
    ['title_mismatch_routes', summary.titleMismatchRoutes.length ? summary.titleMismatchRoutes.join(',') : 'none'],
    ['rendered_title_mismatch_routes', summary.renderedTitleMismatchRoutes.length ? summary.renderedTitleMismatchRoutes.join(',') : 'none'],
    ['document_failure_routes', summary.documentFailureRoutes.length ? summary.documentFailureRoutes.join(',') : 'none'],
    ['route_not_ready_routes', summary.routeNotReadyRoutes.length ? summary.routeNotReadyRoutes.join(',') : 'none'],
    ['stable_wait_warning_routes', summary.stableWaitWarningRoutes.length ? summary.stableWaitWarningRoutes.join(',') : 'none'],
    ['empty_body_routes', summary.emptyBodyRoutes.length ? summary.emptyBodyRoutes.join(',') : 'none'],
    ['resource_failure_routes', summary.resourceFailureRoutes.length ? summary.resourceFailureRoutes.join(',') : 'none'],
    ['certificate_error_routes', summary.certificateErrorRoutes.length ? summary.certificateErrorRoutes.join(',') : 'none'],
    ['interaction_failure_routes', summary.interactionFailures.length ? summary.interactionFailures.join(',') : 'none'],
    ['search_interactions', summary.searchInteractionResults.length ? summary.searchInteractionResults.map((entry) => `${entry.label}:${entry.ok ? 'ok' : 'fail'}:${entry.detail}`).join('|') : 'none'],
    ['common_error_responses', summary.commonErrorResponses.length ? summary.commonErrorResponses.slice(0, 8).map((entry) => `${entry.status}:${entry.url}#${entry.count}`).join('|') : 'none'],
    ['allowed_auth_probe_responses', String(summary.allowedAuthProbeResponses || 0)],
    ['pay_root_final_url', summary.payRoot?.finalUrl || ''],
    ['pay_root_title', summary.payRoot?.title || ''],
    ['pay_root_canonical', summary.payRoot?.canonicalHref || ''],
    ['pay_root_og_url', summary.payRoot?.ogUrl || ''],
    ['pay_root_certificate_error', summary.payRoot?.certificateErrorDetected ? 'true' : 'false'],
    ['pay_root_body_mismatch', summary.payRoot?.bodyMismatch || ''],
  ];

  for (const [key, value] of lines) {
    console.log(`${key}=${value}`);
  }
}

async function inspectWithContext(context, route, findingsPrefix = []) {
  const page = await context.newPage();
  const consoleEntries = [];
  const requestFailures = [];
  const errorResponses = [];
  const allowedAuthProbeResponses = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleEntries.push({
        type,
        text: shortText(msg.text(), 500),
      });
    }
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText || 'unknown',
    });
  });
  page.on('response', (response) => {
    if (shouldTrackResponse(response)) {
      const entry = {
        url: response.url(),
        status: response.status(),
        resourceType: response.request().resourceType(),
      };
      if (isAllowedAnonymousAuthProbe(entry)) {
        allowedAuthProbeResponses.push(entry);
      } else {
        errorResponses.push(entry);
      }
    }
  });

  let gotoResponse = null;
  let navigationError = null;
  let navigationRetries = 0;
  let stableWaitError = null;
  let routeReadyError = null;
  try {
    const navigationResult = await gotoWithRetry(page, route);
    gotoResponse = navigationResult.response;
    navigationError = navigationResult.error;
    navigationRetries = navigationResult.retries;

    try {
      await waitStable(page);
    } catch (error) {
      stableWaitError = error;
    }

    const finalUrl = page.url();
    const hasDocument = Boolean(gotoResponse) && finalUrl !== 'about:blank';
    if (hasDocument) {
      try {
        await waitForRouteReadiness(page, route);
      } catch (error) {
        routeReadyError = error;
      }
    }

    const title = await page.title();
    const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
    const canonicalHref = await page.locator('link[rel="canonical"]').first().getAttribute('href').catch(() => null);
    const ogUrl = await page.locator('meta[property="og:url"]').first().getAttribute('content').catch(() => null);
    const textSnippet = shortText(bodyText);
    const inputCount = await page.locator('input, textarea, select').count().catch(() => 0);
    const overlayCount = await page.locator('text=/TypeError|ReferenceError|Unhandled|An unexpected error occurred|Cannot read/i').count().catch(() => 0);
    const interactionResult = hasDocument ? await runInteraction(page, route) : null;
    const dimensions = hasDocument && route.checkHorizontalOverflow
      ? await page.evaluate(() => ({
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
        }))
      : null;

    const screenshotPath = path.join(OUT_DIR, `${route.label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 5000 }).catch(() => {});

    const findings = [...findingsPrefix];
    const warnings = [];
    const { tracked: trackedConsoleEntries, ignored: ignoredConsoleEntries } = splitConsoleEntries(
      consoleEntries,
      allowedAuthProbeResponses,
    );
    const trackedRequestFailures = requestFailures.filter(
      (failure) => !(hasDocument && failure.resourceType === 'document' && failure.url === route.url),
    );
    if (navigationRetries > 0 && hasDocument) {
      warnings.push(`navigation_retries=${navigationRetries}`);
    }
    if (navigationError) {
      findings.push(`navigation_error=${shortText(navigationError && navigationError.message ? navigationError.message : String(navigationError), 500)}`);
    }
    if (stableWaitError) {
      warnings.push(`stable_wait_error=${shortText(stableWaitError && stableWaitError.message ? stableWaitError.message : String(stableWaitError), 500)}`);
    }
    if (routeReadyError) {
      const routeReadyLate = isRouteReadyAtInspection(route, { bodyText, inputCount, interactionResult });
      const detail = shortText(routeReadyError && routeReadyError.message ? routeReadyError.message : String(routeReadyError), 500);
      if (routeReadyLate) {
        warnings.push(`route_ready_late=${detail}`);
      } else {
        findings.push(`route_ready_error=${detail}`);
      }
    }
    if (hasDocument && !bodyText.trim()) {
      findings.push('empty_body');
    }
    const expectedStatus = route.expectedStatus || 200;
    if (!gotoResponse || gotoResponse.status() !== expectedStatus) {
      findings.push(`document_status=${gotoResponse ? gotoResponse.status() : 'null'}`);
    }
    if (overlayCount > 0) {
      findings.push(`overlay_text_count=${overlayCount}`);
    }
    if (trackedConsoleEntries.some((entry) => entry.type === 'error')) {
      findings.push(`console_errors=${trackedConsoleEntries.filter((entry) => entry.type === 'error').length}`);
    }
    if (trackedRequestFailures.length > 0) {
      findings.push(`request_failures=${trackedRequestFailures.length}`);
    }
    if (errorResponses.length > 0) {
      findings.push(`error_responses=${errorResponses.length}`);
    }
    if (hasDocument && route.minInputs && inputCount < route.minInputs) {
      findings.push(`form_inputs=${inputCount}`);
    }
    if (hasDocument && route.expectedTitleIncludes && !title.includes(route.expectedTitleIncludes)) {
      findings.push(`title_mismatch=${title}`);
    }
    if (interactionResult && !interactionResult.ok) {
      findings.push(`interaction_failed=${interactionResult.detail}`);
    }
    if (dimensions && (dimensions.documentWidth > dimensions.viewport + 1 || dimensions.bodyWidth > dimensions.viewport + 1)) {
      findings.push(`horizontal_overflow=${JSON.stringify(dimensions)}`);
    }
    if (hasDocument && route.expectExactBody && bodyText.trim() !== route.expectExactBody) {
      findings.push(`body_mismatch=${textSnippet}`);
    } else if (hasDocument && route.expectText && !bodyText.includes(route.expectText)) {
      findings.push(`missing_text=${route.expectText}`);
    }

    return {
      label: route.label,
      url: route.url,
      finalUrl,
      documentStatus: gotoResponse ? gotoResponse.status() : null,
      title,
      canonicalHref,
      ogUrl,
      textSnippet,
      inputCount,
      overlayCount,
      interactionResult,
      dimensions,
      consoleEntries: trackedConsoleEntries,
      ignoredConsoleEntries,
      requestFailures: trackedRequestFailures,
      ignoredRequestFailures: requestFailures.filter(
        (failure) => hasDocument && failure.resourceType === 'document' && failure.url === route.url,
      ),
      errorResponses,
      allowedAuthProbeResponses,
      screenshotPath,
      ok: findings.length === 0,
      findings,
      warnings,
    };
  } catch (error) {
    const screenshotPath = path.join(OUT_DIR, `${route.label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    return {
      label: route.label,
      url: route.url,
      finalUrl: page.url(),
      documentStatus: gotoResponse ? gotoResponse.status() : null,
      title: '',
      canonicalHref: null,
      ogUrl: null,
      textSnippet: '',
      inputCount: 0,
      overlayCount: 0,
      interactionResult: null,
      dimensions: null,
      consoleEntries,
      requestFailures,
      errorResponses,
      screenshotPath,
      ok: false,
      findings: [...findingsPrefix, shortText(error && error.message ? error.message : String(error), 500)],
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function auditRoute(browser, route) {
  const viewport = route.viewport || { width: 1440, height: 960 };
  const normalContext = await browser.newContext({ viewport });
  try {
    const normalResult = await inspectWithContext(normalContext, route);
    const hasCertError = normalResult.findings.some((finding) => finding.includes('ERR_CERT'));
    if (!hasCertError || !route.allowHttpsErrorInspect) {
      return normalResult;
    }
  } finally {
    await normalContext.close();
  }

  const relaxedContext = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  try {
    return await inspectWithContext(relaxedContext, route, ['certificate_error_detected']);
  } finally {
    await relaxedContext.close();
  }
}

async function runInteraction(page, route) {
  if (route.interaction === 'search-input') {
    const input = page.locator('input[placeholder*="搜索"], input[type="search"], input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: INTERACTION_TIMEOUT_MS }).catch(() => {});
    if (!(await input.count().catch(() => 0))) {
      return { ok: false, detail: 'search_input_missing' };
    }
    if (!(await input.isVisible().catch(() => false))) {
      return { ok: false, detail: 'search_input_not_visible' };
    }

    await input.click();
    await input.fill('RPG');
    await page.waitForTimeout(400);
    const currentValue = await input.inputValue().catch(() => '');
    return { ok: currentValue === 'RPG', detail: `search_input_value=${currentValue}` };
  }

  return null;
}

async function waitForRouteReadiness(page, route) {
  if (route.interaction === 'search-input') {
    await page
      .locator('input[placeholder*="搜索"], input[type="search"], input[type="text"]')
      .first()
      .waitFor({ state: 'visible', timeout: ROUTE_READY_TIMEOUT_MS });
    return;
  }

  if (route.minInputs) {
    await page
      .locator('input, textarea, select')
      .nth(route.minInputs - 1)
      .waitFor({ state: 'attached', timeout: ROUTE_READY_TIMEOUT_MS });
    return;
  }

  const expectedText = route.expectExactBody || route.expectText;
  if (expectedText) {
    await page.waitForFunction(
      (text) => document.body?.innerText?.includes(text),
      expectedText,
      { timeout: ROUTE_READY_TIMEOUT_MS },
    );
  }
}

async function writeReport(results) {
  const summary = buildSummary(results);
  const outFile = path.join(OUT_DIR, 'report.json');
  const tempFile = `${outFile}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.promises.writeFile(tempFile, JSON.stringify(summary, null, 2), 'utf8');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.promises.rm(outFile, { force: true });
      await fs.promises.rename(tempFile, outFile);
      return { summary, outFile };
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt === 4) {
        await fs.promises.rm(tempFile, { force: true }).catch(() => {});
        throw error;
      }
      await delay(100 * (attempt + 1));
    }
  }
  return { summary, outFile };
}

async function auditRoutes(browser) {
  const resultsByIndex = new Array(ROUTES.length);
  let nextIndex = 0;
  let reportWrite = Promise.resolve();

  const persist = () => {
    const completedResults = resultsByIndex.filter(Boolean);
    reportWrite = reportWrite.then(() => writeReport(completedResults));
    return reportWrite;
  };

  const worker = async () => {
    while (nextIndex < ROUTES.length) {
      const routeIndex = nextIndex;
      nextIndex += 1;
      resultsByIndex[routeIndex] = await auditRoute(browser, ROUTES[routeIndex]);
      await persist();
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ROUTES.length) }, () => worker()));
  await reportWrite;
  return resultsByIndex.filter(Boolean);
}

async function main() {
  await ensureDir(OUT_DIR);
  const browserArgs = CLI.useSystemProxy ? [] : [...CHROMIUM_DIRECT_PROXY_ARGS];
  if (CLI.hostResolverRules) {
    browserArgs.push(`--host-resolver-rules=${CLI.hostResolverRules}`);
  }
  const launchOptions = {
    headless: true,
    args: browserArgs,
  };
  if (CLI.executablePath) {
    launchOptions.executablePath = CLI.executablePath;
  }
  const browser = await chromium.launch(launchOptions);
  let results = [];
  await writeReport(results);

  try {
    results = await auditRoutes(browser);

    const { summary, outFile } = await writeReport(results);
    if (CLI.outputMode === 'kv') {
      printKv(summary, outFile);
    } else if (CLI.outputMode === 'json-summary') {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(JSON.stringify({ outFile, total: summary.total, failed: summary.failed, failedRoutes: summary.failedRoutes }, null, 2));
    }

    if (summary.failed > 0 && !CLI.reportOnly) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

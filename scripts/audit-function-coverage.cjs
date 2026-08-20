const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const reportIndex = args.indexOf('--report');
const REPORT_PATH = path.resolve(ROOT, reportIndex >= 0 && args[reportIndex + 1]
  ? args[reportIndex + 1]
  : '.runtime/function-coverage-report.json');

function walk(directory, predicate, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git', '.runtime', 'tinymce'].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, output);
    else if (entry.isFile() && predicate(fullPath)) output.push(fullPath);
  }
  return output;
}

function normalizeRoute(route) {
  if (!route) return route;
  return route.replace(/\/$/, '') || '/';
}

function routeAccess(source) {
  if (source.includes('RequireAdmin')) return 'admin';
  if (source.includes('RequireEmailVerified')) return 'email_verified';
  if (source.includes('RequireAuth')) return 'authenticated';
  if (source.includes('RedirectIfAuthed')) return 'guest_only';
  return 'public';
}

function routeKind(route, source) {
  if (source.includes('<Navigate')) return 'redirect';
  if (route.includes(':') || route.includes('*')) return 'dynamic';
  if (route.startsWith('/payment')) return 'payment';
  return 'static';
}

function pageComponents(source) {
  const ignored = new Set([
    'Route', 'RequireAdmin', 'RequireEmailVerified', 'RequireAuth', 'RedirectIfAuthed',
    'AdminLayout', 'MobileWrapperPage', 'Navigate', 'div', 'React',
  ]);
  return [...source.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)]
    .map((match) => match[1])
    .filter((name) => !ignored.has(name));
}

function extractFrontendRoutes() {
  const appPath = path.join(ROOT, 'qianfu-liandeng', 'src', 'App.tsx');
  const source = fs.readFileSync(appPath, 'utf8');
  const mobileStart = source.indexOf('const mobileRoutes');
  const desktopStart = source.indexOf('const desktopRoutes');
  const routes = [];
  for (const match of source.matchAll(/<Route\b[^>]*\bpath="([^"]+)"[^>]*\belement=\{([\s\S]*?)\}\s*\/>/g)) {
    const index = match.index;
    const variant = index >= desktopStart ? 'desktop' : index >= mobileStart ? 'mobile' : 'shared';
    const route = normalizeRoute(match[1]);
    const element = match[2].replace(/\s+/g, ' ').trim();
    routes.push({
      variant,
      path: route,
      access: routeAccess(element),
      kind: routeKind(route, element),
      components: pageComponents(element),
      redirect: element.includes('<Navigate'),
      sourceLine: source.slice(0, index).split(/\r?\n/).length,
    });
  }
  return routes;
}

function extractBrowserCoverage() {
  const covered = new Map();
  const addCoverage = (variant, route, source) => {
    const normalizedRoute = normalizeRoute(route);
    if (!normalizedRoute || !normalizedRoute.startsWith('/')) return;
    const key = `${variant}\0${normalizedRoute}`;
    const sources = covered.get(key) || new Set();
    sources.add(source);
    covered.set(key, sources);
  };

  const authPath = path.join(ROOT, 'scripts', 'browser-nonpay-auth-validation.cjs');
  const publicPath = path.join(ROOT, 'scripts', 'public-live-browser-audit.cjs');
  const uiAuditPath = path.join(ROOT, 'scripts', 'ui-full-audit.cjs');
  const authSource = fs.readFileSync(authPath, 'utf8');
  const publicSource = fs.readFileSync(publicPath, 'utf8');
  const uiAuditSource = fs.readFileSync(uiAuditPath, 'utf8');

  for (const match of authSource.matchAll(/\bpath:\s*['"]([^'"]+)['"]/g)) {
    addCoverage('all', match[1], 'browser-nonpay-auth-validation');
  }
  for (const match of publicSource.matchAll(/url:\s*`\$\{BASE_URL\}([^`]+)`/g)) {
    const route = match[1].replace(/^\/#/, '').split(/[?#]/)[0] || '/';
    addCoverage('all', route, 'public-live-browser-audit');
  }

  const uiRouteLists = new Map([
    ['desktopPublicRoutes', 'desktop'],
    ['desktopUserRoutes', 'desktop'],
    ['desktopAdminRoutes', 'desktop'],
    ['mobileRoutes', 'mobile'],
  ]);
  for (const match of uiAuditSource.matchAll(/const\s+(desktopPublicRoutes|desktopUserRoutes|desktopAdminRoutes|mobileRoutes)\s*=\s*\[([\s\S]*?)\];/g)) {
    const variant = uiRouteLists.get(match[1]);
    if (!variant) continue;
    for (const routeMatch of match[2].matchAll(/['"]([^'"]+)['"]/g)) {
      addCoverage(variant, routeMatch[1], 'ui-full-audit');
    }
  }

  return [...covered.entries()]
    .map(([key, sources]) => {
      const [variant, route] = key.split('\0');
      return { variant, route, sources: [...sources].sort() };
    })
    .sort((a, b) => a.route.localeCompare(b.route) || a.variant.localeCompare(b.variant));
}

function extractFrontendApiCalls() {
  const sourceRoot = path.join(ROOT, 'qianfu-liandeng', 'src');
  const files = walk(sourceRoot, (file) => /\.(?:ts|tsx)$/.test(file));
  const calls = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relativeFile = path.relative(ROOT, file).replace(/\\/g, '/');
    const apiPattern = /\bapi\.(get|post|put|patch|delete)\s*(?:<[^;\n()]*>)?\s*\(\s*([`'"])([^`'"]+)\2/g;
    for (const match of source.matchAll(apiPattern)) {
      calls.push({ method: match[1].toUpperCase(), path: match[3], file: relativeFile });
    }
    const fetchPattern = /\bfetch\s*\(\s*([`'"])(\/api\/[^`'"]+)\1/g;
    for (const match of source.matchAll(fetchPattern)) {
      calls.push({ method: 'FETCH', path: match[2], file: relativeFile });
    }
  }
  return [...new Map(calls.map((item) => [`${item.method}\0${item.path}\0${item.file}`, item])).values()]
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function extractBackendRouteDefinitions() {
  const routeRoot = path.join(ROOT, 'server', 'routes');
  const files = walk(routeRoot, (file) => /\.ts$/.test(file));
  const routes = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relativeFile = path.relative(ROOT, file).replace(/\\/g, '/');
    for (const match of source.matchAll(/\brouter\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g)) {
      routes.push({ method: match[1].toUpperCase(), path: match[2], file: relativeFile });
    }
  }
  return routes.sort((a, b) => a.file.localeCompare(b.file) || a.path.localeCompare(b.path));
}

const frontendRoutes = extractFrontendRoutes();
const browserCoverage = extractBrowserCoverage();
const coverageByKey = new Map(browserCoverage.map((entry) => [`${entry.variant}\0${entry.route}`, entry]));
const routeRows = frontendRoutes.map((route) => ({
  ...route,
  coverageSources: [
    ...(coverageByKey.get(`${route.variant}\0${route.path}`)?.sources || []),
    ...(coverageByKey.get(`all\0${route.path}`)?.sources || []),
  ].filter((source, index, sources) => sources.indexOf(source) === index),
  browserCovered: coverageByKey.has(`${route.variant}\0${route.path}`)
    || coverageByKey.has(`all\0${route.path}`),
}));
const staticRoutes = routeRows.filter((route) => route.kind === 'static');
const uncoveredStaticRoutes = staticRoutes.filter((route) => !route.browserCovered);
const duplicateRoutes = [];
const routeKeys = new Map();
for (const route of routeRows) {
  const key = `${route.variant}\0${route.path}`;
  if (routeKeys.has(key)) duplicateRoutes.push({ variant: route.variant, path: route.path });
  routeKeys.set(key, route);
}
const frontendApiCalls = extractFrontendApiCalls();
const backendRouteDefinitions = extractBackendRouteDefinitions();
const byAccess = Object.fromEntries(
  ['public', 'guest_only', 'authenticated', 'email_verified', 'admin'].map((access) => [
    access,
    routeRows.filter((route) => route.access === access).length,
  ]),
);
const byKind = Object.fromEntries(
  ['static', 'dynamic', 'redirect', 'payment'].map((kind) => [
    kind,
    routeRows.filter((route) => route.kind === kind).length,
  ]),
);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  ok: duplicateRoutes.length === 0 && frontendRoutes.length > 0,
  summary: {
    frontendRoutes: routeRows.length,
    uniquePaths: new Set(routeRows.map((route) => route.path)).size,
    browserCoveredPaths: new Set(browserCoverage.map((entry) => entry.route)).size,
    staticRoutes: staticRoutes.length,
    coveredStaticRoutes: staticRoutes.length - uncoveredStaticRoutes.length,
    uncoveredStaticRoutes: uncoveredStaticRoutes.length,
    frontendApiCalls: frontendApiCalls.length,
    backendRouteDefinitions: backendRouteDefinitions.length,
    duplicateRoutes: duplicateRoutes.length,
    byAccess,
    byKind,
  },
  frontendRoutes: routeRows,
  browserCoverage,
  uncoveredStaticRoutes,
  duplicateRoutes,
  frontendApiCalls,
  backendRouteDefinitions,
};
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
console.log(`FUNCTION_FRONTEND_ROUTES=${report.summary.frontendRoutes}`);
console.log(`FUNCTION_UNIQUE_PATHS=${report.summary.uniquePaths}`);
console.log(`FUNCTION_STATIC_COVERED=${report.summary.coveredStaticRoutes}/${report.summary.staticRoutes}`);
console.log(`FUNCTION_UNCOVERED_STATIC=${report.summary.uncoveredStaticRoutes}`);
console.log(`FUNCTION_FRONTEND_API_CALLS=${report.summary.frontendApiCalls}`);
console.log(`FUNCTION_BACKEND_ROUTE_DEFINITIONS=${report.summary.backendRouteDefinitions}`);
console.log(`FUNCTION_DUPLICATE_ROUTES=${report.summary.duplicateRoutes}`);
console.log(`FUNCTION_COVERAGE_REPORT=${REPORT_PATH}`);
if (!report.ok) process.exitCode = 1;

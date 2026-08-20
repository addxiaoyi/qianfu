#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const root = path.resolve(valueAfter('--root', process.cwd()));
const reportFile = path.resolve(root, valueAfter('--report', 'reports/source-trackability.json'));
const requireDist = args.includes('--require-dist');
const quiet = args.includes('--quiet');
const sourceManifestArg = valueAfter('--source-manifest', '');
const sourceManifestFile = sourceManifestArg ? path.resolve(root, sourceManifestArg) : '';
const requireSourceManifest = args.includes('--require-source-manifest');

const SKIP = new Set([
  '.git', 'node_modules', 'dist', 'dist-server', 'coverage', 'logs', 'reports',
  'backups', 'release', 'output', 'artifacts', '.cache', '.vite', '.runtime', '.claude',
  '__pycache__', 'tmp', 'temp', 'xpay-3.1_ytm7h',
]);
const TOP_LEVEL_SOURCE_DIRS = new Set([
  'admin', 'docker', 'packages', 'prisma', 'qianfu-liandeng',
  'server', 'services', 'scripts', 'src', 'tests',
]);
const SOURCE_EXT = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const SCRIPT_EXT = new Set([...SOURCE_EXT, '.json', '.html', '.css', '.prisma', '.ps1', '.py', '.sh', '.yaml', '.yml']);
const checks = [];
const dedupe = new Set();

const posix = (v) => v.replace(/\\/g, '/');
const rel = (p) => posix(path.relative(root, p)) || '.';
const inside = (p) => {
  const r = path.relative(root, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};
function add(category, status, target, message, code = '') {
  const item = { category, status, target: posix(target || '.'), message };
  if (code) item.code = code;
  const key = JSON.stringify(item);
  if (!dedupe.has(key)) {
    dedupe.add(key);
    checks.push(item);
  }
}
function succeeds(command, commandArgs) {
  try {
    execFileSync(command, commandArgs, { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const gitMode = fs.existsSync(path.join(root, '.git'))
  && succeeds('git', ['rev-parse', '--is-inside-work-tree']);
function gitText(commandArgs) {
  return execFileSync('git', commandArgs, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
}
let gitInventoryCache;
function gitInventory() {
  if (!gitMode) {
    return { tracked: new Set(), ignored: new Set(), untracked: new Set() };
  }
  if (!gitInventoryCache) {
    const parse = (value) => new Set(value.split('\0').filter(Boolean).map(posix));
    gitInventoryCache = {
      tracked: parse(gitText(['ls-files', '-z'])),
      ignored: parse(gitText(['ls-files', '--others', '--ignored', '--exclude-standard', '-z'])),
      untracked: parse(gitText(['ls-files', '--others', '--exclude-standard', '-z'])),
    };
  }
  return gitInventoryCache;
}
const sourceManifestByPath = new Map();

function fileFingerprint(file) {
  const content = fs.readFileSync(file);
  return {
    bytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function manifestEntryMatches(target, absolutePath) {
  const entry = sourceManifestByPath.get(posix(target));
  if (!entry) return false;
  try {
    const actual = fileFingerprint(absolutePath);
    return actual.bytes === entry.bytes && actual.sha256 === entry.sha256;
  } catch {
    return false;
  }
}

function auditSourceManifest() {
  if (!sourceManifestFile) {
    add(
      'source-manifest',
      requireSourceManifest ? 'error' : 'not_applicable',
      '.',
      requireSourceManifest
        ? 'required immutable source manifest was not supplied'
        : 'no immutable source manifest supplied',
      requireSourceManifest ? 'source_manifest_required' : '',
    );
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(sourceManifestFile, 'utf8'));
  } catch (error) {
    add('source-manifest', 'error', rel(sourceManifestFile),
      `source manifest cannot be read: ${error.message}`, 'source_manifest_unreadable');
    return;
  }

  const entries = Array.isArray(parsed.files) ? parsed.files : [];
  const duplicates = new Set();
  const hashLines = [];

  if (parsed.schemaVersion !== 1) {
    add('source-manifest', 'error', rel(sourceManifestFile),
      'source manifest schemaVersion must be 1', 'source_manifest_schema_invalid');
  }

  for (const entry of entries) {
    const target = posix(String(entry?.path || ''));
    if (!target || target.startsWith('../') || path.isAbsolute(target)) {
      add('source-manifest', 'error', target || '.',
        'source manifest path is invalid', 'source_manifest_path_invalid');
      continue;
    }
    if (sourceManifestByPath.has(target)) {
      duplicates.add(target);
      continue;
    }

    sourceManifestByPath.set(target, entry);
    const absolutePath = path.join(root, target);
    if (!fs.existsSync(absolutePath)) {
      add('source-manifest', 'error', target,
        'manifest source file does not exist', 'source_manifest_file_missing');
    } else if (!manifestEntryMatches(target, absolutePath)) {
      add('source-manifest', 'error', target,
        'manifest source file hash or size differs', 'source_manifest_file_changed');
    } else {
      add('source-manifest', 'pass', target, 'source file matches immutable manifest');
    }
    hashLines.push(`${target}\0${entry.bytes}\0${entry.sha256}\n`);
  }

  for (const target of duplicates) {
    add('source-manifest', 'error', target,
      'source manifest contains duplicate paths', 'source_manifest_duplicate_path');
  }

  const rootHash = createHash('sha256').update(hashLines.join('')).digest('hex');
  if (parsed.fileCount !== entries.length) {
    add('source-manifest', 'error', rel(sourceManifestFile),
      'source manifest fileCount does not match entries', 'source_manifest_count_mismatch');
  }
  if (parsed.rootHash !== rootHash) {
    add('source-manifest', 'error', rel(sourceManifestFile),
      'source manifest rootHash is invalid', 'source_manifest_root_hash_mismatch');
  } else {
    add('source-manifest', 'pass', rel(sourceManifestFile),
      `immutable source manifest verified (${entries.length} files)`);
  }
}
function checkFile(category, absolutePath, message, generated = false) {
  if (!inside(absolutePath)) {
    add(category, 'error', rel(absolutePath), `${message}: path escapes project root`);
    return false;
  }
  const target = rel(absolutePath);
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    add(category, 'error', target, `${message}: file does not exist`);
    return false;
  }
  if (!stat.isFile()) {
    add(category, 'error', target, `${message}: path is not a file`);
    return false;
  }
  if (!generated && (gitMode || requireSourceManifest)) {
    const inventory = gitInventory();
    if (gitMode && inventory.ignored.has(target)) {
      add(category, 'error', target, `${message}: file is ignored by Git`);
      return false;
    }

    const trackedByGit = gitMode && inventory.tracked.has(target);
    if (!trackedByGit) {
      if (!manifestEntryMatches(target, absolutePath)) {
        add(category, 'error', target,
          `${message}: file is not tracked by Git or immutable source manifest`);
        return false;
      }
      add(category, 'pass', target, `${message}: verified by immutable source manifest`);
      return true;
    }
  }
  add(category, 'pass', target, message);
  return true;
}
function walk(start, predicate) {
  if (!fs.existsSync(start)) return [];
  const out = [];
  const stack = [start];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (dir === root && !TOP_LEVEL_SOURCE_DIRS.has(entry.name.toLowerCase())) continue;
        const relativeDir = rel(full);
        const generatedPrisma = relativeDir === 'prisma/generated'
          || relativeDir.startsWith('prisma/generated/');
        const skippedDirectory = SKIP.has(entry.name) || SKIP.has(entry.name.toLowerCase());
        if (!skippedDirectory && !generatedPrisma) stack.push(full);
      } else if (entry.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  return out.sort((a, b) => posix(a).localeCompare(posix(b)));
}
function tokenPath(raw) {
  let token = raw.replace(/^['"]|['"]$/g, '').replace(/[;,]+$/g, '');
  if (token.startsWith('--') && token.includes('=')) {
    const [flag, ...rest] = token.split('=');
    if (/out|output|report|coverage|log|cache|dest/i.test(flag)) return '';
    token = rest.join('=');
  }
  if (!token || token.includes('*') || token.includes('$') || path.isAbsolute(token)) return '';
  if (/^(?:https?:|data:|blob:|node:)/i.test(token)) return '';
  return posix(token.replace(/^\.\//, ''));
}
function shellTokens(command) {
  return (command.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s;&|()]+/g) || [])
    .flatMap((v) => v.replace(/^['"]|['"]$/g, '').replace(/[;,]+$/g, '').split(/\s+/))
    .filter(Boolean);
}

function auditPackageScripts() {
  const outputFlags = new Set(['--out', '--output', '--out-file', '--report', '--coverage', '--log-file', '--cache-dir']);
  for (const packageFile of walk(root, (f) => path.basename(f) === 'package.json')) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    } catch (error) {
      add('package-script-entry', 'error', rel(packageFile), `invalid package.json: ${error.message}`);
      continue;
    }
    const packageDir = path.dirname(packageFile);
    for (const [name, command] of Object.entries(pkg.scripts || {})) {
      const tokens = shellTokens(String(command));
      for (let i = 0; i < tokens.length; i += 1) {
        if (outputFlags.has(tokens[i])) {
          i += 1;
          continue;
        }
        if (tokens[i] === '--prefix' && tokens[i + 1]) {
          const prefix = tokenPath(tokens[++i]);
          if (!prefix) continue;
          checkFile('package-script-entry', path.resolve(packageDir, prefix, 'package.json'),
            `${rel(packageFile)} script ${name}: npm prefix package`);
          continue;
        }
        const candidate = tokenPath(tokens[i]);
        if (!candidate || !SCRIPT_EXT.has(path.extname(candidate).toLowerCase())) continue;
        if (/^(?:coverage|dist|dist-server|logs|reports|release|backups)\//.test(candidate)) continue;
        const absoluteCandidate = path.resolve(packageDir, candidate);
        if (!fs.existsSync(absoluteCandidate)
          && /generate|codegen|openapi/i.test(name)
          && /\.generated\./i.test(candidate)) continue;
        checkFile('package-script-entry', absoluteCandidate, `${rel(packageFile)} script ${name}`);
      }
    }
  }
}

function nearestPackageRoot(file) {
  let dir = path.dirname(file);
  while (inside(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return root;
}
function localRef(value) {
  if (!value || /^(?:https?:|data:|blob:|mailto:|tel:|#)/i.test(value)) return '';
  return value.split(/[?#]/, 1)[0];
}
function htmlAssets(html) {
  const out = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) || []) {
    const ref = tag.match(/\s(?:src|href)=["']([^"']+)["']/i)?.[1];
    if (!ref) continue;
    if (/^<script/i.test(tag) || /rel=["'](?:stylesheet|modulepreload|preload)["']/i.test(tag)) out.push(ref);
  }
  return out;
}
function resolveHtml(file, reference) {
  const value = localRef(reference);
  if (!value) return null;
  if (!value.startsWith('/')) return path.resolve(path.dirname(file), value);

  const packageRoot = nearestPackageRoot(file);
  const publicRoot = path.join(packageRoot, 'public');
  const relativeToPublic = path.relative(publicRoot, file);
  const isPublicSource = relativeToPublic !== ''
    && !relativeToPublic.startsWith('..')
    && !path.isAbsolute(relativeToPublic);
  return path.resolve(isPublicSource ? publicRoot : packageRoot, `.${value}`);
}
function auditHtml() {
  for (const htmlFile of walk(root, (f) => path.extname(f).toLowerCase() === '.html')) {
    checkFile('html-source', htmlFile, 'HTML source file');
    const html = fs.readFileSync(htmlFile, 'utf8');
    for (const reference of htmlAssets(html)) {
      const resolved = resolveHtml(htmlFile, reference);
      if (resolved) checkFile('html-local-asset', resolved, `${rel(htmlFile)} loads ${reference}`);
    }
  }
}

function candidates(base) {
  const ext = path.extname(base).toLowerCase();
  const out = [base];
  if (!ext) {
    for (const suffix of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']) out.push(`${base}${suffix}`);
    for (const suffix of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']) out.push(path.join(base, `index${suffix}`));
  } else if (ext === '.js') {
    out.push(base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx');
  } else if (ext === '.mjs') {
    out.push(base.slice(0, -4) + '.mts', base.slice(0, -4) + '.ts');
  } else if (ext === '.cjs') {
    out.push(base.slice(0, -4) + '.cts', base.slice(0, -4) + '.ts');
  }
  return [...new Set(out)];
}
function prismaSchemaForGeneratedRequire(specifier) {
  if (!specifier.includes('/prisma/generated/')) return null;
  if (specifier.includes('/postgres-client/')) return path.join(root, 'prisma', 'schema.postgresql.prisma');
  if (specifier.includes('/mysql-client/')) return path.join(root, 'prisma', 'schema.mysql.prisma');
  if (specifier.includes('/client/')) return path.join(root, 'prisma', 'schema.prisma');
  return null;
}

function auditModules() {
  const pattern = /\brequire(?:\.resolve)?\s*\(\s*["'](\.{1,2}\/[^"']+)["']/g;
  for (const file of walk(root, (f) => SOURCE_EXT.has(path.extname(f).toLowerCase()))) {
    if (rel(file) === 'tests/unit/source-trackability-audit.test.ts') continue;
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const specifier = match[1];
      const found = candidates(path.resolve(path.dirname(file), specifier))
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!found) {
        const schema = prismaSchemaForGeneratedRequire(specifier);
        if (schema) checkFile('project-module', schema, `${rel(file)} requires generated Prisma client ${specifier}`);
        else add('project-module', 'error', rel(file), `project require does not resolve: ${specifier}`);
      } else {
        checkFile('project-module', found, `${rel(file)} requires ${specifier}`);
      }
    }
  }
}

function auditPlaywright() {
  const files = walk(root, (f) => {
    const r = rel(f).toLowerCase();
    return /(^|\/)playwright(?:\.[^/]+)?\.config\.[^.]+$/.test(r)
      || /(^|\/)tests\/(?:e2e|playwright)\//.test(r)
      || /(^|\/)(?:e2e|playwright)\/.*(?:helper|fixture|setup|teardown)/.test(r);
  });
  if (!files.length) add('playwright', 'not_applicable', '.', 'no Playwright files found');
  for (const file of files) checkFile('playwright', file, 'Playwright config/test/helper');
}

function auditRelease() {
  const dist = path.join(root, 'qianfu-liandeng', 'dist');
  const manifestFile = path.join(dist, 'qianfu-dist-manifest.json');
  if (!fs.existsSync(dist)) {
    add('release-manifest', requireDist ? 'error' : 'not_applicable', rel(dist), 'frontend dist directory is absent');
    return;
  }
  if (!fs.existsSync(manifestFile)) {
    add('release-manifest', 'error', rel(manifestFile), 'frontend distribution manifest is absent');
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    add('release-manifest', 'error', rel(manifestFile), `invalid manifest: ${error.message}`);
    return;
  }
  checkFile('release-manifest', manifestFile, 'generated frontend distribution manifest', true);
  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 2) {
    add('release-manifest', 'error', rel(manifestFile), 'schemaVersion must be at least 2');
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.buildId || '') || manifest.buildId !== manifest.distHash) {
    add('release-manifest', 'error', rel(manifestFile), 'buildId must be the SHA-256 distHash');
  } else {
    add('release-manifest', 'pass', rel(manifestFile), 'buildId is bound to distHash');
  }
  const byPath = new Map();
  let sriErrors = 0;
  for (const entry of manifest.files || []) {
    byPath.set(entry.path, entry);
    const file = path.join(dist, String(entry.path || '').replace(/^\//, ''));
    if (!fs.existsSync(file)) add('release-manifest', 'error', rel(file), 'manifest entry points to a missing file');
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256 || '') || !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(entry.sri || '')) {
      sriErrors += 1;
      add('release-sri', 'error', entry.path || '.', 'manifest entry is missing SHA-256 or SRI');
    }
  }
  if ((manifest.files || []).length && sriErrors === 0) {
    add('release-sri', 'pass', rel(manifestFile), `all ${manifest.files.length} files contain SHA-256 and SRI`);
  }
  const index = path.join(dist, 'index.html');
  if (fs.existsSync(index)) {
    for (const reference of htmlAssets(fs.readFileSync(index, 'utf8'))) {
      const value = localRef(reference);
      if (!value || !value.startsWith('/')) continue;
      checkFile('release-html-asset', path.join(dist, value.slice(1)), `built index.html loads ${reference}`, true);
      if (!byPath.has(value)) add('release-html-asset', 'error', value, 'built HTML asset is absent from manifest');
      else add('release-html-asset', 'pass', value, 'built HTML asset is included in manifest');
    }
  }
  const swFile = path.join(dist, 'sw.js');
  if (!fs.existsSync(swFile)) {
    add('service-worker-precache', 'not_applicable', rel(swFile), 'no built service worker found');
    return;
  }
  const sw = fs.readFileSync(swFile, 'utf8');
  const staticBlock = sw.match(/const\s+STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]\s*;/)?.[1] || '';
  const stampedAssets = sw.match(/self\.__QIANFU_PRECACHE_ASSETS__\s*=\s*(\[[^\n;]+\])/i)?.[1] || '';
  let assets = [...staticBlock.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  if (!assets.length && stampedAssets) {
    try {
      assets = JSON.parse(stampedAssets);
    } catch {
      assets = [];
    }
  }

  let stampedIntegrity = null;
  const integrityJson = sw.match(/self\.__QIANFU_PRECACHE_INTEGRITY__\s*=\s*(\{[^\n;]+\})/i)?.[1] || '';
  if (integrityJson) {
    try {
      stampedIntegrity = JSON.parse(integrityJson);
    } catch {
      add('service-worker-precache', 'error', rel(swFile),
        'Service Worker integrity metadata cannot be parsed', 'service_worker_sri_mismatch');
    }
  }

  if (!assets.length) {
    add('service-worker-precache', 'error', rel(swFile), 'precache asset list cannot be parsed');
    return;
  }

  for (const asset of assets) {
    const manifestPath = asset === '/' ? '/index.html' : asset;
    checkFile('service-worker-precache', path.join(dist, manifestPath.replace(/^\//, '')),
      `service worker precaches ${asset}`, true);
    const entry = byPath.get(manifestPath);
    if (!entry) {
      add('service-worker-precache', 'error', manifestPath,
        'precache asset is absent from buildId manifest', 'service_worker_manifest_missing');
    } else if (!entry.sri) {
      add('service-worker-precache', 'error', manifestPath,
        'precache asset is missing SRI', 'service_worker_sri_mismatch');
    } else if (stampedIntegrity && stampedIntegrity[manifestPath] !== entry.sri) {
      add('service-worker-precache', 'error', manifestPath,
        'Service Worker integrity does not match manifest SRI', 'service_worker_sri_mismatch');
    } else {
      add('service-worker-precache', 'pass', manifestPath,
        'precache asset is in buildId manifest with matching SRI');
    }
  }
}

function auditGitCritical() {
  if (!gitMode) {
    add('git-trackability', 'not_applicable', '.', 'release snapshot has no .git metadata; existence and manifest checks remain active');
    return;
  }
  const critical = (file) => {
    const r = posix(file).toLowerCase();
    const segments = r.split('/');
    if (!TOP_LEVEL_SOURCE_DIRS.has(segments[0])) return false;
    if (segments.some((segment) => SKIP.has(segment))) return false;
    if (r.startsWith('prisma/generated/')) return false;
    if (/^(?:dist|dist-server|coverage|logs|reports|release|backups)\//.test(r)) return false;
    const extension = path.extname(r);
    const codeExtension = SOURCE_EXT.has(extension)
      || ['.java', '.ps1', '.py', '.sh'].includes(extension);
    if (!codeExtension) return false;
    return true;
  };
  const inventory = gitInventory();
  const ignored = [...inventory.ignored].filter(critical);
  const untracked = [...inventory.untracked].filter(critical);
  const unmanifested = untracked.filter((file) => !manifestEntryMatches(file, path.join(root, file)));
  for (const file of ignored) {
    add('git-trackability', 'error', file, 'critical source/test file is ignored by Git');
  }
  for (const file of unmanifested) {
    add('git-trackability', 'error', file,
      'critical source/test file is neither tracked by Git nor immutable source manifest');
  }
  if (!ignored.length && !unmanifested.length) {
    add('git-trackability', 'pass', '.',
      `${untracked.length} untracked critical files are covered by immutable source manifest`);
  }
}

auditSourceManifest();
auditPackageScripts();
auditHtml();
auditPlaywright();
auditModules();
auditRelease();
auditGitCritical();

const summary = {
  total: checks.length,
  passed: checks.filter((c) => c.status === 'pass').length,
  errors: checks.filter((c) => c.status === 'error').length,
  warnings: checks.filter((c) => c.status === 'warning').length,
  notApplicable: checks.filter((c) => c.status === 'not_applicable').length,
};
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  root,
  mode: gitMode
    ? (sourceManifestFile ? 'git+source-manifest' : 'git')
    : (sourceManifestFile ? 'source-manifest' : 'release-snapshot'),
  requireDist,
  requireSourceManifest,
  sourceManifest: sourceManifestFile ? rel(sourceManifestFile) : null,
  summary,
  checks,
};
report.reportSha256 = createHash('sha256').update(JSON.stringify(report)).digest('hex');
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (!quiet) {
  console.log(`source_trackability_mode=${report.mode}`);
  console.log(`source_trackability_total=${summary.total}`);
  console.log(`source_trackability_passed=${summary.passed}`);
  console.log(`source_trackability_errors=${summary.errors}`);
  console.log(`source_trackability_not_applicable=${summary.notApplicable}`);
  console.log(`source_trackability_report=${rel(reportFile)}`);
  console.log(`SOURCE_TRACKABILITY_REPORT=${rel(reportFile)}`);
  console.log(`SOURCE_TRACKABILITY_FINDINGS=${summary.errors + summary.warnings}`);
  for (const item of checks.filter((c) => c.status === 'error').slice(0, 100)) {
    console.error(`[${item.category}] ${item.target}: ${item.message}`);
  }
}
process.exitCode = summary.errors === 0 ? 0 : 1;

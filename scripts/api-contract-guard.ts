import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const ROUTES_DIR = resolve(ROOT, 'server/routes');
const ROUTE_INDEX = resolve(ROOT, 'server/routes/index.ts');

const violations: string[] = [];

const ROUTER_DECLARATION_RE = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const SEGMENT_RE = /^[a-z0-9-]+$/;
const READ_METHODS = new Set(['get']);
const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const VERB_SEGMENTS = new Set([
  'create',
  'update',
  'delete',
  'remove',
  'submit',
  'reject',
  'publish',
  'unlock',
  'rollback',
  'toggle',
  'refresh',
  'generate',
  'recheck',
  'clear',
  'end',
]);
const READ_NOUN_SEGMENTS = new Set(['list', 'history', 'stats', 'detail', 'details']);

function walk(dir: string, cb: (absPath: string) => void) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, cb);
      continue;
    }
    cb(abs);
  }
}

function getRouteFiles(): string[] {
  const files: string[] = [];
  walk(ROUTES_DIR, (absPath) => {
    if (!absPath.endsWith('.ts')) return;
    files.push(absPath);
  });
  return files;
}

function isParamSegment(segment: string): boolean {
  return segment.startsWith(':');
}

function normalizedSegments(path: string): string[] {
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function validateRoutePath(file: string, method: string, path: string, line: number) {
  if (path.startsWith('/api')) {
    violations.push(`${file}:${line} 路由不应包含 /api 前缀，统一在 server/routes/index.ts 管理：${method.toUpperCase()} ${path}`);
  }

  const segments = normalizedSegments(path);
  for (const segment of segments) {
    if (isParamSegment(segment)) continue;
    if (!SEGMENT_RE.test(segment)) {
      violations.push(`${file}:${line} 路径段必须为 kebab-case：${method.toUpperCase()} ${path} (invalid: ${segment})`);
    }
  }

  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    if (READ_METHODS.has(method) && VERB_SEGMENTS.has(last)) {
      violations.push(`${file}:${line} GET 路由末段不应是动作动词：${method.toUpperCase()} ${path}`);
    }
    if (WRITE_METHODS.has(method) && READ_NOUN_SEGMENTS.has(last)) {
      violations.push(`${file}:${line} 写操作路由末段不应使用只读语义名词：${method.toUpperCase()} ${path}`);
    }
  }
}

function inspectRouteFiles() {
  const files = getRouteFiles();
  for (const absPath of files) {
    const content = readFileSync(absPath, 'utf8');
    const rel = absPath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    let match: RegExpExecArray | null;
    while ((match = ROUTER_DECLARATION_RE.exec(content)) !== null) {
      const method = match[1];
      const path = match[2];
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      validateRoutePath(rel, method, path, line);
    }
  }
}

function inspectRouteIndex() {
  const content = readFileSync(ROUTE_INDEX, 'utf8');
  const rel = ROUTE_INDEX.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  if (!content.includes('API_VERSION_PREFIX')) {
    violations.push(`${rel}: 路由入口必须通过 API_VERSION_PREFIX 统一管理版本前缀`);
  }
  if (!content.includes('API_PREFIX')) {
    violations.push(`${rel}: 路由入口必须通过 API_PREFIX 统一管理根前缀`);
  }
}

function main() {
  inspectRouteFiles();
  inspectRouteIndex();

  if (violations.length > 0) {
    console.error('❌ API Contract Guard 未通过：');
    for (const v of violations) {
      console.error(`- ${v}`);
    }
    process.exit(1);
  }

  console.log('✅ API Contract Guard 通过');
}

main();

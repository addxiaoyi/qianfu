import { createRequire } from 'node:module';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const config = require('./cleanup-project.config.cjs') as CleanupConfig;

type CleanupConfig = {
  rootLogsAndTemp: { enabled: boolean; rootFileGlobs: string[] };
  buildOutputs: { enabled: boolean; paths: string[] };
  vitestTests: { enabled: boolean; paths: string[] };
  viteCache: { enabled: boolean; paths: string[] };
  extraPaths: { enabled: boolean; paths: string[] };
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const FORBIDDEN = new Set(
  ['node_modules', '.git', 'src', 'server', 'package.json', 'package-lock.json', 'prisma', 'public'].map((s) =>
    s.toLowerCase(),
  ),
);

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function isSafeTarget(rel: string): boolean {
  const n = normalize(rel).replace(/\\/g, '/');
  if (!n || n.startsWith('..') || n.includes('/../')) return false;
  const first = n.split('/')[0];
  if (first && FORBIDDEN.has(first.toLowerCase())) return false;
  const abs = resolve(ROOT, n);
  if (!abs.startsWith(ROOT)) return false;
  return true;
}

function removePath(rel: string, apply: boolean): boolean {
  if (!isSafeTarget(rel)) {
    console.warn(`[跳过-不安全或未允许] ${rel}`);
    return false;
  }
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) return false;
  if (apply) {
    rmSync(abs, { recursive: true, force: true });
  }
  return true;
}

function matchRootFiles(globs: string[]): string[] {
  const names = readdirSync(ROOT);
  const matched = new Set<string>();
  for (const pattern of globs) {
    const re = globToRegex(pattern);
    for (const name of names) {
      if (re.test(name)) matched.add(name);
    }
  }
  return [...matched];
}

function main() {
  const apply = process.argv.includes('--apply');
  const targets: string[] = [];

  if (config.rootLogsAndTemp?.enabled) {
    targets.push(...matchRootFiles(config.rootLogsAndTemp.rootFileGlobs || []));
  }

  const addGroup = (group: { enabled: boolean; paths?: string[] }) => {
    if (!group?.enabled || !group.paths) return;
    for (const p of group.paths) {
      const t = String(p).trim();
      if (t) targets.push(t);
    }
  };

  addGroup(config.buildOutputs);
  addGroup(config.vitestTests);
  addGroup(config.viteCache);
  addGroup(config.extraPaths);

  const unique = [...new Set(targets)].filter((p) => isSafeTarget(p));

  if (unique.length === 0) {
    console.log('当前配置下没有需要清理的路径（或全部被安全规则跳过）。请编辑 scripts/cleanup-project.config.cjs');
    return;
  }

  console.log(apply ? '即将删除：' : '【预览】以下路径将被删除（未加 --apply，不会真的删）：');
  for (const rel of unique) {
    const abs = resolve(ROOT, rel);
    const ok = existsSync(abs);
    const type = ok && statSync(abs).isDirectory() ? '目录' : '文件';
    console.log(`  - ${rel} (${ok ? type : '不存在，跳过'})`);
  }

  if (!apply) {
    console.log('\n确认无误后执行: npm run clean:project:apply');
    return;
  }

  let n = 0;
  for (const rel of unique) {
    if (removePath(rel, true)) n += 1;
  }
  console.log(`\n已删除 ${n} 个路径。`);
}

main();

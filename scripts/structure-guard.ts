import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const violations: string[] = [];

function walk(dir: string, cb: (absPath: string) => void) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage' || entry === '.git') continue;
      walk(abs, cb);
    } else {
      cb(abs);
    }
  }
}

function assertNoLegacyMobilePages() {
  const legacyDir = resolve(ROOT, 'src/pages/mobile');
  if (!existsSync(legacyDir)) return;

  let sourceFileCount = 0;
  walk(legacyDir, (absPath) => {
    if (absPath.endsWith('.ts') || absPath.endsWith('.tsx') || absPath.endsWith('.js') || absPath.endsWith('.jsx')) {
      sourceFileCount += 1;
    }
  });

  if (sourceFileCount > 0) {
    violations.push(`发现遗留源码目录 src/pages/mobile（${sourceFileCount} 个源码文件）`);
  }
}

function assertNoForwardingShells() {
  const mobilePagesDir = resolve(ROOT, 'src/features/mobile/pages');
  if (!existsSync(mobilePagesDir)) return;

  walk(mobilePagesDir, (absPath) => {
    if (!absPath.endsWith('.ts') && !absPath.endsWith('.tsx')) return;
    const rel = absPath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    const content = readFileSync(absPath, 'utf8');

    const hasForwarding =
      /export\s*\{\s*default\s*\}\s*from\s*['"].+['"];?/m.test(content) ||
      /export\s*\*\s*from\s*['"].+['"];?/m.test(content);

    if (hasForwarding) {
      violations.push(`发现转发壳页面：${rel}`);
    }
  });
}

function assertAppIsAssemblyOnly() {
  const appPath = resolve(ROOT, 'server/app.ts');
  if (!existsSync(appPath)) return;

  const content = readFileSync(appPath, 'utf8');
  const lines = content.split(/\r?\n/).length;

  if (lines > 220) {
    violations.push(`server/app.ts 过长（${lines} 行），建议继续下沉 bootstrap 模块`);
  }
}

function assertNoLegacyPreloadManagerPath() {
  const legacyPath = resolve(ROOT, 'src/app/usePreloadManager.ts');
  if (existsSync(legacyPath)) {
    violations.push('发现遗留文件 src/app/usePreloadManager.ts，应统一使用 src/app/preload/usePreloadManager.ts');
  }
}

function assertNoLegacyPreloadFeatureGatePath() {
  const legacyPath = resolve(ROOT, 'src/app/usePreloadFeatureGate.ts');
  if (existsSync(legacyPath)) {
    violations.push('发现遗留文件 src/app/usePreloadFeatureGate.ts，应统一使用 src/app/preload/usePreloadFeatureGate.ts');
  }
}

function assertPreloadModuleBoundary() {
  const preloadDir = resolve(ROOT, 'src/app/preload');
  if (!existsSync(preloadDir)) return;

  const allowedInternalRelImports = new Set([
    './constants',
    './runtime',
    './usePreloadManager',
    './usePreloadFeatureGate',
    './index',
    './constants.ts',
    './runtime.ts',
    './usePreloadManager.ts',
    './usePreloadFeatureGate.ts',
    './index.ts',
  ]);

  walk(preloadDir, (absPath) => {
    if (!absPath.endsWith('.ts') && !absPath.endsWith('.tsx')) return;

    const rel = absPath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    const content = readFileSync(absPath, 'utf8');

    const importMatches = content.matchAll(/from\s+['"]([^'\"]+)['"]/g);
    for (const match of importMatches) {
      const source = match[1];
      if (!source) continue;

      if (source.startsWith('./') && !allowedInternalRelImports.has(source)) {
        violations.push(`preload 域内部存在未登记相对依赖：${rel} -> ${source}`);
      }

      if (source.startsWith('../') && source.includes('usePreload')) {
        violations.push(`preload 域不应反向依赖 app 根层 preload hook：${rel} -> ${source}`);
      }
    }
  });
}

function main() {
  assertNoLegacyMobilePages();
  assertNoForwardingShells();
  assertAppIsAssemblyOnly();
  assertNoLegacyPreloadManagerPath();
  assertNoLegacyPreloadFeatureGatePath();
  assertPreloadModuleBoundary();

  if (violations.length > 0) {
    console.error('❌ 结构巡检未通过：');
    for (const issue of violations) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log('✅ 结构巡检通过');
}

main();

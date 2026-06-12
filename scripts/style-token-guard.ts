import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const TARGET_DIR_CANDIDATES = [
  resolve(ROOT, 'src/components/ui'),
  resolve(ROOT, 'src/components/header-parts'),
  resolve(ROOT, 'src/components'),
  resolve(ROOT, 'qianfu-liandeng/src/components/ui'),
  resolve(ROOT, 'qianfu-liandeng/src/components/header-parts'),
  resolve(ROOT, 'qianfu-liandeng/src/components'),
];
const TARGET_DIRS = [...new Set(TARGET_DIR_CANDIDATES.filter((dir) => existsSync(dir)))];

const ALLOWLIST_CONFIG_PATH = resolve(ROOT, 'scripts/style-token-guard.allowlist.json');
const RULES_CONFIG_PATH = resolve(ROOT, 'scripts/style-token-guard.rules.json');

type Severity = 'error' | 'warn' | 'off';

interface GuardRuleSet {
  hardcodedColor: Severity;
  transitionAll: Severity;
}

interface GuardRulesFile {
  defaults?: Partial<GuardRuleSet>;
  overrides?: Array<{
    pathPrefix: string;
    rules: Partial<GuardRuleSet>;
  }>;
}

interface Finding {
  severity: Exclude<Severity, 'off'>;
  file: string;
  message: string;
}

function readAllowlistEntries(): string[] {
  const raw = readFileSync(ALLOWLIST_CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('style-token-guard.allowlist.json 必须是字符串数组');
  }

  return parsed.filter((v): v is string => typeof v === 'string');
}

function resolveAllowlistPath(relativePath: string): string {
  const direct = resolve(ROOT, relativePath);
  if (existsSync(direct)) return direct;

  if (!relativePath.startsWith('qianfu-liandeng/')) {
    const migrated = resolve(ROOT, `qianfu-liandeng/${relativePath}`);
    if (existsSync(migrated)) return migrated;
  }

  return direct;
}

function readAllowlist(): Set<string> {
  return new Set(readAllowlistEntries().map(resolveAllowlistPath));
}

function isSeverity(v: unknown): v is Severity {
  return v === 'error' || v === 'warn' || v === 'off';
}

function normalizeRules(partial: Partial<GuardRuleSet>, fallback: GuardRuleSet): GuardRuleSet {
  return {
    hardcodedColor: isSeverity(partial.hardcodedColor) ? partial.hardcodedColor : fallback.hardcodedColor,
    transitionAll: isSeverity(partial.transitionAll) ? partial.transitionAll : fallback.transitionAll,
  };
}

function readRules() {
  const raw = readFileSync(RULES_CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as GuardRulesFile;

  const defaults: GuardRuleSet = normalizeRules(parsed.defaults ?? {}, {
    hardcodedColor: 'error',
    transitionAll: 'warn',
  });

  const overrides = Array.isArray(parsed.overrides)
    ? parsed.overrides
        .filter((o) => o && typeof o.pathPrefix === 'string' && o.pathPrefix.length > 0)
        .map((o) => ({
          pathPrefix: o.pathPrefix.replaceAll('\\', '/').replace(/^\.\//, ''),
          rules: normalizeRules(o.rules ?? {}, defaults),
        }))
    : [];

  return { defaults, overrides };
}

const ALLOWLIST = readAllowlist();
const RULES = readRules();
const STRICT_MODE = process.argv.includes('--strict');

const COLOR_LITERAL_RE = /(?:rgba?\(|#[0-9a-fA-F]{3,8}\b)/;
const TRANSITION_ALL_RE = /transition\s*:\s*all\b/;

const findings: Finding[] = [];

function toRel(absPath: string) {
  return relative(ROOT, absPath).replaceAll('\\', '/');
}

function toStrict(ruleSet: GuardRuleSet): GuardRuleSet {
  if (!STRICT_MODE) return ruleSet;
  return {
    hardcodedColor: ruleSet.hardcodedColor === 'off' ? 'off' : 'error',
    transitionAll: ruleSet.transitionAll === 'off' ? 'off' : 'error',
  };
}

function rulesForFile(relPath: string): GuardRuleSet {
  for (const override of RULES.overrides) {
    if (relPath.startsWith(override.pathPrefix)) {
      return toStrict(override.rules);
    }
  }
  return toStrict(RULES.defaults);
}

function walk(dir: string, cb: (absPath: string) => void) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const abs = join(dir, entry);
    const st = statSync(abs);

    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage' || entry === '.git') continue;
      walk(abs, cb);
      continue;
    }

    cb(abs);
  }
}

function pushFinding(severity: Severity, file: string, message: string) {
  if (severity === 'off') return;
  findings.push({ severity, file, message });
}

function scanFile(absPath: string) {
  if (ALLOWLIST.has(absPath)) return;

  const isCss = absPath.endsWith('.css');
  if (!isCss) return;

  const content = readFileSync(absPath, 'utf8');
  const rel = toRel(absPath);
  const fileRules = rulesForFile(rel);

  if (COLOR_LITERAL_RE.test(content)) {
    pushFinding(
      fileRules.hardcodedColor,
      rel,
      '检测到硬编码颜色（rgba/rgb/hex），请改用 token（hsl(var(--...)) / color-mix）',
    );
  }

  if (TRANSITION_ALL_RE.test(content)) {
    pushFinding(
      fileRules.transitionAll,
      rel,
      '检测到 transition: all，请改用精确属性 + motion token',
    );
  }
}

function reportStaleAllowlist() {
  const stale = readAllowlistEntries().filter((relPath) => {
    const abs = resolveAllowlistPath(relPath);
    try {
      statSync(abs);
      return false;
    } catch {
      return true;
    }
  });

  if (stale.length > 0) {
    console.warn('⚠️ Style token guard 白名单存在失效路径：');
    for (const s of stale) {
      console.warn(`- ${s}`);
    }
  }
}

function main() {
  reportStaleAllowlist();
  if (TARGET_DIRS.length === 0) {
    console.warn('⚠️ Style token guard 未找到目标目录，已跳过。');
    return;
  }

  for (const dir of TARGET_DIRS) {
    walk(dir, scanFile);
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const warns = findings.filter((f) => f.severity === 'warn');

  if (warns.length > 0) {
    console.warn('⚠️ Style token guard 警告：');
    for (const w of warns) {
      console.warn(`- ${w.file}: ${w.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('❌ Style token guard 错误：');
    for (const e of errors) {
      console.error(`- ${e.file}: ${e.message}`);
    }
    process.exit(1);
  }

  console.log('✅ Style token guard 通过');
}

main();

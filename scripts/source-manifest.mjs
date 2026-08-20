import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const SOURCE_ROOTS = [
  'admin',
  'docker',
  'packages',
  'prisma',
  'qianfu-liandeng',
  'server',
  'services',
  'scripts',
  'src',
  'tests',
];

export const ROOT_FILES = [
  '.gitignore',
  'eslint.config.js',
  'package-lock.json',
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.server.json',
  'vite.config.ts',
  'vitest.config.ts',
];

const SKIP_DIRS = new Set([
  '.cache',
  '.git',
  '.runtime',
  '.vite',
  '__pycache__',
  'artifacts',
  'backups',
  'coverage',
  'dist',
  'dist-server',
  'logs',
  'node_modules',
  'output',
  'playwright-report',
  'release',
  'reports',
  'test-results',
  'tmp',
  'temp',
  'uploads',
]);

const RUNTIME_SUFFIXES = [
  '.bak',
  '.backup',
  '.br',
  '.db',
  '.db-journal',
  '.db-shm',
  '.db-wal',
  '.gz',
  '.log',
  '.p12',
  '.pfx',
  '.pid',
  '.pyc',
  '.tar',
  '.temp',
  '.tgz',
  '.tmp',
  '.tsbuildinfo',
  '.zip',
];

const SENSITIVE_FILE =
  /(?:^|\/)(?:\.env(?:\..*)?|credentials?(?:\..*)?|.*(?:askpass|private[_-]?key|secret[_-]?key).*)$/i;
const RUNTIME_FILE =
  /^(?:prisma\/(?:test-)?-?migration-[0-9a-f-]{8,}\.prisma|prisma\/migrations\/migration_lock\.toml)$/i;

const toPosix = (value) => value.replace(/\\/g, '/');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function shouldSkip(relativePath, isDirectory = false) {
  const normalized = toPosix(relativePath);
  const lower = normalized.toLowerCase();
  const segments = lower.split('/').filter(Boolean);

  if (segments.some((segment) => SKIP_DIRS.has(segment))) return true;
  if (lower === 'prisma/generated' || lower.startsWith('prisma/generated/')) return true;
  if (isDirectory) return false;
  if (SENSITIVE_FILE.test(normalized) || RUNTIME_FILE.test(lower)) return true;
  return RUNTIME_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export async function listSourceFiles(rootDir = '.') {
  const root = path.resolve(rootDir);
  const files = [];

  for (const relativePath of ROOT_FILES) {
    const file = path.join(root, relativePath);
    if (await exists(file)) files.push(file);
  }

  const stack = [];
  for (const relativeRoot of SOURCE_ROOTS) {
    const sourceRoot = path.join(root, relativeRoot);
    if (await exists(sourceRoot)) stack.push(sourceRoot);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      const relativePath = toPosix(path.relative(root, file));

      if (entry.isDirectory()) {
        if (!shouldSkip(relativePath, true)) stack.push(file);
      } else if (entry.isFile() && !shouldSkip(relativePath)) {
        files.push(file);
      }
    }
  }

  return [...new Set(files)].sort((left, right) =>
    toPosix(path.relative(root, left)).localeCompare(toPosix(path.relative(root, right))),
  );
}

export async function createSourceManifest(options = {}) {
  const rootDir = path.resolve(options.rootDir || '.');
  const files = [];

  for (const file of await listSourceFiles(rootDir)) {
    const content = await readFile(file);
    files.push({
      path: toPosix(path.relative(rootDir, file)),
      bytes: content.length,
      sha256: sha256(content),
    });
  }

  const rootHashInput = files
    .map((entry) => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`)
    .join('');

  return {
    schemaVersion: 1,
    rootHash: sha256(rootHashInput),
    fileCount: files.length,
    files,
  };
}

export async function writeSourceManifest(options = {}) {
  const rootDir = path.resolve(options.rootDir || '.');
  const outputFile = path.resolve(
    rootDir,
    options.outputFile || 'reports/source-manifest.json',
  );
  const manifest = await createSourceManifest({ rootDir });
  const report = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    rootDir,
  };

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { outputFile, report };
}

export async function verifySourceManifest(options = {}) {
  const rootDir = path.resolve(options.rootDir || '.');
  const manifestFile = path.resolve(
    rootDir,
    options.outputFile || 'reports/source-manifest.json',
  );
  const stored = JSON.parse(await readFile(manifestFile, 'utf8'));
  const current = await createSourceManifest({ rootDir });
  const findings = [];

  if (stored.schemaVersion !== 1) {
    findings.push({ code: 'manifest_schema_invalid', target: manifestFile });
  }
  if (stored.rootHash !== current.rootHash) {
    findings.push({ code: 'manifest_root_hash_mismatch', target: manifestFile });
  }
  if (stored.fileCount !== current.fileCount) {
    findings.push({ code: 'manifest_file_count_mismatch', target: manifestFile });
  }

  const storedByPath = new Map((stored.files || []).map((entry) => [entry.path, entry]));
  const currentByPath = new Map(current.files.map((entry) => [entry.path, entry]));

  for (const [target, entry] of currentByPath) {
    const expected = storedByPath.get(target);
    if (!expected) {
      findings.push({ code: 'manifest_file_missing', target });
    } else if (expected.sha256 !== entry.sha256 || expected.bytes !== entry.bytes) {
      findings.push({ code: 'manifest_file_changed', target });
    }
  }

  for (const target of storedByPath.keys()) {
    if (!currentByPath.has(target)) {
      findings.push({ code: 'manifest_file_removed', target });
    }
  }

  return {
    schemaVersion: 1,
    ok: findings.length === 0,
    manifestFile,
    expectedRootHash: stored.rootHash,
    actualRootHash: current.rootHash,
    summary: {
      files: current.fileCount,
      findings: findings.length,
    },
    findings,
  };
}

function parseArgs(argv) {
  let rootDir = '.';
  let outputFile = 'reports/source-manifest.json';
  let check = false;
  let quiet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--root' && argv[index + 1]) rootDir = argv[++index];
    else if (token === '--output' && argv[index + 1]) outputFile = argv[++index];
    else if (token === '--check') check = true;
    else if (token === '--quiet') quiet = true;
    else throw new Error(`Unknown argument: ${token}`);
  }

  return { rootDir, outputFile, check, quiet };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.check) {
    const report = await verifySourceManifest(options);
    if (!options.quiet || !report.ok) console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
    return;
  }

  const { outputFile, report } = await writeSourceManifest(options);
  if (!options.quiet) {
    console.log(JSON.stringify({
      outputFile,
      rootHash: report.rootHash,
      fileCount: report.fileCount,
    }, null, 2));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

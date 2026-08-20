import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REQUIRED_FILES = [
  'server/index.js',
  'server/app.js',
  'packages/shared/src/index.js',
  'prisma/generated/client/index.js',
  'prisma/generated/local-client/index.js',
  'prisma/generated/postgres-client/index.js',
  'prisma/generated/mysql-client/index.js',
];

const SCANNED_DIRS = ['server', 'scripts', 'packages/shared'];
const FORBIDDEN_SUFFIXES = ['.tmp', '.temp', '.log', '.tsbuildinfo', '.db', '.db-journal'];

const toPosix = (value) => value.replace(/\\/g, '/');

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  if (!await exists(root)) return [];

  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(file);
      else if (entry.isFile()) files.push(file);
    }
  }

  return files.sort((a, b) => toPosix(a).localeCompare(toPosix(b)));
}

function collectRelativeImports(source, file) {
  const imports = [];
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );

  const addSpecifier = (node) => {
    if (node && ts.isStringLiteralLike(node) && node.text.startsWith('.')) {
      imports.push(node.text);
    }
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
    ) {
      addSpecifier(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return imports;
}

function hasRuntimeExtension(specifier) {
  const clean = specifier.split(/[?#]/, 1)[0];
  return ['.js', '.json', '.node', '.wasm'].includes(path.extname(clean).toLowerCase());
}

async function verifyImport(sourceFile, specifier, distDir, findings) {
  const target = toPosix(path.relative(distDir, sourceFile));
  const clean = specifier.split(/[?#]/, 1)[0];

  if (!hasRuntimeExtension(clean)) {
    findings.push({
      code: 'extensionless_relative_import',
      target,
      message: `relative import must include a runtime extension: ${specifier}`,
    });
    return;
  }

  const resolved = path.resolve(path.dirname(sourceFile), clean);
  const relative = path.relative(distDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    findings.push({
      code: 'relative_import_escapes_dist',
      target,
      message: `relative import escapes dist-server: ${specifier}`,
    });
    return;
  }

  if (!await exists(resolved)) {
    findings.push({
      code: 'unresolved_relative_import',
      target,
      message: `relative import does not resolve: ${specifier}`,
    });
  }
}

export async function verifyServerDist(options = {}) {
  const distDir = path.resolve(options.distDir || 'dist-server');
  const findings = [];

  if (!await exists(distDir)) {
    return {
      schemaVersion: 1,
      ok: false,
      distDir,
      summary: { files: 0, javascript: 0, findings: 1 },
      findings: [{
        code: 'dist_missing',
        target: toPosix(distDir),
        message: 'dist-server directory does not exist',
      }],
    };
  }

  for (const relativePath of REQUIRED_FILES) {
    if (!await exists(path.join(distDir, relativePath))) {
      findings.push({
        code: 'required_file_missing',
        target: relativePath,
        message: 'required server release file is missing',
      });
    }
  }

  const allFiles = await listFiles(distDir);
  for (const file of allFiles) {
    const relativePath = toPosix(path.relative(distDir, file));
    const lower = relativePath.toLowerCase();

    if (FORBIDDEN_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
      findings.push({
        code: 'forbidden_release_file',
        target: relativePath,
        message: 'temporary or runtime state file must not be shipped',
      });
    }

    if (lower.endsWith('.ts') && !lower.endsWith('.d.ts')) {
      findings.push({
        code: 'typescript_source_in_dist',
        target: relativePath,
        message: 'raw TypeScript source must not be present in dist-server',
      });
    }
  }

  const javascript = [];
  for (const relativeDir of SCANNED_DIRS) {
    for (const file of await listFiles(path.join(distDir, relativeDir))) {
      if (file.endsWith('.js')) javascript.push(file);
    }
  }

  for (const file of javascript) {
    const source = await readFile(file, 'utf8');
    for (const specifier of collectRelativeImports(source, file)) {
      await verifyImport(file, specifier, distDir, findings);
    }

    if (!await exists(`${file}.map`)) {
      findings.push({
        code: 'source_map_missing',
        target: toPosix(path.relative(distDir, file)),
        message: 'compiled project JavaScript is missing its source map',
      });
    }
  }

  return {
    schemaVersion: 1,
    ok: findings.length === 0,
    distDir,
    summary: {
      files: allFiles.length,
      javascript: javascript.length,
      findings: findings.length,
    },
    findings,
  };
}

function parseArgs(argv) {
  let distDir = 'dist-server';
  let quiet = false;

  for (const token of argv) {
    if (token === '--quiet') quiet = true;
    else if (!token.startsWith('--')) distDir = token;
    else throw new Error(`Unknown argument: ${token}`);
  }

  return { distDir, quiet };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await verifyServerDist(options);
  if (!options.quiet || !report.ok) console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

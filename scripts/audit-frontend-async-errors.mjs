import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import ts from 'typescript';

const root = join(process.cwd(), 'qianfu-liandeng', 'src');
const reportOnly = process.argv.includes('--report-only');
const findings = [];
const excludedFiles = new Set([
  'qianfu-liandeng/src/pages/Payment.tsx',
  'qianfu-liandeng/src/pages/admin/AdminPaymentConfig.tsx',
]);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
});

const lineOf = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

for (const file of walk(root)) {
  const relativeFile = relative(process.cwd(), file).replaceAll('\\', '/');
  if (excludedFiles.has(relativeFile)) continue;
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const inspect = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'useMutation') {
      const options = node.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        const names = new Set(options.properties.flatMap((property) => property.name ? [property.name.getText(sourceFile)] : []));
        if (names.has('onSuccess') && !names.has('onError')) {
          findings.push({ kind: 'mutation-without-error-handler', file: relativeFile, line: lineOf(sourceFile, node) });
        }
      }
    }
    ts.forEachChild(node, inspect);
  };

  inspect(sourceFile);

  const silentEmptyPattern = /\.catch\s*\([^\n]*set[A-Za-z0-9_]+\s*\(\s*\[\s*\]\s*\)/g;
  for (const match of source.matchAll(silentEmptyPattern)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    findings.push({ kind: 'request-failure-disguised-as-empty', file: relativeFile, line });
  }
}

findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
for (const finding of findings) console.log(`${finding.kind}\t${finding.file}:${finding.line}`);
console.log(`FRONTEND_ASYNC_ERROR_FINDINGS=${findings.length}`);
if (findings.length && !reportOnly) process.exitCode = 1;

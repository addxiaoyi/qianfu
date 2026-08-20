import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const scanRoots = [
  resolve(root, 'qianfu-liandeng/src/pages'),
  resolve(root, 'qianfu-liandeng/src/components/mobile'),
];

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const file = join(dir, name);
  if (statSync(file).isDirectory()) return walk(file);
  return /\.(?:ts|tsx)$/.test(name) && !/\.test\.(?:ts|tsx)$/.test(name) ? [file] : [];
});

const findings = [];
for (const file of scanRoots.flatMap(walk)) {
  const sourceText = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      const callee = node.initializer.expression;
      if (ts.isIdentifier(callee) && callee.text === 'useQuery') {
        let hasErrorState = false;
        if (ts.isObjectBindingPattern(node.name)) {
          hasErrorState = node.name.elements.some((element) => {
            const key = element.propertyName ?? element.name;
            return ts.isIdentifier(key) && (key.text === 'isError' || key.text === 'error');
          });
        } else if (ts.isIdentifier(node.name)) {
          const queryName = node.name.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          hasErrorState = new RegExp(`\\b${queryName}\\s*\\.\\s*(?:isError|error)\\b`).test(sourceText);
        }
        if (!hasErrorState) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          findings.push(`${relative(root, file).replaceAll('\\', '/')}:${line}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const finding of findings) console.log(`query-without-error-state\t${finding}`);
console.log(`FRONTEND_QUERY_ERROR_FINDINGS=${findings.length}`);
if (findings.length > 0) process.exitCode = 1;

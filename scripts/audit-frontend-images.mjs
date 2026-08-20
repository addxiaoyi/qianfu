/* global process */
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import ts from 'typescript';

const root = join(process.cwd(), 'qianfu-liandeng', 'src');
const reportOnly = process.argv.includes('--report-only');
const findings = [];

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : extname(path) === '.tsx' ? [path] : [];
});

const attributesOf = (node) => node.attributes?.properties || [];

const getAttribute = (node, name) => attributesOf(node).find((attribute) =>
  ts.isJsxAttribute(attribute) && attribute.name.getText() === name);

const addFinding = (file, node, sourceFile) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  findings.push({
    kind: 'missing-alt',
    file: relative(process.cwd(), file).replaceAll('\\', '/'),
    line: position.line + 1,
  });
};

for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const inspect = (node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening && opening.tagName.getText(sourceFile) === 'img') {
      const alt = getAttribute(opening, 'alt');
      if (!alt?.initializer) addFinding(file, opening, sourceFile);
    }
    ts.forEachChild(node, inspect);
  };

  inspect(sourceFile);
}

findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
for (const finding of findings) {
  console.log(`${finding.kind}\t${finding.file}:${finding.line}`);
}
console.log(`FRONTEND_IMAGE_FINDINGS=${findings.length}`);

if (findings.length > 0 && !reportOnly) process.exitCode = 1;

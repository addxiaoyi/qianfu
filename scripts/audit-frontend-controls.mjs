import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import ts from 'typescript';

const root = join(process.cwd(), 'qianfu-liandeng', 'src');
const reportOnly = process.argv.includes('--report-only');
const findings = [];
// Payment screens are outside the current non-payment completion scope.
const excludedFiles = new Set([
  'qianfu-liandeng/src/pages/Payment.tsx',
  'qianfu-liandeng/src/pages/admin/AdminPaymentConfig.tsx',
]);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : extname(path) === '.tsx' ? [path] : [];
});

const tagName = (node, sourceFile) => node.tagName.getText(sourceFile);

const attributesOf = (node) => node.attributes?.properties || [];

const getAttribute = (node, name) => attributesOf(node).find((attribute) =>
  ts.isJsxAttribute(attribute) && attribute.name.getText() === name);

const hasAttribute = (node, name) => Boolean(getAttribute(node, name));

const stringAttribute = (node, name) => {
  const attribute = getAttribute(node, name);
  return attribute && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : '';
};

const isWrappedByLabel = (node, sourceFile) => {
  let parent = node.parent;
  while (parent) {
    if (ts.isJsxElement(parent) && ['label', 'FieldRow'].includes(tagName(parent.openingElement, sourceFile))) return true;
    parent = parent.parent;
  }
  return false;
};

const hasVisibleText = (node) => {
  if (!ts.isJsxElement(node)) return false;
  let found = false;
  const inspect = (child) => {
    if (found) return;
    if (ts.isJsxText(child) && child.text.trim()) found = true;
    if (ts.isJsxExpression(child) && child.expression &&
      child.expression.kind !== ts.SyntaxKind.FalseKeyword &&
      child.expression.kind !== ts.SyntaxKind.NullKeyword &&
      child.expression.kind !== ts.SyntaxKind.UndefinedKeyword) found = true;
    if (!ts.isJsxOpeningElement(child) && !ts.isJsxSelfClosingElement(child)) ts.forEachChild(child, inspect);
  };
  node.children.forEach(inspect);
  return found;
};

const addFinding = (kind, file, node, sourceFile) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  findings.push({
    kind,
    file: relative(process.cwd(), file).replaceAll('\\', '/'),
    line: position.line + 1,
  });
};

for (const file of walk(root)) {
  const relativeFile = relative(process.cwd(), file).replaceAll('\\', '/');
  if (excludedFiles.has(relativeFile)) continue;
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const inspect = (node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening) {
      const tag = tagName(opening, sourceFile);
      if (['input', 'select', 'textarea'].includes(tag) && stringAttribute(opening, 'type') !== 'hidden') {
        const idAttribute = getAttribute(opening, 'id');
        const id = stringAttribute(opening, 'id');
        const dynamicId = idAttribute?.initializer?.getText(sourceFile) || '';
        const linkedLabel = (id && new RegExp(`htmlFor=["']${id.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["']`).test(source)) ||
          (dynamicId && source.includes(`htmlFor=${dynamicId}`));
        const named = hasAttribute(opening, 'aria-label') || hasAttribute(opening, 'aria-labelledby') || linkedLabel || isWrappedByLabel(opening, sourceFile);
        if (!named) addFinding('unlabeled-control', file, opening, sourceFile);
      }

      if (tag === 'button') {
        const named = hasAttribute(opening, 'aria-label') || hasAttribute(opening, 'aria-labelledby') || hasAttribute(opening, 'title') || hasVisibleText(node);
        if (!named) addFinding('unnamed-button', file, opening, sourceFile);

        const type = stringAttribute(opening, 'type');
        const actionable = hasAttribute(opening, 'onClick') || hasAttribute(opening, 'onPointerDown') || type === 'submit' || type === 'reset' || attributesOf(opening).some(ts.isJsxSpreadAttribute);
        if (!actionable) addFinding('button-without-action', file, opening, sourceFile);
      }
    }
    ts.forEachChild(node, inspect);
  };

  inspect(sourceFile);
}

findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.kind.localeCompare(right.kind));
for (const finding of findings) {
  console.log(`${finding.kind}\t${finding.file}:${finding.line}`);
}
console.log(`FRONTEND_CONTROL_FINDINGS=${findings.length}`);

if (findings.length > 0 && !reportOnly) process.exitCode = 1;

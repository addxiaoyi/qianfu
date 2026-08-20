/* global process */
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import ts from 'typescript';

const root = join(process.cwd(), 'qianfu-liandeng', 'src');
const reportOnly = process.argv.includes('--report-only');
const findings = [];
const nonSemanticTags = new Set(['div', 'span', 'li', 'section', 'article']);
const formControlTags = new Set(['input', 'select', 'textarea']);
const labelWrapperTags = new Set(['label', 'Label.Root', 'FieldRow']);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : extname(path) === '.tsx' ? [path] : [];
});

const attributesOf = (node) => node.attributes?.properties || [];
const getAttribute = (node, name, sourceFile) => attributesOf(node).find((attribute) =>
  ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === name);

const literalAttributeValue = (attribute) => {
  if (!attribute?.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer)
    && attribute.initializer.expression
    && ts.isStringLiteral(attribute.initializer.expression)) {
    return attribute.initializer.expression.text;
  }
  return null;
};

const attributeValueKey = (attribute, sourceFile) => {
  if (!attribute?.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return JSON.stringify(attribute.initializer.text);
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return attribute.initializer.expression.getText(sourceFile);
  }
  return null;
};

const addFinding = (kind, file, node, sourceFile, detail = '') => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  findings.push({
    kind,
    file: relative(process.cwd(), file).replaceAll('\\', '/'),
    line: position.line + 1,
    detail,
  });
};

for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const labelledControlKeys = new Set();

  const collectLabels = (node) => {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (opening) {
      const tag = opening.tagName.getText(sourceFile);
      if (tag === 'label' || tag === 'Label.Root' || tag === 'FieldLabel') {
        const key = attributeValueKey(getAttribute(opening, 'htmlFor', sourceFile), sourceFile);
        if (key) labelledControlKeys.add(key);
      }
    }
    ts.forEachChild(node, collectLabels);
  };
  collectLabels(sourceFile);

  const inspectOpening = (opening, { insideForm, insideLabelWrapper }) => {
    const tag = opening.tagName.getText(sourceFile);
    const attribute = (name) => getAttribute(opening, name, sourceFile);

    if (tag === 'button' && insideForm && !attribute('type')) {
      addFinding('button-missing-type', file, opening, sourceFile);
    }

    if (tag === 'button' && attribute('onClick') && !attribute('disabled')) {
      const onClickSource = attribute('onClick')?.initializer?.getText(sourceFile) || '';
      if (/\.mutate(?:Async)?\s*\(/.test(onClickSource)) {
        addFinding('mutation-button-missing-disabled', file, opening, sourceFile);
      }
    }

    if (formControlTags.has(tag) && literalAttributeValue(attribute('type')) !== 'hidden') {
      const controlKey = attributeValueKey(attribute('id'), sourceFile);
      const hasAccessibleName = insideLabelWrapper
        || Boolean(attribute('aria-label'))
        || Boolean(attribute('aria-labelledby'))
        || Boolean(controlKey && labelledControlKeys.has(controlKey))
        || Boolean(attribute('data-form-control-label-from-parent'));
      if (!hasAccessibleName) {
        addFinding('form-control-missing-name', file, opening, sourceFile, tag);
      }
    }

    if (tag === 'a' && literalAttributeValue(attribute('target')) === '_blank') {
      const rel = literalAttributeValue(attribute('rel')) || '';
      if (!/\b(?:noopener|noreferrer)\b/.test(rel)) {
        addFinding('blank-link-missing-opener-protection', file, opening, sourceFile, rel);
      }
    }

    const role = literalAttributeValue(attribute('role'));
    if ((role === 'dialog' || role === 'alertdialog')
      && !attribute('aria-label')
      && !attribute('aria-labelledby')) {
      addFinding('dialog-missing-name', file, opening, sourceFile, role);
    }

    if (nonSemanticTags.has(tag)
      && attribute('onClick')
      && !attribute('data-noninteractive-click-surface')) {
      const keyboardHandler = attribute('onKeyDown') || attribute('onKeyUp') || attribute('onKeyPress');
      if (!attribute('role') || !attribute('tabIndex') || !keyboardHandler) {
        addFinding('nonsemantic-click', file, opening, sourceFile, tag);
      }
    }

    const tabIndex = attribute('tabIndex');
    if (tabIndex?.initializer) {
      let value = null;
      if (ts.isStringLiteral(tabIndex.initializer)) value = Number(tabIndex.initializer.text);
      if (ts.isJsxExpression(tabIndex.initializer)
        && tabIndex.initializer.expression
        && ts.isNumericLiteral(tabIndex.initializer.expression)) {
        value = Number(tabIndex.initializer.expression.text);
      }
      if (Number.isFinite(value) && value > 0) {
        addFinding('positive-tabindex', file, opening, sourceFile, String(value));
      }
    }
  };

  const inspect = (node, context = { insideForm: false, insideLabelWrapper: false }) => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sourceFile);
      inspectOpening(node.openingElement, context);
      const nextContext = {
        insideForm: context.insideForm || tag === 'form',
        insideLabelWrapper: context.insideLabelWrapper || labelWrapperTags.has(tag),
      };
      for (const child of node.children) inspect(child, nextContext);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      inspectOpening(node, context);
      return;
    }
    ts.forEachChild(node, (child) => inspect(child, context));
  };

  inspect(sourceFile);
}

findings.sort((left, right) => left.kind.localeCompare(right.kind)
  || left.file.localeCompare(right.file)
  || left.line - right.line);

for (const finding of findings) {
  console.log(`${finding.kind}\t${finding.file}:${finding.line}${finding.detail ? `\t${finding.detail}` : ''}`);
}
console.log(`FRONTEND_INTERACTION_FINDINGS=${findings.length}`);

if (findings.length > 0 && !reportOnly) process.exitCode = 1;

import { Project, SyntaxKind, CallExpression, AsExpression } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: 'd:/qwq/项目/千服/tsconfig.json',
  skipAddingFilesFromTsConfig: true,
});

project.addSourceFilesAtPaths([
  'd:/qwq/项目/千服/server/**/*.ts',
  'd:/qwq/项目/千服/server/**/*.tsx',
  'd:/qwq/项目/千服/qianfu-liandeng/src/**/*.ts',
  'd:/qwq/项目/千服/qianfu-liandeng/src/**/*.tsx'
]);

let fixedJsonParse = 0;
let fixedConsoleLog = 0;
let fixedQueryRaw = 0;
let fixedAsAny = 0;
let fixedHardcodedDomains = 0;

for (const sourceFile of project.getSourceFiles()) {
  let changed = false;

  // 1. $queryRawUnsafe -> $queryRaw
  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpr of callExprs) {
    const expr = callExpr.getExpression();
    if (expr.getText().endsWith('$queryRawUnsafe')) {
      const args = callExpr.getArguments();
      if (args.length === 1 && args[0].getKind() === SyntaxKind.StringLiteral) {
        expr.replaceWithText(expr.getText().replace('$queryRawUnsafe', '$queryRaw'));
        const strVal = args[0].getText();
        callExpr.replaceWithText(`${expr.getText().replace('$queryRawUnsafe', '$queryRaw')}(Prisma.sql\`${strVal.slice(1, -1)}\`)`);
        changed = true;
        fixedQueryRaw++;
      }
    }
  }

  // 2. JSON.parse -> safeJsonParse
  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = callExpr.getExpression();
    if (expr.getText() === 'JSON.parse') {
      const tryBlock = callExpr.getFirstAncestorByKind(SyntaxKind.TryStatement);
      if (!tryBlock) {
        const argsText = callExpr.getArguments().map((a: any) => a.getText()).join(', ');
        callExpr.replaceWithText(`(() => { try { return JSON.parse(${argsText}); } catch { return null; } })()`);
        changed = true;
        fixedJsonParse++;
      }
    }
  }

  // 3. console.log -> remove or replace
  for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = callExpr.getExpression();
    if (expr.getText() === 'console.log' || expr.getText() === 'console.info') {
        callExpr.replaceWithText(`/* ${callExpr.getText()} */`);
        changed = true;
        fixedConsoleLog++;
    }
  }

  // 4. as any -> as unknown
  const asExprs = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression);
  for (const asExpr of asExprs) {
    if (asExpr.getTypeNode()?.getText() === 'any') {
      asExpr.getTypeNode()?.replaceWithText('unknown');
      changed = true;
      fixedAsAny++;
    }
  }

  if (changed) {
    sourceFile.saveSync();
  }
}

console.log(`Fixed JSON.parse: ${fixedJsonParse}`);
console.log(`Fixed console.log: ${fixedConsoleLog}`);
console.log(`Fixed queryRawUnsafe: ${fixedQueryRaw}`);
console.log(`Fixed as any: ${fixedAsAny}`);

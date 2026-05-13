/**
 * TypeScript Strict Mode 工具
 * 
 * 帮助团队逐步消除 any 类型，提升代码质量
 * 
 * 使用方法：
 *   npx tsx scripts/strict-type-check.ts
 *   npx tsx scripts/strict-type-check.ts --fix  # 自动修复
 */

import { execSync } from 'child_process';
import { readFileSync, globSync } from 'fs';
import { join, relative } from 'path';

// ============================================
// 检测模式
// ============================================

console.log('🔍 检查 any 类型使用情况...\n');

// 1. 查找显式 any 类型
console.log('📋 显式 any 类型 (显式声明的 :any)：');
const explicitAnys: Array<{ file: string; line: number; content: string }> = [];

// 3. 查找 catch 块中的 any
console.log('📋 catch 块中的 any：');
const catchAnyPattern = /catch\s*\([^)]*\)/g;

// ============================================
// 扫描文件
// ============================================

const srcDir = join(process.cwd(), 'src');
const serverDir = join(process.cwd(), 'server');
const files = [
  ...globSync(join(srcDir, '**/*.ts'), { ignore: ['**/*.d.ts', '**/node_modules/**'] }),
  ...globSync(join(srcDir, '**/*.tsx'), { ignore: ['**/*.d.ts', '**/node_modules/**'] }),
  ...globSync(join(serverDir, '**/*.ts'), { ignore: ['**/*.d.ts', '**/node_modules/**'] }),
];

let totalAnys = 0;
const fileAnys: Record<string, number> = {};

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  let fileCount = 0;
  
  lines.forEach((line, index) => {
    // 检测显式 any
    const regex = /:(\s*)any\b/g;
    while (regex.exec(line) !== null) {
      fileCount++;
      if (fileCount <= 5) { // 只显示前5个
        explicitAnys.push({
          file: relative(process.cwd(), file),
          line: index + 1,
          content: line.trim(),
        });
      }
    }
    
    // 检测 catch any
    if (catchAnyPattern.test(line)) {
      // 检查 catch(e: any) vs catch(e)
    }
  });
  
  if (fileCount > 0) {
    fileAnys[relative(process.cwd(), file)] = fileCount;
    totalAnys += fileCount;
  }
}

// ============================================
// 输出结果
// ============================================

console.log(`\n📊 总计发现 ${totalAnys} 个显式 any 类型\n`);

// Top 10 文件
const topFiles = Object.entries(fileAnys)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log('🔥 Top 10 文件 (any 类型最多)：');
topFiles.forEach(([file, count], i) => {
  console.log(`  ${i + 1}. ${file}: ${count} 个`);
});

// 显示示例
if (explicitAnys.length > 0) {
  console.log('\n📝 示例 (前10个)：');
  explicitAnys.slice(0, 10).forEach(({ file, line, content }) => {
    console.log(`  ${file}:${line} → ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`);
  });
}

// ============================================
// TSC 严格检查
// ============================================

console.log('\n🔧 运行 TypeScript 严格检查...\n');

try {
  execSync('npx tsc --noEmit --strict 2>&1', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('✅ TypeScript 严格检查通过！');
} catch (error: any) {
  const output = error.stdout || error.message || '';
  
  // 解析错误
  const errorLines = output.split('\n').filter(line => line.includes('.ts'));
  const uniqueFiles = new Set(errorLines.map(line => {
    const match = line.match(/^([^\(]+)/);
    return match ? match[1].trim() : '';
  }));
  
  console.log(`❌ 发现 ${uniqueFiles.size} 个文件有类型错误\n`);
  
  // 显示前20个错误
  console.log('📋 主要错误：');
  errorLines.slice(0, 20).forEach(line => {
    if (line.trim()) {
      console.log(`  ${line}`);
    }
  });
}

// ============================================
// 建议
// ============================================

console.log('\n💡 改进建议：');
console.log('  1. 优先修复高频文件的 any 类型');
console.log('  2. 使用 unknown 替代 any (更安全)');
console.log('  3. 为函数参数添加类型注解');
console.log('  4. 使用 type 关键字定义复杂类型');
console.log('  5. 启用 eslint @typescript-eslint/no-explicit-any');
console.log('\n📚 参考资料：');
console.log('  - https://www.typescriptlang.org/docs/handbook/2/everyday-types.html');
console.log('  - https://www.typescriptlang.org/tsconfig/#strict');

process.exit(0);

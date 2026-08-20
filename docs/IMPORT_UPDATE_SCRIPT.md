# 导入路径自动化更新脚本

> 用于组件重构后自动更新项目中所有导入路径

## 1. 脚本概述

本脚本用于在组件目录重构后,自动更新项目中所有受影响的导入路径。

## 2. 核心逻辑

### 2.1 路径映射表

```typescript
const pathMappings = {
  // Layout 组件
  '@/components/Navbar': '@/components/layout/Navbar',
  '@/components/Footer': '@/components/layout/Footer',
  '@/components/Breadcrumb': '@/components/layout/Breadcrumb',
  '@/components/AdminLayout': '@/components/layout/AdminLayout',
  '@/components/AdminSidebar': '@/components/layout/AdminSidebar',
  '@/components/AdminTableShell': '@/components/layout/AdminTableShell',
  '@/components/PageTransition': '@/components/layout/PageTransition',

  // UI 组件
  '@/components/AdminActionButton': '@/components/ui/AdminActionButton',
  '@/components/AdminPageHeader': '@/components/ui/AdminPageHeader',
  '@/components/AdminStatCard': '@/components/ui/AdminStatCard',
  '@/components/StatusWrapper': '@/components/ui/StatusWrapper',
  '@/components/PageSeo': '@/components/ui/PageSeo',
  '@/components/SeoHead': '@/components/ui/SeoHead',
  '@/components/GlobalProgress': '@/components/ui/GlobalProgress',
  '@/components/LanternLogo': '@/components/ui/LanternLogo',

  // Form 组件
  '@/components/MatrixTagInput': '@/components/form/MatrixTagInput',
  '@/components/MatrixImageUpload': '@/components/form/MatrixImageUpload',
  '@/components/RichTextEditor': '@/components/form/RichTextEditor',
  '@/components/GlobalSettingsPanel': '@/components/form/GlobalSettingsPanel',

  // Business 组件
  '@/components/ServerCard': '@/components/business/ServerCard',
  '@/components/TicketCard': '@/components/business/TicketCard',
  '@/components/HomeFeatureCard': '@/components/business/HomeFeatureCard',
  '@/components/HomeStatCard': '@/components/business/HomeStatCard',
  '@/components/AnnouncementBanner': '@/components/business/AnnouncementBanner',
  '@/components/DynamicBranding': '@/components/business/DynamicBranding',
  '@/components/ThreeDHeadShowcase': '@/components/business/ThreeDHeadShowcase',
  '@/components/MatrixDialog': '@/components/business/MatrixDialog',

  // Skeleton 组件
  '@/components/Skeleton': '@/components/skeleton/BaseSkeleton',
};
```

### 2.2 Node.js 实现

```javascript
// scripts/update-imports.js
const fs = require('fs');
const path = require('path');

// 路径映射表
const pathMappings = {
  '@/components/Navbar': '@/components/layout/Navbar',
  '@/components/Footer': '@/components/layout/Footer',
  // ... 其他映射
};

// 支持的文件扩展名
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * 递归扫描目录下所有支持的文件
 */
function scanFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // 跳过 node_modules, .git 等
      if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
        scanFiles(fullPath, files);
      }
    } else if (extensions.includes(path.extname(item))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 更新文件中的导入路径
 */
function updateImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  for (const [oldPath, newPath] of Object.entries(pathMappings)) {
    // 匹配 import 语句中的路径
    const regex = new RegExp(
      `from\\s+['"]${oldPath}['"]`,
      'g'
    );

    if (regex.test(content)) {
      content = content.replace(regex, `from '${newPath}'`);
      modified = true;
    }

    // 匹配 export from 语句
    const exportRegex = new RegExp(
      `export\\s+.*\\s+from\\s+['"]${oldPath}['"]`,
      'g'
    );

    if (exportRegex.test(content)) {
      content = content.replace(exportRegex, (match) => {
        return match.replace(oldPath, newPath);
      });
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
    return true;
  }

  return false;
}

/**
 * 主函数
 */
function main() {
  const srcDir = path.join(__dirname, '../src');
  const files = scanFiles(srcDir);

  console.log(`Found ${files.length} files to scan`);

  let updatedCount = 0;
  for (const file of files) {
    if (updateImportsInFile(file)) {
      updatedCount++;
    }
  }

  console.log(`\nUpdated ${updatedCount} files`);
}

// 执行
main();
```

## 3. 使用方法

```bash
# 在项目根目录执行
cd qianfu-liandeng

# 安装依赖 (如果需要)
# npm install

# 执行更新脚本
node scripts/update-imports.js

# 检查是否还有遗漏
grep -r "@/components/[A-Z]" src/ --include="*.tsx" --include="*.ts" | grep -v "components/layout" | grep -v "components/business" | grep -v "components/form" | grep -v "components/ui" | grep -v "components/skeleton" | grep -v "components/mobile"
```

## 4. 安全检查

### 4.1 预检查脚本

```javascript
// scripts/pre-check-imports.js
const fs = require('fs');
const path = require('path');

const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const srcDir = path.join(__dirname, '../src');

// 扫描所有导入
const imports = new Set();

function scanFiles(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
        scanFiles(fullPath);
      }
    } else if (extensions.includes(path.extname(item))) {
      const content = fs.readFileSync(fullPath, 'utf-8');

      // 提取所有 import 路径
      const importRegex = /from\s+['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        if (match[1].startsWith('@/components/')) {
          imports.add(match[1]);
        }
      }
    }
  }
}

scanFiles(srcDir);

// 输出结果
console.log('Current component imports:');
Array.from(imports).sort().forEach(imp => {
  console.log(`  ${imp}`);
});
```

### 4.2 执行预检查

```bash
node scripts/pre-check-imports.js > before-refactor.txt
```

## 5. 验证脚本

### 5.1 验证导入路径正确性

```javascript
// scripts/verify-imports.js
const fs = require('fs');
const path = require('path');

const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const srcDir = path.join(__dirname, '../src');

// 组件目录
const validDirs = ['layout', 'business', 'form', 'ui', 'skeleton', 'mobile'];

const errors = [];

function scanFiles(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanFiles(fullPath);
    } else if (extensions.includes(path.extname(item))) {
      const content = fs.readFileSync(fullPath, 'utf-8');

      // 检查组件导入是否指向有效目录
      const importRegex = /from\s+['"](@\/components\/[^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        const parts = importPath.split('/');

        // 检查第三级目录是否有效
        if (parts.length >= 3 && parts[1] === 'components') {
          const category = parts[2];

          if (!validDirs.includes(category)) {
            errors.push({
              file: fullPath,
              import: importPath,
              message: `Invalid component directory: ${category}`
            });
          }
        }
      }
    }
  }
}

scanFiles(srcDir);

if (errors.length > 0) {
  console.log(`Found ${errors.length} invalid imports:`);
  errors.forEach(e => {
    console.log(`  ${e.file}: ${e.import}`);
    console.log(`    -> ${e.message}`);
  });
  process.exit(1);
} else {
  console.log('All imports are valid!');
}
```

## 6. 一键迁移脚本

```bash
#!/bin/bash
# scripts/migrate-and-update.sh

set -e

echo "========================================"
echo "组件重构 + 导入路径更新"
echo "========================================"

# 1. 创建备份
echo ""
echo "[1/4] 创建备份..."
BACKUP_DIR="src/components.backup.$(date +%Y%m%d_%H%M%S)"
cp -r src/components "$BACKUP_DIR"
echo "备份已创建: $BACKUP_DIR"

# 2. 执行迁移
echo ""
echo "[2/4] 执行组件迁移..."
./scripts/refactor-components.sh

# 3. 更新导入路径
echo ""
echo "[3/4] 更新导入路径..."
node scripts/update-imports.js

# 4. 验证
echo ""
echo "[4/4] 验证导入路径..."
node scripts/verify-imports.js

echo ""
echo "========================================"
echo "迁移完成!"
echo "========================================"
```

## 7. 常见问题

### Q1: 脚本执行失败怎么办?

检查是否已安装 Node.js:
```bash
node --version
```

### Q2: 如何只更新部分导入?

修改 `pathMappings` 对象,只保留需要更新的映射。

### Q3: 如何查看哪些文件会被修改?

使用 `--dry-run` 模式(需修改脚本支持):
```javascript
const dryRun = process.argv.includes('--dry-run');
```

### Q4: 误操作如何恢复?

```bash
# 恢复组件目录
rm -rf src/components
mv src/components.backup.xxx src/components

# 恢复源代码
git checkout -- src/
```

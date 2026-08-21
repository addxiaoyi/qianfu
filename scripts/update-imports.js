/**
 * 导入路径自动化更新脚本
 * 用于组件目录重构后自动更新项目中所有导入路径
 *
 * 使用方法: node scripts/update-imports.js
 */

const fs = require('fs');
const path = require('path');

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

// 路径映射表 - 原路径: 新路径
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
  '@/components/GeometricLantern': '@/components/ui/GeometricLantern',

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

// 支持的文件扩展名
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * 递归扫描目录下所有支持的文件
 */
function scanFiles(dir, files = []) {
  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      let stat;

      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        log.warn(`无法访问: ${fullPath}`);
        continue;
      }

      if (stat.isDirectory()) {
        // 跳过 node_modules, .git 等
        if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
          scanFiles(fullPath, files);
        }
      } else if (extensions.includes(path.extname(item))) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    log.warn(`无法读取目录: ${dir}`);
  }

  return files;
}

/**
 * 更新文件中的导入路径
 */
function updateImportsInFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    log.warn(`无法读取文件: ${filePath}`);
    return false;
  }

  let modified = false;
  const changes = [];

  for (const [oldPath, newPath] of Object.entries(pathMappings)) {
    // 匹配 import 语句中的路径 (单引号或双引号)
    const patterns = [
      new RegExp(`from\\s+['"]${escapeRegExp(oldPath)}['"]`, 'g'),
      new RegExp(`from\\s+['"]${escapeRegExp(oldPath)}/['"]`, 'g'), // 可能是 from '@/components/X/'
    ];

    for (const regex of patterns) {
      if (regex.test(content)) {
        const newRegex = new RegExp(escapeRegExp(oldPath), 'g');
        content = content.replace(regex, (match) => {
          return match.replace(newRegex, newPath);
        });
        changes.push(`${oldPath} -> ${newPath}`);
        modified = true;
      }
    }

    // 匹配 export from 语句
    const exportRegex = new RegExp(
      `export\\s+.*\\s+from\\s+['"]${escapeRegExp(oldPath)}['"]`,
      'g'
    );

    if (exportRegex.test(content)) {
      content = content.replace(exportRegex, (match) => {
        return match.replace(new RegExp(escapeRegExp(oldPath), 'g'), newPath);
      });
      changes.push(`export: ${oldPath} -> ${newPath}`);
      modified = true;
    }
  }

  if (modified) {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      log.success(`更新: ${path.relative(process.cwd(), filePath)}`);
      changes.forEach(c => log.info(`  ${c}`));
      return true;
    } catch (e) {
      log.error(`无法写入文件: ${filePath}`);
      return false;
    }
  }

  return false;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 主函数
 */
function main() {
  console.log('');
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  导入路径自动化更新脚本 v1.0${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log('');

  const srcDir = path.join(__dirname, '../src');

  if (!fs.existsSync(srcDir)) {
    log.error(`目录不存在: ${srcDir}`);
    process.exit(1);
  }

  log.info(`扫描目录: ${srcDir}`);
  const files = scanFiles(srcDir);
  log.info(`找到 ${files.length} 个文件`);
  console.log('');

  let updatedCount = 0;
  for (const file of files) {
    if (updateImportsInFile(file)) {
      updatedCount++;
    }
  }

  console.log('');
  console.log(`${colors.green}========================================${colors.reset}`);
  console.log(`${colors.green}  完成!${colors.reset}`);
  console.log(`${colors.green}========================================${colors.reset}`);
  log.info(`更新了 ${updatedCount} 个文件`);

  if (updatedCount === 0) {
    log.info('没有文件需要更新');
  }
}

// 执行
main();

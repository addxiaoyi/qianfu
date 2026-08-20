/**
 * CSP imgSrc 自动配置脚本
 *
 * 功能：
 * 1. 扫描项目中的 CDN 引用
 * 2. 提取唯一域名
 * 3. 自动生成 CSP imgSrc 配置
 *
 * 运行方式：node scripts/update-csp-img-src.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// CDN 域名提取正则
const CDN_PATTERNS = [
  // https://cdn.example.com/path
  /https?:\/\/([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s'"]*)?/g,
  // //cdn.example.com/path (协议相对)
  /\/\/([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s'"]*)?/g,
];

// 信任的 CDN 域名白名单（可自行添加）
const TRUSTED_CDNS = new Set([
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'images.unsplash.com',
  'img.shields.io',
  'api.dicebear.com',
  'api.iconify.design',
  'picsum.photos',
  'tinymce.com',
  'tiny.cloud',
  'bilibili.com',
  'youku.com',
  'youtube.com',
  'qq.com',
  'weixin.qq.com',
  'tencent.com',
  'baidu.com',
  'aliyuncs.com',
  'qiniu.com',
  'cos.tencentcos.com',
  'oss-cn-hangzhou.aliyuncs.com',
  'oss-cn-beijing.aliyuncs.com',
]);

// 排除的非图片域名
const EXCLUDE_DOMAINS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'fonts.bunny.net',
]);

function extractDomains(content) {
  const domains = new Set();

  for (const pattern of CDN_PATTERNS) {
    const matches = content.match(pattern) || [];
    for (const url of matches) {
      try {
        const urlObj = new URL(url.startsWith('//') ? 'https:' + url : url);
        const hostname = urlObj.hostname;

        // 跳过 localhost 和 IP 地址
        if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
          continue;
        }

        // 跳过排除的域名
        if (EXCLUDE_DOMAINS.has(hostname)) {
          continue;
        }

        // 检查是否在白名单中或是子域名
        const isTrusted = TRUSTED_CDNS.has(hostname) ||
          Array.from(TRUSTED_CDNS).some(cdn => hostname.endsWith('.' + cdn));

        if (isTrusted) {
          domains.add(hostname);
        }
      } catch (e) {
        // 忽略无效 URL
      }
    }
  }

  return domains;
}

function scanProject() {
  const allDomains = new Set();
  const fileStats = { scanned: 0, found: 0 };

  // 需要扫描的文件类型
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.html', '.css'];

  // 排除的目录
  const excludeDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '__pycache__',
    'public/tinymce', // TinyMCE 第三方库
  ];

  function shouldExclude(filePath) {
    return excludeDirs.some(dir => filePath.includes(path.sep + dir + path.sep));
  }

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!shouldExclude(fullPath)) {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext) || entry.name.endsWith('.json')) {
          fileStats.scanned++;

          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const domains = extractDomains(content);

            if (domains.size > 0) {
              fileStats.found++;
              domains.forEach(d => allDomains.add(d));
              console.log(`  📦 ${path.relative(projectRoot, fullPath)}: ${[...domains].join(', ')}`);
            }
          } catch (e) {
            // 忽略读取错误
          }
        }
      }
    }
  }

  console.log('🔍 扫描项目中...\n');
  scanDirectory(path.join(projectRoot, 'qianfu-liandeng'));
  scanDirectory(path.join(projectRoot, 'server'));

  return { domains: allDomains, stats: fileStats };
}

function generateCSPConfig(domains) {
  // 基础配置
  const baseConfig = [
    "'self'",
    'data:',
    'blob:',
  ];

  // 转换为 CSP 格式
  const cdnDomains = [...domains].map(d => `https://${d}`);

  // 合并并排序
  const allSources = [...baseConfig, ...cdnDomains].sort((a, b) => {
    // 'self' 放最前面
    if (a === "'self'") return -1;
    if (b === "'self'") return 1;
    return a.localeCompare(b);
  });

  return allSources;
}

function updateSecurityFile(cspConfig) {
  const securityFile = path.join(projectRoot, 'server/bootstrap/security.ts');

  if (!fs.existsSync(securityFile)) {
    console.error('❌ 未找到 security.ts 文件');
    return false;
  }

  const content = fs.readFileSync(securityFile, 'utf-8');
  const cspString = JSON.stringify(cspConfig);

  // 检查是否已有 imgSrc 配置
  if (content.includes("imgSrc:")) {
    // 替换现有的 imgSrc
    const newContent = content.replace(
      /imgSrc:\s*\[.*?\],/s,
      `imgSrc: ${cspString},`
    );

    fs.writeFileSync(securityFile, newContent);
    return true;
  } else {
    console.error('❌ 未在 security.ts 中找到 imgSrc 配置');
    return false;
  }
}

function main() {
  return new Promise(async (resolve, reject) => {
    console.log('===========================================');
    console.log('    CSP imgSrc 自动配置工具');
    console.log('===========================================\n');

  // 1. 扫描项目
  const { domains, stats } = scanProject();

  console.log('\n-------------------------------------------');
  console.log(`📊 扫描统计: ${stats.scanned} 个文件, ${stats.found} 个文件包含 CDN 引用`);
  console.log('-------------------------------------------');

  if (domains.size === 0) {
    console.log('\n⚠️  未检测到任何 CDN 域名');
    console.log('💡 检查文件是否包含 HTTPS URL');
    resolve();
    return;
  }

  // 2. 显示检测到的域名
  console.log('\n📋 检测到的图片 CDN 域名:');
  [...domains].sort().forEach(d => console.log(`   - ${d}`));

  // 3. 生成配置
  const cspConfig = generateCSPConfig(domains);

  console.log('\n-------------------------------------------');
  console.log('📝 生成的 CSP imgSrc 配置:');
  console.log('-------------------------------------------');
  console.log(cspConfig.map(s => `  ${s}`).join('\n'));

  // 4. 询问是否更新 (自动模式)
  console.log('\n-------------------------------------------');
  console.log('🔄 自动更新 security.ts...');

  if (updateSecurityFile(cspConfig)) {
    console.log('\n✅ security.ts 已更新!');
    console.log('💡 请重新构建并部署以生效');
  } else {
    console.log('\n❌ 更新失败');
  }

  // 5. 输出 .env 建议
  console.log('\n-------------------------------------------');
  console.log('📋 环境变量检查:');
  console.log('-------------------------------------------');
  const envFile = path.join(projectRoot, 'server/.env');
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf-8');
    const cdnDomain = envContent.match(/^CDN_DOMAIN=(.*)$/m)?.[1]?.trim();
    const cdnSecret = envContent.match(/^CDN_SECRET=(.*)$/m)?.[1]?.trim();

    if (!cdnDomain) {
      console.log('⚠️  CDN_DOMAIN 未配置');
    } else {
      console.log(`✅ CDN_DOMAIN: ${cdnDomain}`);
    }

    if (!cdnSecret) {
      console.log('⚠️  CDN_SECRET 未配置');
    } else {
      console.log('✅ CDN_SECRET: 已配置');
    }
  } else {
    console.log('💡 请复制 server/.env.example 为 server/.env 并配置');
  }

  resolve();
  });
}

// 运行
main().catch(console.error);

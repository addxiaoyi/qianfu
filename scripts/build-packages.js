#!/usr/bin/env node
/**
 * 构建 packages 共享包
 * 将所有 @qianfu/* 包编译到 dist 目录
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

function log(message, color = '\x1b[36m') {
  console.log(`${color}[build-packages]\x1b[0m ${message}`);
}

function run(command, cwd) {
  log(`Running: ${command}`);
  try {
    execSync(command, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    return true;
  } catch (error) {
    log(`Failed: ${command}`, '\x1b[31m');
    return false;
  }
}

async function main() {
  console.log('\n\x1b[36m╔══════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║     Building Shared Packages          ║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════╝\x1b[0m\n');

  if (!fs.existsSync(PACKAGES_DIR)) {
    log('No packages directory found, skipping...', '\x1b[33m');
    return;
  }

  const packages = fs.readdirSync(PACKAGES_DIR).filter((dir) => {
    const pkgJson = path.join(PACKAGES_DIR, dir, 'package.json');
    return fs.existsSync(pkgJson);
  });

  if (packages.length === 0) {
    log('No packages found, skipping...', '\x1b[33m');
    return;
  }

  log(`Found ${packages.length} packages: ${packages.join(', ')}\n`);

  let success = true;

  for (const pkg of packages) {
    const pkgDir = path.join(PACKAGES_DIR, pkg);
    const pkgJson = require(path.join(pkgDir, 'package.json'));

    console.log(`\n\x1b[35m─── Building ${pkg} v${pkgJson.version} ───\x1b[0m`);

    // Clean dist
    const distDir = path.join(pkgDir, 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    // Build
    if (!run('npm run build', pkgDir)) {
      success = false;
      continue;
    }

    log(`✓ ${pkg} built successfully`, '\x1b[32m');
  }

  console.log('\n');

  if (success) {
    log('All packages built successfully!', '\x1b[32m');
    process.exit(0);
  } else {
    log('Some packages failed to build', '\x1b[31m');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

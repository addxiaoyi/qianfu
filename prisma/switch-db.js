#!/usr/bin/env node
/**
 * Prisma 数据库切换脚本
 * 支持 SQLite 和 PostgreSQL 之间的切换
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const schema = args[0] || 'sqlite';

console.log(`🔄 切换到 ${schema === 'postgres' ? 'PostgreSQL' : 'SQLite'}...\n`);

switch (schema) {
  case 'sqlite':
    console.log('📦 使用 SQLite schema...');
    process.env.DATABASE_URL = 'file:./dev.db';
    try {
      execSync('npx prisma generate --schema=prisma/schema.prisma', { stdio: 'inherit' });
      console.log('✅ SQLite Prisma Client 生成完成');
    } catch (e) {
      console.error('❌ SQLite 生成失败:', e.message);
      process.exit(1);
    }
    break;

  case 'postgres':
    console.log('📦 使用 PostgreSQL schema...');
    if (!process.env.DATABASE_URL) {
      console.error('❌ 请设置 DATABASE_URL 环境变量');
      console.log('   例如: DATABASE_URL="postgresql://user:pass@localhost:5432/qianfu" npm run db:switch -- postgres');
      process.exit(1);
    }
    try {
      execSync('npx prisma generate --schema=prisma/schema.postgresql.prisma', { stdio: 'inherit' });
      console.log('✅ PostgreSQL Prisma Client 生成完成');
    } catch (e) {
      console.error('❌ PostgreSQL 生成失败:', e.message);
      process.exit(1);
    }
    break;

  case 'dev':
    console.log('📦 开发模式 (SQLite push)...');
    process.env.DATABASE_URL = 'file:./dev.db';
    try {
      execSync('npx prisma db push --schema=prisma/schema.prisma', { stdio: 'inherit' });
      console.log('✅ SQLite 数据库同步完成');
    } catch (e) {
      console.error('❌ 数据库同步失败:', e.message);
      process.exit(1);
    }
    break;

  case 'prod':
    console.log('📦 生产模式 (PostgreSQL migrate)...');
    if (!process.env.DATABASE_URL) {
      console.error('❌ 请设置 DATABASE_URL 环境变量');
      process.exit(1);
    }
    try {
      execSync('npx prisma migrate deploy --schema=prisma/schema.postgresql.prisma', { stdio: 'inherit' });
      console.log('✅ PostgreSQL 迁移完成');
    } catch (e) {
      console.error('❌ 迁移失败:', e.message);
      process.exit(1);
    }
    break;

  case 'install':
    // 检测操作系统并运行安装脚本
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      console.log('⚠️ 请手动运行: powershell -ExecutionPolicy Bypass -File ./scripts/install-postgresql.ps1');
    } else {
      console.log('🔧 运行 PostgreSQL 安装脚本...');
      execSync('bash ./scripts/install-postgresql.sh', { stdio: 'inherit' });
    }
    break;

  default:
    console.log(`
用法: npm run db:switch -- [sqlite|postgres|dev|prod|install]

  sqlite     - 使用 SQLite schema (开发)
  postgres   - 使用 PostgreSQL schema (生产)
  dev        - 开发模式 (SQLite push)
  prod       - 生产模式 (PostgreSQL migrate)
  install    - 安装 PostgreSQL

示例:
  npm run db:switch -- sqlite      # 切换到 SQLite
  npm run db:switch -- postgres    # 切换到 PostgreSQL
  DATABASE_URL="postgresql://..." npm run db:switch -- prod
    `);
    process.exit(1);
}

console.log('\n✅ 完成!');

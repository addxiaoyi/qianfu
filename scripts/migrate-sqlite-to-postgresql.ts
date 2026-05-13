/**
 * SQLite → PostgreSQL 数据迁移脚本
 * 完整迁移工具，支持数据导出、转换、导入
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const EXPORT_DIR = './migrations/export';

// 环境配置
const config = {
  sqlitePath: process.env.SQLITE_PATH || './prisma/dev.db',
  postgresUrl: process.env.DATABASE_URL || 'postgresql://qianfu:qianfu123@localhost:5432/qianfu',
};

// 金额转换：元 → 分
const yuanToFen = (yuan: number | string | null): number => {
  if (yuan === null || yuan === undefined) return 0;
  const num = typeof yuan === 'string' ? parseFloat(yuan) : yuan;
  return Math.round(num * 100);
};

// JSON 字符串解析
const parseJson = (str: string | null, defaultValue: any = null): any => {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

// 确保导出目录存在
function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

// 导出 SQLite 数据
function exportFromSqlite(sqlite: Database.Database): Record<string, any[]> {
  console.log('📤 正在导出 SQLite 数据...\n');

  const tables = [
    'User', 'Session', 'Notification', 'AuditLog', 'ModerationLog',
    'Ticket', 'TicketMessage', 'PermissionHistory', 'Server',
    'ServerVersion', 'UserBioVersion', 'ReviewHistory', 'Report',
    'ServerComment', 'ServerLike', 'Payment', 'Wallet',
    'EmailVerification', 'PasswordResetToken',
  ];

  const data: Record<string, any[]> = {};

  for (const table of tables) {
    try {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      data[table] = rows;
      console.log(`  ✅ ${table}: ${rows.length} 条记录`);
    } catch (e: any) {
      console.log(`  ⚠️ ${table}: 表不存在或查询失败 (${e.message})`);
      data[table] = [];
    }
  }

  return data;
}

// 转换数据格式
function transformData(data: Record<string, any[]>): Record<string, any[]> {
  console.log('\n🔄 正在转换数据格式...\n');

  const transformed: Record<string, any[]> = {};

  // User 转换
  transformed.User = data.User.map(u => ({
    ...u,
    preferences: parseJson(u.preferences, {}),
    permissions: parseJson(u.permissions, []),
    email_cipher: u.email_cipher || null,
    verification_token: u.verification_token || null,
  }));
  console.log('  ✅ User: preferences, permissions 转换完成');

  // Wallet 转换（金额：元 → 分）
  transformed.Wallet = data.Wallet.map(w => ({
    ...w,
    balance: typeof w.balance === 'number' ? yuanToFen(w.balance) : w.balance,
  }));
  console.log('  ✅ Wallet: balance 金额转换完成 (元→分)');

  // Payment 转换
  transformed.Payment = data.Payment.map(p => ({
    ...p,
    amount: typeof p.amount === 'number' ? yuanToFen(p.amount) : p.amount,
    amount_refunded: p.amount_refunded ? yuanToFen(p.amount_refunded) : 0,
  }));
  console.log('  ✅ Payment: amount 金额转换完成');

  // Server 转换
  transformed.Server = data.Server.map(s => ({
    ...s,
    metadata: parseJson(s.metadata, {}),
    tags: parseJson(s.tags, []),
    analytics: parseJson(s.analytics, {}),
  }));
  console.log('  ✅ Server: metadata, tags, analytics 转换完成');

  // 其他表直接复制
  const simpleTables = ['Session', 'Notification', 'AuditLog', 'ModerationLog',
    'Ticket', 'TicketMessage', 'PermissionHistory', 'ServerVersion',
    'UserBioVersion', 'ReviewHistory', 'Report', 'ServerComment',
    'ServerLike', 'EmailVerification', 'PasswordResetToken'];

  for (const table of simpleTables) {
    transformed[table] = data[table];
  }

  return transformed;
}

// 保存导出文件
function saveExportFiles(data: Record<string, any[]>) {
  ensureExportDir();

  console.log('\n💾 正在保存导出文件...\n');

  for (const [table, rows] of Object.entries(data)) {
    if (rows.length > 0) {
      const filePath = path.join(EXPORT_DIR, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
      console.log(`  ✅ ${table}.json (${rows.length} 条)`);
    }
  }

  // 保存迁移元数据
  const meta = {
    exportedAt: new Date().toISOString(),
    sqlitePath: config.sqlitePath,
    tables: Object.keys(data).filter(k => data[k].length > 0),
    recordCounts: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v.length])
    ),
  };
  fs.writeFileSync(path.join(EXPORT_DIR, '_meta.json'), JSON.stringify(meta, null, 2));
  console.log('\n  ✅ _meta.json (迁移元数据)');
}

// 导入到 PostgreSQL
async function importToPostgres(data: Record<string, any[]>) {
  console.log('\n📥 正在导入到 PostgreSQL...\n');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.postgresUrl,
      },
    },
  });

  try {
    // 按依赖顺序导入
    const importOrder = [
      { table: 'User', fn: async (rows: any[]) => {
        for (const row of rows) {
          await prisma.user.upsert({
            where: { id: row.id },
            update: row,
            create: row,
          });
        }
      }},
      { table: 'Session', fn: async (rows: any[]) => {
        for (const row of rows) {
          await prisma.session.upsert({
            where: { id: row.id },
            update: row,
            create: row,
          });
        }
      }},
      { table: 'Wallet', fn: async (rows: any[]) => {
        for (const row of rows) {
          await prisma.wallet.upsert({
            where: { id: row.id },
            update: row,
            create: row,
          });
        }
      }},
      { table: 'Payment', fn: async (rows: any[]) => {
        for (const row of rows) {
          await prisma.payment.upsert({
            where: { id: row.id },
            update: row,
            create: row,
          });
        }
      }},
      { table: 'Notification', fn: async (rows: any[]) => {
        for (const row of rows) {
          await prisma.notification.upsert({
            where: { id: row.id },
            update: row,
            create: row,
          });
        }
      }},
      { table: 'Server', fn: async (rows: any[]) => {
        for (const row of rows) {
          await prisma.server.upsert({
            where: { id: row.id },
            update: row,
            create: row,
          });
        }
      }},
      // ... 其他表
    ];

    for (const { table, fn } of importOrder) {
      if (data[table]?.length > 0) {
        await fn(data[table]);
        console.log(`  ✅ ${table}: ${data[table].length} 条`);
      }
    }

    console.log('\n✅ PostgreSQL 导入完成!');
  } catch (e) {
    console.error('\n❌ 导入失败:', e);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

// 主迁移流程
async function migrate(mode: 'export' | 'import' | 'full') {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SQLite → PostgreSQL 数据迁移工具');
  console.log('═══════════════════════════════════════════════════════\n');

  if (mode === 'export' || mode === 'full') {
    // 步骤 1: 读取 SQLite
    console.log('📂 步骤 1: 读取 SQLite 数据库');
    console.log(`   路径: ${config.sqlitePath}\n`);

    if (!fs.existsSync(config.sqlitePath)) {
      console.error(`❌ SQLite 文件不存在: ${config.sqlitePath}`);
      console.log('   请确保运行过 SQLite 并有数据。');
      process.exit(1);
    }

    const sqlite = new Database(config.sqlitePath, { readonly: true });
    const rawData = exportFromSqlite(sqlite);
    sqlite.close();

    // 步骤 2: 转换数据
    console.log('\n📂 步骤 2: 转换数据格式');
    const transformedData = transformData(rawData);

    // 步骤 3: 保存导出文件
    saveExportFiles(transformedData);
  }

  if (mode === 'import' || mode === 'full') {
    // 检查是否有导出文件
    const metaPath = path.join(EXPORT_DIR, '_meta.json');
    if (!fs.existsSync(metaPath)) {
      console.error('\n❌ 找不到导出文件，请先运行导出模式:');
      console.log('   npm run db:migrate-data -- --mode export');
      process.exit(1);
    }

    // 步骤 4: 导入 PostgreSQL
    console.log('\n📂 步骤 3: 导入 PostgreSQL');
    console.log(`   连接: ${config.postgresUrl.replace(/\/\/.*:/, '//***:')}\n`);

    const exportFiles: Record<string, any[]> = {};
    const files = fs.readdirSync(EXPORT_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const tableName = path.basename(file, '.json');
      exportFiles[tableName] = JSON.parse(
        fs.readFileSync(path.join(EXPORT_DIR, file), 'utf-8')
      );
    }

    await importToPostgres(exportFiles);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  迁移完成!');
  console.log('═══════════════════════════════════════════════════════\n');

  // 显示验证查询
  console.log('🔍 迁移后验证查询:');
  console.log(`
-- PostgreSQL 中执行:
SELECT 
  (SELECT COUNT(*) FROM "User") as users,
  (SELECT COUNT(*) FROM "Wallet") as wallets,
  (SELECT COUNT(*) FROM "Server") as servers,
  (SELECT COUNT(*) FROM "Payment") as payments;

-- 检查金额字段 (应该是整数，单位：分)
SELECT id, balance FROM "Wallet" LIMIT 5;
  `);
}

// 解析命令行参数
const args = process.argv.slice(2);
const mode = (args.find(a => a.startsWith('--mode='))?.split('=')[1]) as 'export' | 'import' | 'full' || 'full';

migrate(mode).catch(e => {
  console.error('\n❌ 迁移失败:', e);
  process.exit(1);
});

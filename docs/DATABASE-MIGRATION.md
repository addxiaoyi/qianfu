# 数据库迁移路径：SQLite → PostgreSQL

> 目标：安全、平滑地从 SQLite 迁移到 PostgreSQL
> 预计工期：1-2 周

---

## 1. 迁移策略概述

```
┌─────────────────────────────────────────────────────────────────┐
│                      Migration Strategy                              │
└─────────────────────────────────────────────────────────────────┘

阶段 1: 准备阶段 (1-3 天)
├── 创建 PostgreSQL 环境
├── 设计新数据模型
├── 编写迁移脚本
└── 建立回滚方案

阶段 2: 测试阶段 (2-3 天)
├── 测试数据迁移
├── 验证数据完整性
├── 性能基准测试
└── 压力测试

阶段 3: 灰度迁移 (3-5 天)
├── 同步数据
├── 验证应用兼容性
├── 逐步切换流量
└── 监控迁移状态

阶段 4: 收尾阶段 (1-2 天)
├── 停止 SQLite
├── 清理临时数据
├── 备份验证
└── 文档更新
```

## 2. 数据模型转换

### 2.1 SQLite → PostgreSQL 类型映射

| SQLite 类型 | PostgreSQL 类型 | 注意事项 |
|-------------|-----------------|----------|
| INTEGER | INT / BIGSERIAL | 自增用 SERIAL |
| REAL | DOUBLE PRECISION | 金额用 NUMERIC |
| TEXT | VARCHAR(n) / TEXT | 有长度用 VARCHAR |
| BLOB | BYTEA | 二进制数据 |
| BOOLEAN | BOOLEAN | SQLite 用 0/1 |
| DATETIME | TIMESTAMPTZ | 推荐带时区 |

### 2.2 新 Schema 设计

```sql
-- PostgreSQL Schema for QianFu

-- 用户表 (优化)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    username VARCHAR(20) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'NORMAL',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    password_changed_at TIMESTAMPTZ,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    token_expiry TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    login_count INT DEFAULT 0,
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',
    bio_html TEXT,
    permissions JSONB DEFAULT '[]',
    experience_points INT DEFAULT 0,
    
    -- 约束
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT username_format CHECK (username ~* '^[a-zA-Z0-9_-]{3,20}$')
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- 会话表
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent TEXT,
    ip_address INET,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE is_revoked = FALSE;

-- 服务器表 (分表设计)
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    thumbnail TEXT,
    summary TEXT,
    summary_en TEXT,
    content_html TEXT,
    ip VARCHAR(45),
    group_number VARCHAR(50),
    tags JSONB DEFAULT '[]',
    link TEXT,
    activity INT DEFAULT 0,
    synced_at TIMESTAMPTZ,
    review_status VARCHAR(20) DEFAULT 'PENDING',
    review_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    platform VARCHAR(20),
    category VARCHAR(50),
    online_mode BOOLEAN,
    supported_versions JSONB DEFAULT '[]',
    network_env JSONB DEFAULT '[]',
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    
    -- 约束
    CONSTRAINT ip_format CHECK (ip ~* '^([0-9]{1,3}\.){3}[0-9]{1,3}$' OR ip IS NULL)
);

-- 索引 (搜索优化)
CREATE INDEX idx_servers_owner ON servers(owner_id);
CREATE INDEX idx_servers_review_status ON servers(review_status);
CREATE INDEX idx_servers_activity ON servers(activity DESC);
CREATE INDEX idx_servers_created ON servers(created_at DESC);
CREATE INDEX idx_servers_name_fts ON servers USING gin(to_tsvector('english', name));
CREATE INDEX idx_servers_platform ON servers(platform) WHERE platform IS NOT NULL;
CREATE INDEX idx_servers_category ON servers(category) WHERE category IS NOT NULL;

-- 复合索引
CREATE INDEX idx_servers_review_activity ON servers(review_status, activity DESC) 
    WHERE review_status = 'APPROVED';

-- 审计日志表 (分区设计)
CREATE TABLE audit_logs (
    id BIGSERIAL,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target VARCHAR(255),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 按月分区
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... 更多分区

-- 钱包表 (金额精确)
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) DEFAULT 0 CHECK (balance >= 0),
    currency VARCHAR(3) DEFAULT 'CNY',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- 交易表
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    description TEXT,
    metadata JSONB,
    signature VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT amount_nonzero CHECK (amount != 0)
);

CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
```

## 3. 迁移脚本

### 3.1 数据迁移脚本

```typescript
// scripts/migrate-sqlite-to-postgres.ts

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { logger } from '../server/utils/logger';

const sqliteDb = new Database('./prisma/dev.db');
const prisma = new PrismaClient();

async function migrate() {
  logger.info('[Migration] Starting SQLite to PostgreSQL migration...');

  try {
    // 1. 迁移用户
    logger.info('[Migration] Migrating users...');
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    
    for (const user of users) {
      await prisma.$executeRaw`
        INSERT INTO users (
          id, email, password_hash, username, display_name,
          avatar_url, role, created_at, updated_at, email_verified,
          preferences, bio_html, permissions, experience_points
        ) VALUES (
          gen_random_uuid(),
          ${user.email},
          ${user.password_hash},
          ${user.username},
          ${user.display_name},
          ${user.avatar_url},
          ${user.role || 'NORMAL'},
          ${user.created_at},
          ${user.updated_at},
          ${user.email_verified === 1},
          ${user.preferences || '{}'},
          ${user.bio_html},
          ${user.permissions || '[]'},
          ${user.experience_points || 0}
        )
        ON CONFLICT (email) DO NOTHING
      `;
    }
    logger.info(`[Migration] Migrated ${users.length} users`);

    // 2. 迁移会话
    logger.info('[Migration] Migrating sessions...');
    const sessions = sqliteDb.prepare('SELECT * FROM sessions').all();
    
    for (const session of sessions) {
      // 先查找对应的 user
      const user = sqliteDb.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).get(session.user_id);
      
      if (!user) {
        logger.warn(`[Migration] Skipping session ${session.id} - user not found`);
        continue;
      }

      await prisma.$executeRaw`
        INSERT INTO sessions (id, user_id, token, expires_at, user_agent, is_revoked, created_at)
        VALUES (
          ${session.id},
          (SELECT id FROM users WHERE email = ${user.email}),
          ${session.token},
          ${session.expires_at},
          ${session.user_agent},
          ${session.is_revoked === 1},
          ${session.created_at}
        )
        ON CONFLICT (token) DO NOTHING
      `;
    }
    logger.info(`[Migration] Migrated ${sessions.length} sessions`);

    // 3. 迁移服务器
    logger.info('[Migration] Migrating servers...');
    const servers = sqliteDb.prepare('SELECT * FROM servers').all();
    
    for (const server of servers) {
      const owner = sqliteDb.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).get(server.owner_id);
      
      if (!owner) {
        logger.warn(`[Migration] Skipping server ${server.id} - owner not found`);
        continue;
      }

      await prisma.$executeRaw`
        INSERT INTO servers (
          id, owner_id, name, name_en, thumbnail, summary, ip,
          group_number, tags, link, activity, synced_at, review_status,
          created_at, updated_at, platform, category, online_mode,
          supported_versions, network_env, like_count, comment_count
        ) VALUES (
          gen_random_uuid(),
          (SELECT id FROM users WHERE email = ${owner.email}),
          ${server.name},
          ${server.name_en},
          ${server.thumbnail},
          ${server.summary},
          ${server.ip},
          ${server.group_number},
          ${server.tags || '[]'},
          ${server.link},
          ${server.activity || 0},
          ${server.synced_at},
          ${server.review_status || 'PENDING'},
          ${server.created_at},
          ${server.updated_at},
          ${server.platform},
          ${server.category},
          ${server.online_mode},
          ${server.supported_versions || '[]'},
          ${server.network_env || '[]'},
          ${server.like_count || 0},
          ${server.comment_count || 0}
        )
        ON CONFLICT DO NOTHING
      `;
    }
    logger.info(`[Migration] Migrated ${servers.length} servers`);

    // 4. 验证迁移
    logger.info('[Migration] Verifying migration...');
    const pgUserCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM users`;
    const pgServerCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM servers`;
    
    logger.info(`[Migration] PostgreSQL users: ${pgUserCount}`);
    logger.info(`[Migration] PostgreSQL servers: ${pgServerCount}`);
    
    logger.info('[Migration] Migration completed successfully!');
  } catch (error) {
    logger.error('[Migration] Migration failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await prisma.$disconnect();
  }
}

migrate();
```

### 3.2 数据同步脚本

```typescript
// scripts/sync-sqlite-to-postgres.ts

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const sqliteDb = new Database('./prisma/dev.db');
const prisma = new PrismaClient();

// 增量同步 - 记录上次同步时间
let lastSyncTime = new Date(0);

async function incrementalSync() {
  // 获取 SQLite 中更新的记录
  const updatedUsers = sqliteDb.prepare(`
    SELECT * FROM users 
    WHERE updated_at > ?
  `).all(lastSyncTime);

  const updatedServers = sqliteDb.prepare(`
    SELECT * FROM servers 
    WHERE updated_at > ?
  `).all(lastSyncTime);

  // 同步更新
  for (const user of updatedUsers) {
    await prisma.$executeRaw`
      UPDATE users SET
        username = ${user.username},
        display_name = ${user.display_name},
        avatar_url = ${user.avatar_url},
        updated_at = ${user.updated_at}
      WHERE email = ${user.email}
    `;
  }

  for (const server of updatedServers) {
    await prisma.$executeRaw`
      UPDATE servers SET
        name = ${server.name},
        summary = ${server.summary},
        activity = ${server.activity},
        updated_at = ${server.updated_at}
      WHERE ip = ${server.ip} AND owner_id = (
        SELECT id FROM users WHERE email = (
          SELECT email FROM sqlite_users WHERE id = ${server.owner_id}
        )
      )
    `;
  }

  lastSyncTime = new Date();
}

// 定时同步 (每分钟)
setInterval(incrementalSync, 60000);
```

## 4. 验证检查清单

- [ ] 数据完整性
  - [ ] 用户数量一致
  - [ ] 服务器数量一致
  - [ ] 关联关系正确

- [ ] 数据质量
  - [ ] Email 格式正确
  - [ ] Password hash 有效
  - [ ] 时间戳格式正确

- [ ] 性能验证
  - [ ] 索引生效
  - [ ] 查询时间 < 100ms
  - [ ] 连接池正常

- [ ] 兼容性测试
  - [ ] 认证流程正常
  - [ ] CRUD 操作正常
  - [ ] 搜索功能正常

## 5. 回滚方案

如果迁移出现问题：

1. **立即回滚**：切换回 SQLite
2. **分析问题**：检查迁移日志
3. **修复数据**：手动修正
4. **重新迁移**：从备份恢复

```bash
# 回滚命令
# 1. 停止应用
docker-compose stop

# 2. 切换环境变量
export DATABASE_URL=file:./prisma/dev.db

# 3. 重启应用
docker-compose start
```

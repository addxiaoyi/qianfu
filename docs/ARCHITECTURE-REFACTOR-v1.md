# 千服后端架构重构方案

> 设计日期：2026-04-18
> 版本：v1.0
> 状态：架构设计阶段

---

## 目录

1. [现状分析](#1-现状分析)
2. [架构愿景](#2-架构愿景)
3. [目标架构设计](#3-目标架构设计)
4. [分阶段实施计划](#4-分阶段实施计划)
5. [关键技术选型](#5-关键技术选型)
6. [风险与应对](#6-风险与应对)

---

## 1. 现状分析

### 1.1 当前架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Application                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │   Routes    │  │ Middleware  │  │  Controllers    │    │
│  │  (28 files) │  │  (13 files) │  │  (21 files)     │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │  Services   │  │ Repository  │  │     Cache       │    │
│  │  (24 files) │  │   (Base)    │  │ Redis+Memory    │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
│                           │                                   │
│                    ┌──────┴──────┐                          │
│                    │   SQLite    │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 优势评估

| 方面 | 现状 | 评分 |
|------|------|------|
| Repository 模式 | 已实现 BaseRepository | ✅ 良好 |
| 验证体系 | Zod Schema | ✅ 良好 |
| 日志系统 | Winston 结构化日志 | ✅ 良好 |
| API 层 | React Query Hooks | ✅ 良好 |
| API 文档 | Swagger 集成 | ✅ 良好 |
| 监控 | Prometheus Metrics | ✅ 良好 |
| 健康检查 | 增强版健康检查 | ✅ 良好 |
| 认证 | SuperTokens 集成 | ✅ 良好 |
| 插件系统 | PluginLoader | ✅ 良好 |
| 缓存 | Redis + Memory 双层 | ✅ 良好 |
| 消息队列 | 基础通知队列 | ⚠️ 需强化 |

### 1.3 瓶颈与风险

| 问题类别 | 具体问题 | 影响程度 |
|----------|----------|----------|
| **数据库** | SQLite 单文件存储，无法水平扩展 | 🔴 高 |
| **架构** | 单体应用，所有服务耦合 | 🔴 高 |
| **中间件** | 30+ 中间件顺序执行，无分层 | 🟡 中 |
| **任务处理** | 探针检测同步执行，影响响应 | 🟡 中 |
| **部署** | 单点部署，无容灾 | 🔴 高 |
| **扩展性** | 无服务边界，难以独立扩展 | 🔴 高 |

---

## 2. 架构愿景

### 2.1 核心目标

1. **可扩展性**：支持 10x 流量增长
2. **高可用性**：99.9% SLA
3. **可维护性**：清晰的代码边界
4. **安全性**：纵深防御
5. **观测性**：全链路追踪

### 2.2 设计原则

```
┌────────────────────────────────────────────────────────────┐
│                     架构设计原则                            │
├────────────────────────────────────────────────────────────┤
│  • 渐进式演进 ─── 不重写，逐步拆分                         │
│  • 服务边界 ─── 按业务域划分服务                           │
│  • 异步优先 ─── 非核心路径异步化                           │
│  • 缓存为王 ─── 多级缓存减少 DB 压力                       │
│  • 事件驱动 ─── 解耦核心逻辑                              │
│  • 基础设施即代码 ─── 可重现、可追溯                        │
└────────────────────────────────────────────────────────────┘
```

---

## 3. 目标架构设计

### 3.1 整体架构图

```
                              ┌─────────────────┐
                              │   CDN / WAF     │
                              │  (Cloudflare)   │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
           ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
           │   API GW    │    │  Static     │    │   WebSocket │
           │  (Kong/Nginx)│    │  Files      │    │   Gateway   │
           └──────┬──────┘    └─────────────┘    └──────┬──────┘
                  │                                        │
                  │    ┌───────────────────────────────────┤
                  │    │                                   │
                  ▼    ▼                                   ▼
        ┌─────────────────────────────────────────────────────────┐
        │                    Service Mesh (可选)                  │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
        │  │ User Svc │  │ Server Svc│  │Payment Svc│ │ AI Svc │ │
        │  └─────┬────┘  └─────┬────┘  └─────┬────┘  └───┬────┘ │
        │        │             │             │            │      │
        └────────┼─────────────┼─────────────┼────────────┼──────┘
                 │             │             │            │
                 ▼             ▼             ▼            ▼
        ┌─────────────────────────────────────────────────────────┐
        │                      Message Bus                        │
        │                   (RabbitMQ / Redis Streams)            │
        └─────────────────────────────────────────────────────────┘
                 │             │             │            │
                 ▼             ▼             ▼            ▼
        ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐
        │   Cache    │ │  Search    │ │  Queue    │ │  Batch   │
        │  (Redis)   │ │ (Meilisearch)│ │ Workers │ │  Jobs    │
        └────────────┘ └────────────┘ └───────────┘ └──────────┘
                 │                                              │
                 └──────────────────────┬───────────────────────┘
                                        ▼
                              ┌─────────────────┐
                              │   PostgreSQL    │
                              │ (主库 + 读副本) │
                              └─────────────────┘
```

### 3.2 服务拆分设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        千服微服务架构                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Gateway                             │   │
│  │  • 路由分发    • 认证鉴权    • 限流熔断    • 请求转换     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│    ┌─────────────┬───────────┼───────────┬─────────────┐      │
│    │             │           │           │             │        │
│    ▼             ▼           ▼           ▼             ▼        │
│ ┌──────┐   ┌──────────┐  ┌────────┐  ┌────────┐   ┌───────┐    │
│ │ User │   │  Server  │  │ Payment│  │  CMS   │   │  AI   │    │
│ │ Svc  │   │   Svc    │  │  Svc   │  │  Svc   │   │  Svc  │    │
│ └──────┘   └──────────┘  └────────┘  └────────┘   └───────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Shared Services                       │   │
│  │  • Notification Service (通知服务)                        │   │
│  │  • Probe Service (探针服务)                               │   │
│  │  • Search Service (搜索服务)                              │   │
│  │  • Analytics Service (分析服务)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 服务职责划分

| 服务 | 职责 | 核心 API |
|------|------|----------|
| **User Service** | 用户认证、个人信息、权限 | `/api/auth/*`, `/api/user/*` |
| **Server Service** | 服务器 CRUD、状态管理 | `/api/servers/*`, `/api/review/*` |
| **Payment Service** | 支付、钱包、订阅 | `/api/payment/*`, `/api/wallet/*` |
| **CMS Service** | 页面、内容管理 | `/api/cms/*` |
| **AI Service** | AI 功能、探针 | `/api/ai/*` |
| **Notification Service** | 邮件、推送、站内信 | 内部服务 |

### 3.4 数据库架构

```sql
-- 迁移路径：SQLite → PostgreSQL

-- Phase 1: PostgreSQL 单节点
CREATE DATABASE qianfu;

-- Phase 2: 读写分离
CREATE DATABASE qianfu_replica; -- 只读副本

-- 核心表结构优化建议

-- 用户表分片策略（按 ID Hash）
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    -- ... 其他字段
    shard_key INT GENERATED ALWAYS AS (hashtext(id::text) % 4) STORED
);

-- 读写分离视图
CREATE VIEW v_users AS
SELECT * FROM users WHERE is_deleted = false;

-- 审计日志独立表（高写入）
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    -- ... 字段
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 按月分区
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

### 3.5 消息队列设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Flow Design                        │
└─────────────────────────────────────────────────────────────┘

事件源                    Event Bus                    消费者
  │                          │                            │
  ▼                          ▼                            ▼
┌────────┐              ┌──────────┐                ┌──────────┐
│ User   │──login──►    │ auth.*   │──►             │ Audit    │
│ Service│              └──────────┘                │ Service  │
└────────┘              ┌──────────┐                └──────────┘
                        │ server.* │
┌────────┐              └──────────┘                ┌──────────┐
│ Server │──created──►  ┌──────────┐                │ Notifi-  │
│ Service│              │ payment.*│──►             │ cation   │
└────────┘              └──────────┘                │ Service  │
                        ┌──────────┐                └──────────┘
                        │ probe.*  │──►             ┌──────────┐
                        └──────────┘                │ Search   │
                                                   │ Service  │
                                                   └──────────┘
```

---

## 4. 分阶段实施计划

### Phase 0: 基础准备（1-2 周）

**目标**：建立基础设施，为拆分做准备

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 0 检查清单                                            │
├─────────────────────────────────────────────────────────────┤
│  ☐ 数据库迁移路径定义                                        │
│  ☐ Docker Compose 多服务模板                                 │
│  ☐ 统一日志格式标准化                                       │
│  ☐ 服务发现机制配置                                          │
│  ☐ 链路追踪基础设施                                          │
└─────────────────────────────────────────────────────────────┘
```

**关键任务**：

1. **数据库迁移路径**
   - 定义 SQLite → PostgreSQL 迁移策略
   - 编写数据迁移脚本
   - 建立回滚机制

2. **容器化基础设施**
   ```yaml
   # docker-compose.refactor.yml
   services:
     api-gateway:
       image: nginx:alpine
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
   
     user-service:
       build: ./services/user
       environment:
         - DATABASE_URL=postgresql://...
         - REDIS_URL=redis://redis:6379
   
     server-service:
       build: ./services/server
       environment:
         - DATABASE_URL=postgresql://...
   
     message-queue:
       image: rabbitmq:3-management
   ```

### Phase 1: 服务拆分（4-6 周）

**目标**：识别核心服务并独立部署

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1 服务拆分优先级                                       │
├─────────────────────────────────────────────────────────────┤
│  1️⃣ [P0] User Service ──── 最独立，优先拆分                  │
│  2️⃣ [P0] Server Service ─── 核心业务，先拆分                 │
│  3️⃣ [P1] Payment Service ─── 涉及资金，高隔离                │
│  4️⃣ [P2] CMS Service ──── 低频，可延后                      │
│  5️⃣ [P2] AI Service ──── 资源密集，独立                      │
└─────────────────────────────────────────────────────────────┘
```

**实施步骤**：

#### Step 1: User Service 拆分

```typescript
// services/user-service/src/index.ts
import express from 'express';
import { UserController } from './controllers/userController';
import { UserRepository } from './repositories/userRepository';
import { AuthService } from './services/authService';
import { createApp } from './app';

const app = createApp({
  prefix: '/api',
  controllers: [UserController],
  services: {
    userRepository: new UserRepository(),
    authService: new AuthService(),
  },
  middleware: [
    'errorHandler',
    'requestId',
    'metrics',
  ],
});

app.listen(3001, () => {
  console.log('User Service running on :3001');
});
```

#### Step 2: 共享包提取

```typescript
// packages/shared/
export * from './errors';
export * from './validation';
export * from './logger';
export * from './types';

// packages/contracts/
export const USER_SERVICE_EVENTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
} as const;

export interface UserCreatedEvent {
  type: typeof USER_SERVICE_EVENTS.USER_CREATED;
  payload: {
    userId: string;
    email: string;
    timestamp: string;
  };
}
```

### Phase 2: 消息队列强化（2-3 周）

**目标**：建立可靠的事件驱动架构

```typescript
// 事件定义示例
interface ServerCreatedEvent {
  type: 'server.created';
  payload: {
    serverId: number;
    ownerId: number;
    name: string;
    ip?: string;
  };
  metadata: {
    correlationId: string;
    timestamp: string;
  };
}

// 事件处理
class ServerEventHandler {
  @OnEvent('server.created')
  async handleServerCreated(event: ServerCreatedEvent) {
    // 1. 更新搜索索引
    await searchService.indexServer(event.payload);
    
    // 2. 发送欢迎通知
    await notificationService.sendWelcome(event.payload.ownerId);
    
    // 3. 记录审计日志
    await auditService.log({
      action: 'SERVER_CREATED',
      target: event.payload.serverId,
      userId: event.payload.ownerId,
    });
  }
}
```

### Phase 3: 高可用强化（2-4 周）

**目标**：实现多实例部署和自动恢复

```
┌─────────────────────────────────────────────────────────────┐
│                    High Availability Design                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌─────────────────┐                      │
│                    │   Load Balancer  │                      │
│                    │  (Nginx/HAProxy)│                      │
│                    └────────┬────────┘                      │
│                             │                               │
│         ┌───────────────────┼───────────────────┐         │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│   ┌──────────┐        ┌──────────┐        ┌──────────┐      │
│   │Instance 1│        │Instance 2│        │Instance 3│      │
│   │ Primary  │◄─────►│ Standby  │◄─────►│ Standby  │      │
│   └──────────┘        └──────────┘        └──────────┘      │
│         │                                       │          │
│         └───────────────────┬───────────────────┘          │
│                             │                               │
│                             ▼                               │
│                    ┌─────────────────┐                      │
│                    │  Shared State   │                      │
│                    │ (Redis/Postgres)│                      │
│                    └─────────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 关键技术选型

### 5.1 服务间通信

| 场景 | 推荐方案 | 备选 |
|------|----------|------|
| 同步请求 | gRPC | REST + API GW |
| 异步事件 | RabbitMQ | Redis Streams |
| 实时通信 | Socket.io | GraphQL Subscriptions |
| 服务发现 | Consul | etcd |

### 5.2 数据存储策略

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Storage Strategy                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  热数据 ──────► Redis Cluster (缓存、会话)                   │
│                    │                                        │
│                    ▼                                        │
│  主数据 ──────► PostgreSQL (事务性)                          │
│                    │                                        │
│                    ├── 主库 (写)                             │
│                    └── 读副本 (读)                           │
│                                                              │
│  搜索 ───────► Meilisearch (全文检索)                       │
│                                                              │
│  日志 ───────► Elasticsearch + Loki                        │
│                                                              │
│  审计 ───────► PostgreSQL 分区表                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 缓存层级设计

```typescript
// 多级缓存实现
class CacheStrategy {
  // L1: 进程内缓存 (Node.js Map)
  // L2: Redis 分布式缓存
  // L3: 数据库

  async getUser(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;
    
    // L1: 进程内
    const l1 = this.l1Cache.get(cacheKey);
    if (l1) return l1;
    
    // L2: Redis
    const l2 = await this.redis.get<User>(cacheKey);
    if (l2) {
      this.l1Cache.set(cacheKey, l2, 30); // 30秒 L1
      return l2;
    }
    
    // L3: DB
    const user = await this.userRepo.findById(id);
    if (user) {
      await this.redis.set(cacheKey, user, 300); // 5分钟 L2
      this.l1Cache.set(cacheKey, user, 30);
    }
    
    return user;
  }
}
```

---

## 6. 风险与应对

### 6.1 主要风险矩阵

| 风险 | 影响 | 概率 | 应对策略 |
|------|------|------|----------|
| 拆分后数据一致性 | 🔴 高 | 🟡 中 | 事件溯源 + Saga 模式 |
| 服务间通信延迟 | 🟡 中 | 🟡 中 | 本地调用优化 + 批处理 |
| 迁移数据丢失 | 🔴 高 | 🟢 低 | 全量备份 + 灰度迁移 |
| 性能回退 | 🟡 中 | 🟡 中 | 性能基准测试 + 灰度发布 |
| 团队学习曲线 | 🟡 中 | 🟡 中 | 渐进式培训 + 文档 |

### 6.2 灰度发布策略

```
┌─────────────────────────────────────────────────────────────┐
│                    Canary Deployment                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  V1 (90%) ──────────────────────────► ┌─────────────┐        │
│                                       │   Clients   │        │
│  V2 (10%) ──────────────────────────► │            │        │
│                                       └─────────────┘        │
│                                              │               │
│                                              ▼               │
│                                    ┌─────────────────┐       │
│                                    │  监控指标收集   │       │
│                                    │  • 错误率       │       │
│                                    │  • 延迟         │       │
│                                    │  • 业务指标     │       │
│                                    └────────┬────────┘       │
│                                             │               │
│                              指标正常 ──────┴───── 指标异常  │
│                                  │                    │    │
│                                  ▼                    ▼    │
│                            全量发布              快速回滚    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 附录

### A. 迁移检查清单

- [ ] 数据库连接池配置
- [ ] 事务边界定义
- [ ] 分布式锁实现
- [ ] 缓存失效策略
- [ ] 日志聚合配置
- [ ] 监控告警设置
- [ ] 回滚脚本准备
- [ ] 文档更新

### B. 推荐阅读

1. [微服务设计模式](https:// microservices.io)
2. [PostgreSQL 分区表最佳实践](https://www.postgresql.org/docs/current/ddl-partitioning.html)
3. [RabbitMQ 官方文档](https://www.rabbitmq.com/getstarted.html)

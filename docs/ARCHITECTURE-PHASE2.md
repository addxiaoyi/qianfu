# Phase 2: 服务拆分实施

> 目标：按业务域拆分独立服务
> 预计工期：4-6 周

---

## 服务拆分优先级

| 优先级 | 服务 | 理由 | 预计工期 |
|--------|------|------|----------|
| P0 | User Service | 最独立，无复杂依赖 | 1 周 |
| P0 | Server Service | 核心业务，依赖 User | 2 周 |
| P1 | Payment Service | 涉及资金，需隔离 | 1 周 |
| P2 | CMS Service | 低频，可延后 | 3 天 |
| P2 | AI Service | 资源密集，独立部署 | 3 天 |

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Service Architecture                      │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Express/Nginx)│
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   User Svc    │   │  Server Svc   │   │  Payment Svc  │
│   :3001       │   │   :3002       │   │   :3003       │
└───────────────┘   └───────────────┘   └───────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Message Bus    │
                    │  (RabbitMQ)    │
                    └────────────────┘
```

## 服务模板

### User Service 模板

```
services/user-service/
├── src/
│   ├── index.ts              # 入口
│   ├── app.ts                # Express 配置
│   ├── config/
│   │   └── index.ts          # 环境配置
│   ├── controllers/
│   │   ├── authController.ts
│   │   └── userController.ts
│   ├── services/
│   │   ├── authService.ts
│   │   └── userService.ts
│   ├── repositories/
│   │   └── userRepository.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   ├── routes/
│   │   └── index.ts
│   ├── events/               # 事件发布
│   │   └── index.ts
│   └── utils/
│       └── logger.ts
├── tests/
│   └── *.test.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### 核心代码

#### 入口文件

```typescript
// services/user-service/src/index.ts
import { app } from './app';
import { logger } from './utils/logger';
import { connectToDatabase } from './config/database';
import { ServiceRegistry } from './utils/serviceRegistry';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    // 1. 连接数据库
    await connectToDatabase();
    logger.info('[UserService] Database connected');
    
    // 2. 注册服务发现
    ServiceRegistry.register('user-service', {
      host: process.env.HOST || 'localhost',
      port: Number(PORT),
      healthCheck: '/health',
    });
    
    // 3. 启动 HTTP 服务
    app.listen(PORT, () => {
      logger.info(`[UserService] Running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('[UserService] Startup failed', error);
    process.exit(1);
  }
}

bootstrap();
```

#### 事件发布

```typescript
// services/user-service/src/events/publisher.ts
import { EventEmitter } from 'events';
import { rabbitMQ } from './rabbitmq';

export const userEvents = new EventEmitter();

export async function publishUserEvent(
  event: 'created' | 'updated' | 'deleted',
  user: { id: string; email: string }
) {
  const payload = {
    type: `user.${event}`,
    payload: user,
    timestamp: new Date().toISOString(),
  };
  
  // 发布到消息队列
  await rabbitMQ.publish('user.events', payload);
  
  // 本地事件（用于同服务内通信）
  userEvents.emit(event, user);
}

// 使用示例
export async function createUser(data: CreateUserDTO) {
  const user = await userRepository.create(data);
  
  // 发布创建事件
  await publishUserEvent('created', { id: user.id, email: user.email });
  
  return user;
}
```

#### 健康检查

```typescript
// services/user-service/src/routes/health.ts
import { Router } from 'express';
import { prisma } from '../config/database';
import { redisService } from '../services/cache';
import { rabbitMQ } from '../services/rabbitmq';

const router = Router();

router.get('/health', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'user-service',
    version: process.env.VERSION || '1.0.0',
    checks: {
      database: await checkDatabase(),
      cache: await checkCache(),
      queue: await checkQueue(),
    },
  };
  
  const allHealthy = Object.values(checks.checks).every(c => c.status === 'ok');
  
  res.status(allHealthy ? 200 : 503).json(checks);
});

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Database connection failed' };
  }
}

async function checkCache() {
  try {
    const pong = await redisService.ping();
    return { status: pong === 'connected' ? 'ok' : 'error' };
  } catch {
    return { status: 'error', message: 'Redis connection failed' };
  }
}

async function checkQueue() {
  try {
    await rabbitMQ.checkConnection();
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'RabbitMQ connection failed' };
  }
}

export default router;
```

### 服务间通信

```typescript
// packages/contracts/src/events/userEvents.ts

export const USER_EVENTS = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
  EMAIL_VERIFIED: 'user.email_verified',
} as const;

export interface UserCreatedEvent {
  type: typeof USER_EVENTS.CREATED;
  payload: {
    id: string;
    email: string;
    username?: string;
    role: string;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
  };
}

// 服务消费者示例
// services/server-service/src/events/consumers.ts
import { consumeEvent } from '../../shared/rabbitmq';
import { USER_EVENTS } from '@qianfu/contracts';

export function setupUserEventConsumers() {
  // 监听用户创建事件
  consumeEvent('user.events', USER_EVENTS.CREATED, async (event: UserCreatedEvent) => {
    // 创建服务器时自动关联用户
    await userService.syncUserInfo(event.payload);
  });
  
  // 监听用户删除事件
  consumeEvent('user.events', USER_EVENTS.DELETED, async (event) => {
    // 清理用户相关数据
    await serverService.cleanupByUserId(event.payload.id);
  });
}
```

### PM2 部署配置

```javascript
// ecosystem.microservices.config.js
module.exports = {
  apps: [
    {
      name: 'user-service',
      script: 'services/user-service/dist/index.js',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3070,
        DATABASE_URL: 'file:./dev.db',
        EVENT_BUS_URL: 'http://localhost:3060',
      },
    },
    {
      name: 'event-bus',
      script: 'services/event-bus/dist/index.js',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3060,
        RABBITMQ_URL: 'amqp://localhost:5672',
      },
    },
  ],
};
```

快速启动:

```bash
# 安装 PM2
npm install -g pm2

# 构建所有服务
npm run build

# 启动微服务集群
npx pm2 start ecosystem.microservices.config.js
```

详细文档: [ARCHITECTURE-DEPLOY.md](./ARCHITECTURE-DEPLOY.md)

## 拆分流程

### 1. 提取 User Service

1. 创建 `services/user-service`
2. 复制相关代码：
   - `controllers/authController.ts` → `controllers/authController.ts`
   - `controllers/userController.ts` → `controllers/userController.ts`
   - `services/authService.ts` → `services/authService.ts`
   - `repositories/userRepository.ts` → `repositories/userRepository.ts`
3. 修改数据库连接指向新表
4. 添加事件发布代码
5. 部署并测试

### 2. 提取 Server Service

1. 创建 `services/server-service`
2. 复制服务器相关代码
3. 添加事件消费代码
4. 部署并测试

### 3. 切换 API Gateway

```typescript
// api-gateway/src/routes/index.ts
import proxy from 'express-http-proxy';

export const routes = [
  {
    path: '/api/auth/*',
    target: 'http://user-service:3001',
  },
  {
    path: '/api/user/*',
    target: 'http://user-service:3001',
  },
  {
    path: '/api/servers/*',
    target: 'http://server-service:3002',
  },
  {
    path: '/api/payment/*',
    target: 'http://payment-service:3003',
  },
];

routes.forEach(({ path, target }) => {
  app.use(path, proxy(target));
});
```

## 测试策略

### 单元测试

```typescript
// services/user-service/tests/authService.test.ts
describe('AuthService', () => {
  it('should validate user credentials', async () => {
    const result = await authService.validateCredentials({
      email: 'test@example.com',
      password: 'password123',
    });
    
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
  });
});
```

### 集成测试

```typescript
// services/user-service/tests/integration.test.ts
describe('User API Integration', () => {
  it('should create user and publish event', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'new@example.com', password: 'password' });
    
    expect(response.status).toBe(201);
    
    // 验证事件已发布
    const event = await waitForEvent('user.created');
    expect(event.payload.email).toBe('new@example.com');
  });
});
```

## 回滚计划

1. **快速回滚**：将 API Gateway 切回单体应用
2. **数据库回滚**：保留原始 SQLite 备份
3. **服务降级**：如果某个服务故障，API GW 返回降级响应

---

## 下一步

- [Phase 1](./ARCHITECTURE-PHASE1.md) - 基础设施准备
- [Phase 3](./ARCHITECTURE-PHASE3.md) - 高可用强化

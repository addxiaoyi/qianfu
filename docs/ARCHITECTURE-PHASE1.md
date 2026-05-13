# Phase 1: 基础设施与模块化重构

> 目标：强化现有架构，为服务拆分做准备
> 预计工期：2-3 周

---

## 目标

1. 提取共享包，建立模块化架构
2. 规范化中间件分层
3. 建立服务注册机制
4. 准备数据库迁移路径

## 任务清单

### T1: 共享包提取

```
src/
├── packages/
│   ├── shared/           # 共享工具
│   │   ├── errors/       # 统一错误类
│   │   ├── logger/       # Winston 配置
│   │   ├── types/        # 通用类型定义
│   │   └── utils/        # 通用工具函数
│   │
│   ├── contracts/        # 服务间协议
│   │   ├── events/       # 事件定义
│   │   └── api/          # API 类型
│   │
│   └── config/           # 配置管理
│       └── index.ts
│
└── services/             # 服务模块
    ├── user/
    ├── server/
    ├── payment/
    └── ...
```

### T2: 中间件分层重构

**当前问题**：
```typescript
// app.ts - 30+ 中间件线性排列
app.use(middleware1);
app.use(middleware2);
// ... 20+ more
app.use(middleware30);
```

**目标**：
```typescript
// 分层架构
const layers = {
  // 基础设施层
  infrastructure: [requestId, metrics, logging],
  
  // 安全层
  security: [cors, helmet, waf, rateLimit, csrf],
  
  // 业务前置层
  business: [auth, validation],
  
  // 业务处理层
  handlers: [controllers],
  
  // 错误处理层
  error: [errorHandler, notFound]
};
```

### T3: 服务注册机制

```typescript
// server/core/service-container.ts
class ServiceContainer {
  private services = new Map<string, Service>();
  
  register(name: string, service: Service): void {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} already registered`);
    }
    this.services.set(name, service);
  }
  
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service as T;
  }
  
  async boot(): Promise<void> {
    // 按依赖顺序初始化
    for (const [name, service] of this.services) {
      await service.boot?.();
      logger.info(`Service ${name} booted`);
    }
  }
  
  async shutdown(): Promise<void> {
    // 逆序关闭
    for (const [name, service] of [...this.services].reverse()) {
      await service.shutdown?.();
      logger.info(`Service ${name} shutdown`);
    }
  }
}
```

## 实施步骤

### Step 1: 创建 monorepo 结构

```bash
mkdir -p packages/shared/src/{errors,logger,types,utils}
mkdir -p packages/contracts/src/{events,api}
mkdir -p packages/config/src
mkdir -p services/{user,server,payment,cms,ai}
```

### Step 2: 配置 workspace

```json
// package.json
{
  "workspaces": [
    "packages/*",
    "services/*"
  ]
}
```

### Step 3: 迁移共享代码

从 `server/core/` 提取到 `packages/shared/`:
- `errors/` → `packages/shared/src/errors/`
- `utils/logger.ts` → `packages/shared/src/logger/`
- `validation/` → `packages/shared/src/validation/`

### Step 4: 中间件分层实现

```typescript
// server/bootstrap/middlewareLayers.ts

export interface MiddlewareLayer {
  name: string;
  middlewares: express.RequestHandler[];
}

export const middlewareLayers: MiddlewareLayer[] = [
  // Layer 1: 基础设施
  {
    name: 'infrastructure',
    middlewares: [
      requestIdMiddleware,
      metricsMiddleware,
      // ...
    ],
  },
  
  // Layer 2: 安全
  {
    name: 'security',
    middlewares: [
      registerSecurityHeaders,
      registerCors,
      createWAFMiddleware(wafConfig),
      // ...
    ],
  },
  
  // Layer 3: 业务前置
  {
    name: 'business',
    middlewares: [
      superTokensMiddleware(),
      // ...
    ],
  },
];

export function applyMiddlewareLayers(app: express.Application): void {
  for (const layer of middlewareLayers) {
    logger.info(`Applying middleware layer: ${layer.name}`);
    for (const middleware of layer.middlewares) {
      app.use(middleware);
    }
  }
}
```

## 验证标准

- [ ] 所有现有测试通过
- [ ] API 响应时间无明显变化
- [ ] 中间件执行顺序正确
- [ ] 共享包可独立发布
- [ ] 服务注册机制正常工作

## 注意事项

1. **向后兼容**：确保重构不破坏现有 API
2. **增量修改**：每次小步修改，充分测试
3. **日志记录**：记录所有中间件初始化
4. **错误处理**：分层错误处理，互不影响

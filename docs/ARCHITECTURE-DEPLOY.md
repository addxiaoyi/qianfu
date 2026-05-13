# 千服部署指南 (无容器版)

## 概述

本指南描述如何使用 **PM2** 进行生产级 Node.js 部署，无需 Docker 容器。

## 目录结构

```
qianfu/
├── ecosystem.microservices.config.js  # PM2 配置文件
├── scripts/
│   ├── start-services.js              # Node.js 服务管理器
│   ├── pm2-commands.sh                # Unix PM2 快捷命令
│   └── pm2-commands.bat               # Windows PM2 快捷命令
├── services/                          # 微服务目录
│   ├── user-service/
│   └── event-bus/
└── logs/                             # PM2 日志目录
```

## 快速开始

### 1. 安装依赖

```bash
# 安装 PM2 (全局)
npm install -g pm2

# 安装项目依赖
npm install

# 构建所有服务
npm run build
```

### 2. 启动服务

**单体模式（推荐开发/小规模部署）**
```bash
# 使用 PM2
npx pm2 start ecosystem.microservices.config.js --only qianfu-monolith

# 或使用脚本
node scripts/start-services.js monolith
```

**微服务模式（生产推荐）**
```bash
# 使用 PM2
npx pm2 start ecosystem.microservices.config.js

# 或使用脚本
node scripts/start-services.js microservices
```

### 3. 常用命令

```bash
# 查看状态
npx pm2 list

# 查看日志
npx pm2 logs

# 重启服务
npx pm2 restart all

# 停止所有服务
npx pm2 delete all

# 启动监控面板
npx pm2 monit
```

## PM2 配置文件

### ecosystem.microservices.config.js

```javascript
{
  apps: [
    {
      name: 'qianfu-monolith',      // 服务名称
      script: 'dist-server/index.js', // 入口脚本
      instances: 1,                  // 实例数量 (cluster 模式)
      exec_mode: 'cluster',          // 模式: cluster | fork
      port: 3050,                    // 端口
      max_memory_restart: '1G',      // 内存超限自动重启
      error_file: 'logs/pm2-xxx-error.log',
      out_file: 'logs/pm2-xxx-out.log',
    }
  ]
}
```

## 环境变量配置

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `NODE_ENV` | development | 运行环境 |
| `PORT` | 3050 | 服务端口 |
| `SERVICE_NAME` | - | 服务标识 |
| `EVENT_BUS_URL` | http://localhost:3060 | 事件总线地址 |
| `DATABASE_URL` | file:./dev.db | 数据库连接 |
| `USER_SERVICE_HOST` | localhost | User Service 地址 |
| `USER_SERVICE_PORT` | 3070 | User Service 端口 |

## 服务间通信

### HTTP 调用

```typescript
import { getServiceUrl } from './core/service-discovery.js';

const userServiceUrl = getServiceUrl('user-service');
const response = await fetch(`${userServiceUrl}/api/users/123`);
```

### 事件驱动

通过 Event Bus 服务异步通信：

```typescript
// 发布事件
import { publishEvent } from './services/eventBus.js';

await publishEvent('user.created', {
  userId: '123',
  email: 'test@example.com',
});

// 订阅事件
import { subscribeEvent } from './services/eventBus.js';

await subscribeEvent('user.created', async (payload) => {
  console.log('New user:', payload);
});
```

## 日志管理

PM2 自动管理日志，文件位于 `logs/` 目录：

```bash
# 查看所有日志
npx pm2 logs

# 查看特定服务日志
nix pm2 logs qianfu-monolith

# 清空日志
npx pm2 flush
```

生产环境建议使用 **PM2 Plus** 或集成 **ELK Stack** 进行集中式日志管理。

## 进程监控

### 自动重启

PM2 自动在以下情况重启进程：
- 进程崩溃 (exit code != 0)
- 内存超过限制 (默认 1G)
- 系统内存不足时

### 启动脚本

创建开机自启脚本：

```bash
# 生成启动脚本
npx pm2 startup

# 保存当前进程列表
npx pm2 save

# 以后每次重启会自动恢复
```

## 负载均衡

### 单体应用 (Cluster 模式)

```javascript
// ecosystem.config.js
{
  apps: [{
    name: 'app',
    script: 'index.js',
    instances: 4,           // 4 个实例
    exec_mode: 'cluster',   // 集群模式自动负载均衡
  }]
}
```

### 多机器部署

```
                    ┌─────────────┐
    Client ────────▶│   Nginx     │
                    │  (LB)       │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐
   │  Server 1 │    │  Server 2 │    │  Server 3 │
   │ (PM2)     │    │ (PM2)     │    │ (PM2)     │
   └───────────┘    └───────────┘    └───────────┘
```

Nginx 配置：

```nginx
upstream qianfu_backend {
    least_conn;                          # 最少连接负载均衡
    server 192.168.1.101:3050 weight=1;  # Server 1
    server 192.168.1.102:3050 weight=1;  # Server 2
    server 192.168.1.103:3050 weight=1;  # Server 3
}

server {
    listen 80;
    server_name api.qianfu.com;

    location / {
        proxy_pass http://qianfu_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 生产检查清单

- [ ] 安装 PM2: `npm install -g pm2`
- [ ] 设置环境变量 (`NODE_ENV=production`)
- [ ] 配置防火墙 (只开放必要端口)
- [ ] 设置日志轮转 (logrotate)
- [ ] 配置进程守护 (systemd/upstart)
- [ ] 测试重启脚本
- [ ] 配置监控告警

## 故障排除

### 服务无法启动

```bash
# 查看详细错误
npx pm2 logs --err --lines 100

# 手动测试入口脚本
node dist-server/index.js
```

### 内存泄漏

```bash
# 启用内存监控
npx pm2 monit

# 查看内存使用趋势
npx pm2 list
```

### 端口被占用

```bash
# Windows: 查找占用端口的进程
netstat -ano | findstr :3050

# 终止进程
taskkill /PID <PID> /F
```

# 千服平台 (QianFu Platform)

一个非交易信息服务平台，提供 Minecraft 服务器发现、免费服务器发布、用户系统、新闻和内容审核。当前处于个人备案模式，不提供支付、充值、钱包、商城交易或现金推广。

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Node.js + Express + TypeScript
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **容器化**: Docker + Docker Compose
- **进程管理**: PM2
- **Web 服务器**: Nginx
- **认证**: SuperTokens + JWT
- **数据库 ORM**: Prisma

## 快速开始

### 环境要求

- Node.js >= 20
- Docker >= 24 (可选，用于容器化部署)
- npm >= 10

### 安装依赖

```bash
npm install
```

### 环境变量配置

复制环境变量模板并填写必要值：

```bash
cp .env.example .env
```

### 数据库设置

```bash
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 打开 Prisma Studio 查看数据
npx prisma studio
```

### 启动开发服务器

```bash
# 启动前端开发服务器
npm run dev

# 启动后端 API 服务器
npm run server:dev

# 或同时启动两者
npm run dev:all
```

## 项目结构

```
千服/
├── server/                 # 后端 API 服务
│   ├── app.ts              # Express 应用配置
│   ├── index.ts            # 服务入口
│   ├── config/             # 配置文件
│   ├── controllers/        # 控制器
│   ├── middleware/         # 中间件
│   ├── routes/             # 路由定义
│   ├── services/           # 业务逻辑
│   └── utils/              # 工具函数
├── packages/               # 前端包
│   └── web-app/            # Web 前端应用
├── prisma/                 # 数据库 schema 和迁移
├── scripts/                # 运维脚本
├── docs/                   # 文档
└── deploy/                 # 部署配置
```

## 核心功能

### 用户系统
- 用户注册/登录
- 角色权限管理
- 用户等级系统
- SuperTokens 集成

### 服务器发现与发布
- Minecraft 服务器公开列表
- 服务器详情、状态和在线人数展示
- 免费服务器发布与管理员审核
- 搜索、筛选、收藏和举报

### 内容审核
- 自动内容审核
- 管理员审核面板
- 举报系统
- 内容安全策略

### 系统功能
- 审计日志
- 请求限流
- CORS 配置
- 安全中间件
- API 版本控制

## API 文档

启动服务器后，访问 Swagger UI：
```
http://localhost:3001/api/docs
```

## 测试

```bash
# 运行测试
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行端到端测试
npm run test:e2e
```

## 部署

### Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start ecosystem.config.js

# 查看服务状态
pm2 status

# 查看日志
pm2 logs
```

## 开发指南

### 代码规范

```bash
# 代码检查
npm run lint

# 类型检查
npm run typecheck

# 验证所有配置
npm run validate
```

### 数据库迁移

```bash
# 创建新迁移
npx prisma migrate dev --name your_migration_name

# 提交迁移到生产环境
npx prisma migrate deploy
```

## 环境变量说明

| 变量名 | 说明 | 必填 |
|--------|------|------|
| PORT | 服务器端口 | 否 (默认 3001) |
| DATABASE_URL | 数据库连接字符串 | 是 |
| JWT_SECRET | JWT 密钥 | 是 |
| CORS_ORIGIN | CORS 允许的源 | 否 |
| SUPER_TOKENS_CONNECTION_URI | SuperTokens 连接 URI | 否 |
| SUPER_TOKENS_API_KEY | SuperTokens API 密钥 | 否 |

## 监控和日志

### 日志文件

- 应用日志：`logs/app.log`
- 错误日志：`logs/error.log`
- 审计日志：`logs/audit.log`

### 健康检查

```bash
curl http://localhost:3001/health
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 联系方式

- 项目维护者：[你的联系方式]
- 项目链接：[你的项目链接]

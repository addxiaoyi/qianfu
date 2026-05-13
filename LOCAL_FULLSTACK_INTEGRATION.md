# 千服 + xpay 本地闭环部署指南

本指南用于将当前项目与 `xpay-3.1_YTM7H` 在本机完全联动，移除对云数据库的依赖，形成统一本地后端闭环。

## Linux 纯净环境（推荐）

仅需安装 Docker + Docker Compose 插件，即可直接迁移运行。

```bash
cp .env.fullstack.example .env.fullstack
bash scripts/linux/bootstrap-fullstack.sh
```

或使用 npm 命令：

```bash
npm run fullstack:up
```

停止：

```bash
npm run fullstack:down
```

查看日志：

```bash
npm run fullstack:logs
```

## Linux 无网环境（离线包）

### A. 在有网机器打包离线运行包

```bash
chmod +x scripts/linux/package-offline-bundle.sh
bash scripts/linux/package-offline-bundle.sh offline-bundle
```

该命令会生成：

- 项目镜像 tar：`qianfu-app:offline`、`qianfu-xpay:offline`
- 基础镜像 tar：`mysql:8.0`、`redis:7-alpine`、`nginx:alpine`
- 离线运行所需 compose/env/sql 文件

### B. 传输到无网机器并启动

```bash
cd offline-bundle
cp .env.offline.example .env.offline
docker load -i images/qianfu-app-offline.tar
docker load -i images/qianfu-xpay-offline.tar
docker load -i images/mysql-8.0.tar
docker load -i images/redis-7-alpine.tar
docker load -i images/nginx-alpine.tar
docker compose --env-file .env.offline -f docker-compose.offline.yml up -d
```

或使用离线自举脚本：

```bash
chmod +x scripts/linux/bootstrap-offline.sh
bash scripts/linux/bootstrap-offline.sh
```

说明：离线模式下不执行在线 build/pull，所有镜像由本地 tar 导入，满足无公网环境运行。

## 离线包 UX 增强（推荐）

可直接生成单个安装包（便于交付）：

```bash
chmod +x scripts/linux/make-offline-installer.sh
bash scripts/linux/make-offline-installer.sh offline-bundle qianfu-offline-installer.tar.gz
```

无网机器安装：

```bash
tar -xzf qianfu-offline-installer.tar.gz -C qianfu-offline
cd qianfu-offline
bash install.sh
```

`install.sh` 提供：

- 交互式密钥填写（JWT/Admin/XPay）
- 端口占用预检查
- 镜像自动导入
- 自动启动与基础健康检查

## 验收报告与自动诊断

离线环境启动后可执行：

```bash
npm run offline:verify
```

会生成：

- `reports/offline-acceptance-*.json`
- `reports/offline-acceptance-*.html`

若出现故障可执行：

```bash
npm run offline:diag
```

会生成诊断包：

- `diagnostics/qianfu-diagnostics-*.tar.gz`

安装器 `install.sh` 已集成该逻辑：验收失败时自动收集诊断包，便于回传运维排障。

## 1) 目标架构

- 千服主后端：`server`（Express + Prisma + SQLite）
- 千服缓存：Redis（本地）
- 支付后端：`xpay-3.1_YTM7H/xpay-code`（Spring Boot + MySQL + Redis）
- 支付回调：xpay -> 千服 `POST /api/payment/xpay/notify` 或 `POST /api/qianfu/xpay/notify`

## 2) 千服本地化关键开关

在项目根目录 `.env` 中启用：

```env
LOCAL_AUTH_ONLY=true
DATABASE_URL="file:./dev.db"
QIANFU_ENABLED=true
QIANFU_API_URL=http://127.0.0.1:8888/qianfu-api
QIANFU_CALLBACK_URL=http://127.0.0.1:3000/api/qianfu/xpay/notify
XPAY_API_URL=http://127.0.0.1:8888/api/pay
XPAY_NOTIFY_URL=http://127.0.0.1:3000/api/payment/xpay/notify
```

说明：

- `LOCAL_AUTH_ONLY=true` 后，账号体系仅使用本地数据库与本地密码哈希，不再依赖 Supabase。
- 若前端不使用 OAuth，可移除 `VITE_SUPABASE_*`。

## 3) 启动顺序（推荐）

1. 启动 Redis（默认 `127.0.0.1:6379`）
2. 启动 MySQL（给 xpay 使用，创建数据库 `xpay` 并导入 `xpay-code/sql/init.sql`）
3. 启动 xpay（端口 `8888`）
4. 启动千服后端（端口 `3000`）
5. 启动千服前端（Vite）

### Windows 一键辅助

可直接执行：

```powershell
npm run local:start
```

然后再执行健康验收：

```powershell
npm run local:verify
```

## 4) xpay 本地配置

编辑 `xpay-3.1_YTM7H/xpay-code/src/main/resources/application.properties`：

- `spring.datasource.url` 指向本地 MySQL
- `spring.datasource.username/password` 设置为本地账号
- `spring.redis.host/port/password` 指向本地 Redis
- `qianfu.api-url` 改为本机地址（如 `http://127.0.0.1:8888/qianfu-api`）
- `qianfu.callback-url` 改为千服后端地址

## 5) 千服数据库初始化

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

开发模式可用：

```bash
npx prisma migrate dev
```

## 6) 回调链路验收

- 创建充值订单：`POST /api/payment/create`
- 拉起 xpay 支付页：返回 `paymentUrl`
- 支付完成后，xpay 回调千服：
  - `POST /api/payment/xpay/notify`（钱包充值主链路）
  - 或 `POST /api/qianfu/xpay/notify`（千服核心集成链路）
- 验证：
  - `Payment.status` 变为 `COMPLETED`
  - 对应 `Wallet.balance` 增加
  - 生成 `Transaction` 记录

自动化基础验收包含：

- `GET /api/health`
- `GET /api/csrf-token`
- `GET /api/qianfu/health`
- `GET xpay /starmc/pay`

## 7) 常见问题

- 401/403 登录失败：确认已开启 `LOCAL_AUTH_ONLY=true` 并重启后端
- 支付回调失败：检查 xpay 配置中的 callback URL、签名 token、端口映射
- Redis 连接失败：核对 `REDIS_URL` 与 xpay 的 `spring.redis.*`
- MySQL 连接失败：核对 xpay `spring.datasource.*` 与数据库权限

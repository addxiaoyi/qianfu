# Linux 全面启动脚本说明

本文档对应脚本：`scripts/linux/start-fullstack-auto.sh`

配套停止脚本：`scripts/linux/stop-fullstack-auto.sh`

目标：
- 自动安装依赖（缺失时）
- 自动补全环境文件（生成 `.env.local.auto`）
- 使用相对路径，便于目录迁移
- 自动选择未占用端口
- 自动启动前后端（并尽量启动 SuperTokens / xpay）

---

## 1. 先决条件

建议环境：
- Linux（bash）
- Node.js + npm
- 可选：Docker（用于自动拉起 SuperTokens core）
- 可选：Java/Maven Wrapper（用于本地启动 xpay）

---

## 2. 一键启动

在项目根目录执行：

```bash
bash scripts/linux/start-fullstack-auto.sh
```

预检模式（只演练，不真正启动）：

```bash
bash scripts/linux/start-fullstack-auto.sh --dry-run
```

脚本会自动执行：
1. 检查 `node_modules`，缺失时执行 `npm install`
2. 生成 `.env.local`（不存在时从 `.env.example` 或 `.env` 拷贝）
3. 自动探测可用端口（默认从 4123/3000/3567/8888 起递增）
4. 生成 `.env.local.auto`（写入本次端口和关键地址）
5. 执行 `prisma generate` 与 `prisma migrate deploy`
6. 尝试启动 SuperTokens（Docker compose）
7. 尝试启动 xpay（如果存在 `xpay-3.1_YTM7H/xpay-code/mvnw`）
8. 启动 API（`npm run server`）与 Web（`npm run dev`）

---

## 3. 启动产物

脚本运行后会生成：

- `.env.local.auto`：自动端口与地址配置
- `.run-api.log` / `.run-web.log`：前后端日志
- `.run-api.pid` / `.run-web.pid`：前后端 PID
- 可能还有 `.run-xpay.log` / `.run-xpay.pid`

---

## 4. 端口策略（自动避让）

默认基准端口：
- Web: `4123`
- API: `3000`
- SuperTokens: `3567`
- xpay: `8888`
- Preview: `4124`

若端口被占用，脚本会自动递增选择可用端口。

你也可以在启动前覆盖默认基准端口：

```bash
PORT_WEB=4200 PORT_API=3100 PORT_SUPERTOKENS=3667 PORT_XPAY=8988 bash scripts/linux/start-fullstack-auto.sh
```

---

## 5. 停止服务

执行：

```bash
bash scripts/linux/stop-fullstack-auto.sh
```

脚本会自动停止：
- `.run-web.pid`
- `.run-api.pid`
- `.run-xpay.pid`
- SuperTokens 的 Docker compose 容器（如果已启动）

---

## 6. 迁移与相对路径

脚本使用如下方式定位根目录：

- `ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"`

因此无论项目目录移动到哪里，只要保持脚本相对位置不变，都可直接运行。

---

## 7. 常见问题

### 7.1 前端起来了但认证刷新失败
请检查：
- SuperTokens core 是否成功启动
- `.env.local.auto` 的 `SUPERTOKENS_CONNECTION_URI`
- 后端日志里是否有 SuperTokens 初始化错误

### 7.2 `/api/v1/public/servers` 返回 500
优先看 `.run-api.log`，确认是：
- localPrisma / prisma 连接失败
- 数据库 schema 不一致
- 运行环境变量与预期不一致

### 7.3 xpay 未自动启动
脚本仅在存在 `xpay-3.1_YTM7H/xpay-code/mvnw` 时自动启动。
否则会跳过并给出告警。

---

## 8. 安全建议

请勿将真实密钥提交到仓库：
- `SUPABASE_SERVICE_ROLE_KEY`
- `BREVO_API_KEY`
- `QIANFU_SECRET_KEY`
- 等所有生产凭据

建议在部署环境中通过独立密钥管理方案注入。

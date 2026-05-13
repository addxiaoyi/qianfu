# Linux 生产部署说明

本文档面向 Linux 生产环境，建议作为正式部署主方案。

相关脚本：
- `scripts/linux/start-fullstack-auto.sh`
- `scripts/linux/stop-fullstack-auto.sh`

相关说明：
- `docs/LINUX_AUTO_START_GUIDE.md`
- `docs/WINDOWS_AUTO_START_GUIDE.md`（仅作补充）

---

## 1. 部署目标

- 自动安装或补全依赖
- 自动补全环境文件
- 自动选择未占用端口
- 自动启动前后端
- 尽量自动启动 SuperTokens / xpay
- 可迁移到其他 Linux 主机
- 支持预检模式，便于上线前检查

---

## 2. 推荐部署方式

### 方式 A：一键启动（适合单机或迁移验证）

```bash
bash scripts/linux/start-fullstack-auto.sh
```

特点：
- 自动检测 `node_modules`
- 自动生成 `.env.local`
- 自动生成 `.env.local.auto`
- 自动避让端口
- 自动拉起 API / Web
- 尽量启动 SuperTokens core 和 xpay

### 方式 B：预检模式

```bash
bash scripts/linux/start-fullstack-auto.sh --dry-run
```

特点：
- 不会真正安装、启动或写入运行文件
- 只输出执行计划
- 适合迁移前检查环境完整性

---

## 3. 端口策略

默认起始端口：
- Web：`4123`
- API：`3000`
- SuperTokens：`3567`
- xpay：`8888`
- Preview：`4124`

若端口被占用，脚本会自动递增寻找可用端口。

你也可以通过环境变量调整基准端口：

```bash
PORT_WEB=4200 PORT_API=3100 PORT_SUPERTOKENS=3667 PORT_XPAY=8988 bash scripts/linux/start-fullstack-auto.sh
```

---

## 4. 迁移建议

为了方便迁移到不同 Linux 机器，脚本全部使用相对路径定位根目录：

- `ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"`

因此只要保持仓库结构不变，移动目录后仍可直接执行。

---

## 5. 生产建议

### 5.1 生产环境变量

生产环境建议不要直接使用仓库内的 `.env`，而是：

- 复制一份到部署机本地
- 用独立密钥管理工具注入敏感配置
- 确保 `NODE_ENV=production`

### 5.2 服务守护

正式生产建议使用以下方式之一守护进程：

- `systemd`
- `pm2`
- `supervisor`

如果采用 `systemd`，建议为 API 与 Web 分别建服务单元，或使用单一入口脚本统一启动。

---

## 6. 常见问题

### 6.1 认证刷新失败

如果浏览器提示：

- `POST /auth/session/refresh`
- `ERR_CONNECTION_REFUSED`

优先检查：
- 后端是否真的已启动
- SuperTokens core 是否运行
- `SUPERTOKENS_CONNECTION_URI` 是否可达
- `API_PUBLIC_URL` 与前端配置是否一致

### 6.2 `/api/v1/public/servers` 返回 500

优先检查：
- API 服务日志 `.run-api.log`
- `localPrisma` / `prisma` 数据库是否可连接
- 运行时环境变量是否正确
- 数据库 schema 是否与构建产物一致

### 6.3 xpay 未启动

脚本会在以下条件满足时才尝试自动启动 xpay：
- 存在 `xpay-3.1_YTM7H/xpay-code`
- 存在 `mvnw`
- 机器具备 Java / Maven Wrapper 运行环境

---

## 7. 停止服务

```bash
bash scripts/linux/stop-fullstack-auto.sh
```

脚本会停止：
- API
- Web
- xpay
- SuperTokens Docker compose（如果存在并已启动）

---

## 8. 文档定位

- Linux 主文档：`docs/LINUX_PROD_DEPLOY.md`
- Linux 自动启动说明：`docs/LINUX_AUTO_START_GUIDE.md`
- Windows 自动启动说明：`docs/WINDOWS_AUTO_START_GUIDE.md`

建议生产环境团队以 Linux 文档为准，Windows 文档仅作补充参考。

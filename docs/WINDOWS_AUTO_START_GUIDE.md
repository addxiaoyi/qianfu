# Windows 全面启动脚本说明（辅助）

> 说明：本仓库的主生产环境是 Linux。本文档仅作为 Windows 开发机/演示环境的补充参考。

本文档对应脚本：`scripts/windows/start-fullstack-auto.ps1`

目标：
- 自动检查依赖
- 自动补全环境文件（生成 `.env.local.auto`）
- 自动选择未占用端口
- 自动启动前后端
- 尽量启动 SuperTokens / xpay
- 支持 `-DryRun` 预检模式

---

## 1. 先决条件

建议环境：
- Windows 10/11
- PowerShell 5.1+ 或 PowerShell 7+
- Node.js + npm
- 可选：Docker（用于自动拉起 SuperTokens core）
- 可选：Java（用于本地启动 xpay）

---

## 2. 一键启动

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-fullstack-auto.ps1
```

预检模式（只演练，不真正启动）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-fullstack-auto.ps1 -DryRun
```

---

## 3. 启动逻辑

脚本会自动执行：
1. 检查 `npm` / `npx` / `curl`
2. 检查 `node_modules`，缺失时执行 `npm install`
3. 生成 `.env.local`（不存在时从 `.env.example` 或 `.env` 拷贝）
4. 自动探测可用端口（默认从 4123/3000/3567/8888/4124 起递增）
5. 生成 `.env.local.auto`
6. 执行 `prisma generate` 与 `prisma migrate deploy`
7. 尝试启动 SuperTokens（Docker compose）
8. 尝试启动 xpay（如果存在 `xpay-3.1_YTM7H\xpay-code\mvnw`）
9. 启动 API 与 Web

---

## 4. 启动产物

脚本运行后会生成：

- `.env.local.auto`
- `.run-api.log` / `.run-web.log`
- 可能还有 xpay 的独立日志

---

## 5. 端口策略

默认基准端口：
- Web: `4123`
- API: `3000`
- SuperTokens: `3567`
- xpay: `8888`
- Preview: `4124`

若端口被占用，脚本会自动递增选择可用端口。

---

## 6. 迁移与相对路径

脚本通过相对路径定位项目根目录，因此项目迁移后只要脚本位置不变，仍可直接运行。

---

## 7. 停止服务

Windows 版当前采用进程窗口方式启动，建议直接关闭窗口停止。
如果你需要更完整的 PID 停止脚本，可以后续继续补一个对应的 `stop-fullstack-auto.ps1`。

---

## 8. 常见问题

### 8.1 前端起来了但认证刷新失败
请检查：
- SuperTokens core 是否成功启动
- `.env.local.auto` 的 `SUPERTOKENS_CONNECTION_URI`
- 后端日志里是否有 SuperTokens 初始化错误

### 8.2 `/api/v1/public/servers` 返回 500
优先看 `.run-api.log`，确认是：
- localPrisma / prisma 连接失败
- 数据库 schema 不一致
- 运行环境变量与预期不一致

### 8.3 xpay 未自动启动
脚本仅在存在 `xpay-3.1_YTM7H\xpay-code\mvnw` 时自动启动。
否则会跳过并给出告警。

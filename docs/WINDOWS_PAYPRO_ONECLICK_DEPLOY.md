# Windows 一键部署文档（千服 + PayPro 个人收款二维码）

## 1. 目标

通过一条命令完成以下工作：

- 自动配置 `.env` 的 PayPro 关键变量
- 自动准备千服依赖与 Prisma
- 自动构建并启动 PayPro（Spring Boot）
- 自动启动千服 API
- 自动进行健康检查与日志提示

脚本路径：`scripts/windows/deploy-paypro-oneclick.ps1`

## 2. 前置条件

请先确保本机已安装并可在终端直接调用：

- `Node.js`（建议 18+）
- `npm`
- `Java`（JDK 8+）
- `Maven`（`mvn` 可用）
- `MySQL`（PayPro 依赖）
- `Redis`（PayPro / 千服推荐）

并确认以下目录存在：

- 千服根目录（当前仓库）
- `tmp/PayPro`（PayPro 源码）

## 3. 一键部署命令

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\deploy-paypro-oneclick.ps1
```

或使用 npm 快捷命令：

```bash
npm run deploy:paypro:win
```

可选参数：

- `-ApiPort 3000` 指定千服 API 端口
- `-PayProPort 8889` 指定 PayPro 端口
- `-BindHost 127.0.0.1` 指定回调与服务主机
- `-WithWeb` 同时启动前端开发服务（4123）
- `-SkipPayProBuild` 跳过 PayPro `mvn clean package`
- `-ForceInstall` 强制执行 `npm install`
- `-DryRun` 只打印执行计划，不真正启动

示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\deploy-paypro-oneclick.ps1 -WithWeb
```

## 4. 脚本会修改哪些配置

脚本会在 `.env` 自动写入或更新以下键：

- `PORT`
- `API_PUBLIC_URL`
- `PAYPRO_ENABLED=true`
- `PAYPRO_API_URL=http://<host>:<payproPort>`
- `PAYPRO_OPENAPI_SECRET`（若为空/默认占位符则自动生成随机值）
- `PAYPRO_NOTIFY_URL=http://<host>:<apiPort>/api/v1/payment/paypro/notify`
- `PAYPRO_TIMEOUT_MS=10000`

## 5. 启动成功后的访问地址

- 千服 API 健康检查：`http://<host>:<apiPort>/api/health`
- PayPro 接口基址：`http://<host>:<payproPort>`
- PayPro 下单接口：`POST /api/openapi/add`
- 千服 PayPro 回调：`POST /api/v1/payment/paypro/notify`

## 6. 日志文件

脚本会将后台进程日志写到项目根目录：

- `.run-api.log`
- `.run-paypro.log`
- `.run-web.log`（仅 `-WithWeb` 时）

## 7. 联通性验证建议

1. 打开千服前端/调用 `POST /api/v1/payment/create`，`paymentMethod` 使用 `wechat` 或 `alipay`。
2. 确认响应中包含 `paymentUrl`，并能打开二维码/支付页。
3. 完成支付后，确认订单状态从 `PENDING` 变为 `COMPLETED`。
4. `custom` 充值订单应自动入账钱包余额。

## 8. 停止服务

脚本以后台进程方式启动服务，你可以在任务管理器结束对应 `node` / `java` / `mvn` 进程，或使用：

```powershell
Get-Process node,java -ErrorAction SilentlyContinue | Stop-Process -Force
```

如需更细粒度停止，建议根据日志时间戳和 PID 定向处理。

## 9. 常见问题

- `mvn not found`：未安装 Maven 或未加入 PATH。
- PayPro 端口不通：检查 MySQL/Redis 是否可用、查看 `.run-paypro.log`。
- API 未就绪：查看 `.run-api.log`，确认 `.env` 与数据库可用。
- 回调不生效：确认 `PAYPRO_NOTIFY_URL` 指向可访问的千服 API 地址。

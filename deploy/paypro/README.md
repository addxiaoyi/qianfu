# PayPro 隔离恢复部署

该目录用于恢复 QianFu 的 PayPro 上游支付服务。它只负责独立 PayPro、独立 MySQL 和独立 Redis，不修改现有生产 MySQL `3306`，也不切换 QianFu 应用或前端版本。

## 安全边界

- PayPro 仅映射到宿主机 `127.0.0.1:8889`。
- MySQL 和 Redis 不映射宿主机端口，仅位于内部 Docker 网络。
- MySQL 使用独立命名卷，不连接现有生产 MySQL。
- 支付宝和微信默认均为 `false`。
- 仓库和上游 JAR 内的示例二维码不会进入运行镜像。
- 真实二维码只允许放入 `payment-assets/qr`，并以只读方式挂载。
- OpenAPI 回调只允许 HTTPS、默认端口 `443` 和精确主机白名单。
- 应用以 UID/GID `10001` 非 root 身份、只读根文件系统和移除全部 Linux capabilities 运行。
- `.env`、二维码、JAR、初始化 SQL 和数据库备份均被 Git 忽略。

## 目录

```text
deploy/paypro/
├─ Dockerfile
├─ docker-compose.yml
├─ .env.example
├─ artifacts/                 # prepare 脚本生成，不提交
├─ mysql-init/                # prepare 脚本生成，不提交
├─ payment-assets/qr/         # 已确认二维码，不提交
├─ backups/                   # 数据库备份，不提交
└─ scripts/
   ├─ prepare.ps1 / prepare.sh
   ├─ verify.ps1 / verify.sh
   ├─ verify-jar.py
   ├─ deploy.sh
   ├─ backup.sh
   └─ restore.sh
```

## 1. 构建并准备上下文

Windows：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy/paypro/scripts/prepare.ps1
python deploy/paypro/scripts/verify-jar.py deploy/paypro/artifacts/paypro.jar
```

Linux：

```sh
chmod +x deploy/paypro/scripts/*.sh
./deploy/paypro/scripts/prepare.sh
python3 deploy/paypro/scripts/verify-jar.py deploy/paypro/artifacts/paypro.jar
```

`prepare` 会执行 PayPro 测试和打包，复制 JAR 与幂等 schema，并生成 SHA-256 校验文件；不会启动容器。

## 2. 创建隔离配置

```sh
cd deploy/paypro
cp .env.example .env
```

必须替换所有 `replace-*` 值。数据库、Redis 密码至少 24 字符；OpenAPI 密钥与管理员令牌至少 32 字符。初次隔离启动必须保持：

```dotenv
PAYPRO_ALIPAY_ENABLED=false
PAYPRO_WECHAT_ENABLED=false
PAYPRO_ALLOW_BUNDLED_QR_CODES=false
PAYPRO_SITE=http://127.0.0.1:8889
PAYPRO_NOTIFY_ALLOWED_HOSTS=
```

使用 QianFu 当前支付项目对应的 OpenAPI 密钥，不得把密钥提交到 Git 或输出到日志。

## 3. 运行门禁

Windows：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1 -EnvFile .env
```

Linux：

```sh
./scripts/verify.sh .env
```

门禁会验证产物校验和、密钥长度、数据库标识符、bundled QR 禁用状态、支付启用条件及 Compose 解析。启用任一支付方式时，还会强制要求：

- `PAYPRO_SITE` 为真实 HTTPS 地址；
- `PAYPRO_NOTIFY_ALLOWED_HOSTS` 为 QianFu 回调的真实主机；
- 对应目录存在已确认 PNG 二维码；
- 管理员通知邮箱配置完整。

## 4. 隔离启动

在生产服务器部署目录执行：

```sh
./scripts/deploy.sh .env
curl -fsS http://127.0.0.1:8889/api/health
```

`deploy.sh` 仅构建并启动本目录的三个容器，不修改 QianFu 环境变量、数据库支付项目或当前发布版本。健康端点只有在 MySQL 与 Redis 均可用时才返回：

```json
{"status":"ok"}
```

公开访问需要在确认真实域名后单独配置 TLS 反向代理；容器端口仍保持回环绑定。

## 5. 导入已确认收款资产

仅在确认二维码归属、支付方式和有效性后导入，例如：

```text
payment-assets/qr/alipay/custom.png
payment-assets/qr/wechat/custom.png
```

固定金额二维码使用 PayPro 原有结构：

```text
payment-assets/qr/<payType>/<amount>/<index>.png
```

不得复制 `tmp/PayPro/src/main/resources/static/assets/qr` 中的未知历史文件。

## 6. 真实支付验收门禁

1. 配置真实 PayPro HTTPS 地址和 QianFu 回调主机白名单。
2. 导入并复核对应收款二维码或平台凭据。
3. 只启用需要验收的一种支付方式。
4. 重新执行 `verify`，再滚动重建 PayPro。
5. 使用支付平台支持的最小金额创建一笔真实订单。
6. 核对付款前可支付、付款后不可重复支付、PayPro 状态成功、QianFu 回调验签成功、商城订单自动交付，以及金额和收款账户一致。
7. 验收完成后执行数据库备份。

只有真实支付闭环通过后，才允许发布商城，并设置：

```dotenv
PAYMENT_PROJECT_CONFIG_SOURCE=database
VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS=<真实 PayPro 公网主机>
UPLOAD_DIR=<已确认的生产上传目录>
```

## 备份与恢复

备份：

```sh
PAYPRO_BACKUP_RETENTION_DAYS=14 ./scripts/backup.sh .env
```

恢复会替换 PayPro 专用数据库，必须显式确认：

```sh
PAYPRO_RESTORE_CONFIRM=restore ./scripts/restore.sh .env backups/paypro-YYYYMMDDTHHMMSSZ.sql.gz
```

恢复脚本会停止 PayPro 应用、校验压缩包与可用的 SHA-256、重建专用数据库、导入后重新启动并等待健康检查。它不连接宿主机 MySQL `3306`。

## 回滚

隔离服务未接入 QianFu 前，回滚只需停止本目录容器：

Docker Compose 插件：

```sh
docker compose --env-file .env -f docker-compose.yml down
```

独立 `docker-compose` 命令：

```sh
docker-compose --env-file .env -f docker-compose.yml down
```

保留命名卷可再次启动；确认不再需要数据后，才可另行人工删除专用卷。不要使用 `down -v` 作为常规回滚命令。

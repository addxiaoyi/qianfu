# 宝塔托管收口 2026-05-20

## 目标

- 尽量把千服主站交给宝塔站点/Nginx 托管
- 尽量把 `qianfu-api` 纳入宝塔 Node 项目体系
- 明确数据库层哪些已经能交给宝塔，哪些当前还不能

## 已确认现状

- 宝塔已安装 `nodejs` 插件，具备 Node 项目与 PM2 项目管理代码
- 宝塔当前没有 PostgreSQL 图形化插件
- MySQL 当前已恢复为真正的 `systemd active (running)`
- 系统 PostgreSQL 16 在线，可用
- 新增数据盘已挂载：
  - 设备：`/dev/vdb1`
  - 挂载点：`/mnt`
  - 文件系统：`ext4`
  - 当前可用空间约 `5.7G`

## 本轮已完成

- 恢复了被清空的宝塔站点文件：
  - `/www/server/panel/vhost/nginx/mc-u.top.conf`
- 修复了当前机器 Nginx 不兼容的 `http2` 配置写法，保证 Nginx 可重载
- 重新拉起了 `qianfu-api`
- 恢复了主站路由：
  - `http://mc-u.top/` -> 千服前端
  - `https://mc-u.top/api/health` -> `healthy`
- 宝塔面板数据库 `default.db` 中 `sites` 表原本缺少 Node 项目所需字段：
  - `type_id`
  - `project_type`
  - `project_config`
  - `edate`
- 已补齐上述字段
- 已将 `qianfu-api` 写入宝塔 `sites` 表，登记为 `project_type='Node'`
- 已将以下域名写入宝塔 `domain` 表并关联到 `qianfu-api`：
  - `mc-u.top:80`
  - `www.mc-u.top:80`
  - `mc-u.top:443`
  - `www.mc-u.top:443`
- 已做一轮安全清理：
  - 删除 `/www/wwwroot/qianfu-app/dist-server.__prev`
  - 清理旧的 SQLite 备份副文件 `.db-wal` / `.db-shm`
  - 删除部分 `/tmp` 历史部署包

## 当前托管边界

### 已纳入宝塔

- 站点/Nginx 配置：
  - `mc-u.top`
- Node 项目登记：
  - `qianfu-api`

### 暂未纳入宝塔图形化托管

- PostgreSQL：
  - 当前仅为系统服务层可用
  - 宝塔未安装 PostgreSQL 图形化插件
- MySQL：
  - 本轮已恢复服务、可登录、可建库
  - 已创建：
    - 数据库：`qianfu`
    - 用户：`qianfu`
  - 当前密码：
    - `qfmysql_efff00c3ae21e305`
  - 本轮已补齐千服 `MySQL Prisma schema/client` 生成链
  - 已完成：
    - `prisma/schema.mysql.prisma`
    - `prisma/generated/mysql-client`
    - `dist-server/prisma/generated/mysql-client`
    - 运行时 client 自动选择
    - 备份脚本 MySQL 分支
    - 部分原生 SQL 的 MySQL 兼容分支
  - 本轮已完成真实数据导入与主站短窗口切换

## 线上验证

- `https://mc-u.top/api/health` 返回 `healthy`
- `https://mc-u.top/api/ready` 返回 `ready`
- `https://mc-u.top/` 返回 `200`
- `http://mc-u.top/api/health` 返回 301 到 HTTPS，符合当前站点配置
- 宝塔 `default.db` 中已能查询到：
  - `name = qianfu-api`
  - `project_type = Node`
- 宝塔 `sites` 表中 `qianfu-api` 路径为 `/www/wwwroot/qianfu-app`
- 宝塔 `domain` 表结构与预期不一致，本轮未再次从 SQLite 直接复核到 `mc-u.top` / `www.mc-u.top` 的 80/443 记录，但线上 Nginx 路由仍正常
- MySQL 已恢复并监听 `3306`
- `qianfu` MySQL 数据库与独立用户已创建并验证可登录
- 本地 `MySQL Prisma Client` 生成通过，`dist-server/prisma/generated/mysql-client` 已产出
- 生产 `.env` 已切换：
  - `REDIS_ENABLED=false`
  - `DATABASE_URL=mysql://qianfu:***@127.0.0.1:3306/qianfu`
  - `LOCAL_DATABASE_URL=mysql://qianfu:***@127.0.0.1:3306/qianfu`
- `MySQL canary` 已完成一轮真实运行验证：
  - `3012` 实例真实工作目录为 `/www/wwwroot/qianfu-app`
  - 运行时使用：
    - `PORT=3012`
    - `NODE_ENV=production`
    - `DATABASE_URL=mysql://qianfu:***@127.0.0.1:3306/qianfu`
    - `LOCAL_DATABASE_URL=mysql://qianfu:***@127.0.0.1:3306/qianfu`
  - `3012 /api/health` 可返回 `healthy`
  - 该 canary 已在本轮稳定性修复中下线，避免继续占用生产机 CPU / IO

## 本轮新增确认

- 主站 PM2 进程 `qianfu-api` 仍在线，未被 canary 干扰
- 当前 `3012` canary 已下线，主站只保留 `3001` 一个千服 API 进程
- 主站稳定性修复已落地：
  - 修复 `/api/ready` 的 Redis 状态判定逻辑
  - 将 `/api/ready` 加入 `antiCrawler` / `WAF` / SQL 注入防护白名单
  - 生产 `.env` 已切为 `REDIS_ENABLED=false`
  - Redis 连接失败不再无限重试，改为内存缓存兜底
  - `warmup-cache` 在 Redis 明确关闭时直接跳过
  - `backupService` 默认不再在每次 PM2 启动时立即做 SQLite 备份，需显式 `RUN_STARTUP_BACKUP=true`
- 本轮主站曾因高负载 + canary 占用出现过一次 `502 Bad Gateway`，已通过下线 canary、修正 PM2 进程和重启主站恢复
- 当前根盘状态已明显改善：
  - `/` 约 `29G` 总量，约 `13G` 可用
  - `/mnt` 约 `20G` 总量，约 `5.7G` 可用
  - `/dev/shm` 约 `3.7G` 可用
- MySQL 受管状态已恢复：
  - 已清理旧的孤儿 `mysqld_safe` / `mysqld`
  - `systemctl is-active mysqld` 返回 `active`
  - `mysql -uroot -padmin -e "SELECT 1"` 可成功
  - `qianfu` 数据库仍可访问
- SQLite -> MySQL 真实迁移已执行：
  - 生产 SQLite 源库：`/www/wwwroot/qianfu-app/prisma/dev.db`
  - 迁移脚本：`/www/wwwroot/qianfu-app/scripts/migrate-sqlite-to-mysql.mjs`
  - 已导入的核心表包括：
    - `User`
    - `Wallet`
    - `Session`
    - `Notification`
    - `AuditLog`
    - `Payment`
    - `Transaction`
    - `Ticket`
    - `TicketMessage`
    - `MarketplaceProduct`
    - `SystemConfig`
    - `checkin_history`
- 主站短窗口切主已完成：
  - 已下线 `qianfu-mysql-canary`
  - 已备份切主前 `.env` 与 `dev.db` 到 `/mnt/qianfu-data/cutover-backups`
  - `qianfu-api` 已按 MySQL 主库重启
  - 当前主站 `health/ready` 已对外恢复正常
- 为避免主库与本地库指向同一数据源时发生自同步放大，已在代码里加入保护：
  - 当 `DATABASE_URL` 与 `LOCAL_DATABASE_URL` 相同，`syncService` 自动禁用
- 切主后回归已完成一轮：
  - `auth/register/mail` 冒烟通过：
    - 登录
    - 注册
    - 用户名可用性检查
    - 验证码发送接口
    - 管理端邮件配置读取
    - 测试邮件发送
  - 主站本机和外网再次确认：
    - `https://mc-u.top/`
    - `https://mc-u.top/api/health`
    - `https://mc-u.top/api/ready`
  - `smoke-web-flows` 已重新通过：
    - 首页 HTML
    - OAuth 状态
    - GitHub Start / Callback Redirect
    - 密码登录
    - Profile
    - Mail Config / Mail Library
    - Payment Projects
    - Payment List
    - `qiupay-health`
  - 独立 `qiu-pay` 外围服务已恢复：
  - PM2 名称：`qiu-pay`
  - 启动命令：`/www/wwwroot/qiu-pay/qiu-pay-pm2.sh`
  - 监听端口：`8001`
    - 健康检查：`http://127.0.0.1:8001/health -> {"status":"ok"}`
  - 签到链路已在 MySQL 主库下恢复：
    - `GET /api/v1/user/checkin/status` 已从 `500` 修复为 `200`
    - 根因是 `checkin_history` 运行时建表/建索引逻辑混入了 SQLite / PostgreSQL 语法
    - 当前已改为：MySQL 主库下若表已存在，直接跳过该运行时 DDL
- 千服备份目录已迁到新盘：
  - 实际目录：`/mnt/qianfu-data/backups`
  - 原路径：`/www/wwwroot/qianfu-app/backups`
  - 当前通过软链接指向新盘，后续 SQLite 备份不会继续堆在应用根目录

## 剩余风险

- 宝塔 Node 项目记录虽然已经写入，但还没有完整走宝塔前端界面创建流程，因此面板某些高级功能是否完全兼容还需要后续人工点检
- `/mnt` 新盘可用空间仍有限，且当前机器总内存/Swap 依然偏紧；如果后续继续跑大体积归档、数据库导入或多项目构建，仍要控制并发
- 当前主库已经切到 MySQL，但仍有两类后续收尾项：
  - MySQL schema 仍存在“Prisma 生成默认 `varchar(191)` 与线上手工 `ALTER` 长文本列”并存的状态，后续需要再做一次 schema 对账，避免代码与库结构长期漂移
  - 当前机器内存/Swap 仍然偏紧，双实例并跑（主站 + MySQL canary）会显著抬高负载，因此后续验证与维护应避免并行跑第二个完整应用实例
  - 生产前端静态发布目前依赖整包覆盖：
    - 本轮曾出现 `index.html` 已切新、但懒加载 chunk 缺失导致 MIME 报错
    - 现已通过整包补齐恢复
    - 后续发布流程应固定为“整包 dist 原子替换”，避免只传入口文件造成分片缺失
    - 当前根 `npm run build` 会生成 `qianfu-liandeng/dist/qianfu-dist-manifest.json`；发布后必须能通过 `prod:verify:frontend:manifest`，必要时再用 `prod:verify:frontend:files` 做公网 SHA-256 全量复核
    - 当前主站/API/支付域同时异常时，生产机或宝塔终端优先执行 `sudo bash scripts/linux/restore-prod-public.sh`，让脚本按阶段恢复并写入 `logs/prod-restore/`
    - 若只能通过宝塔文件管理上传，使用 `npm run prod:restore:bundle` 生成恢复包；包内自带 `scripts/prod-restore-runners/*.mjs`，公网诊断和前端 freshness 验收不依赖生产机安装 `tsx`
    - 若支付域证书仍未就绪但需要先恢复主站，可在生产机使用 `REPAIR_SCOPE=web sudo bash scripts/linux/repair-prod-edge.sh`，它不会要求或安装 `pay.star-web.top` 配置

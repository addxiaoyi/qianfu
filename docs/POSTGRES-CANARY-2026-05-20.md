# PostgreSQL Canary 状态 2026-05-20

## 本轮目标

- 把“生产仍依赖 SQLite”的剩余风险继续收口
- 先修代码与构建链，再做 PostgreSQL canary 预演
- 不直接破坏现网 `mc-u.top`

## 已完成

- 补齐后端数据库 provider 检测：
  - [server/utils/dbProvider.ts](D:/qwq/项目/千服/server/utils/dbProvider.ts)
- 补齐运行时 Prisma client 自动选择：
  - SQLite -> `generated/client` / `generated/local-client`
  - PostgreSQL -> `generated/postgres-client`
  - 文件：
    - [server/utils/prismaClientResolver.ts](D:/qwq/项目/千服/server/utils/prismaClientResolver.ts)
    - [server/db.ts](D:/qwq/项目/千服/server/db.ts)
    - [server/localDb.ts](D:/qwq/项目/千服/server/localDb.ts)
    - [server/intelligent-probe/db.ts](D:/qwq/项目/千服/server/intelligent-probe/db.ts)
- 补齐 PostgreSQL Prisma schema 生成链：
  - [scripts/prepare-postgres-prisma-schema.mjs](D:/qwq/项目/千服/scripts/prepare-postgres-prisma-schema.mjs)
  - [scripts/sync-prisma-client-to-dist.mjs](D:/qwq/项目/千服/scripts/sync-prisma-client-to-dist.mjs)
  - [package.json](D:/qwq/项目/千服/package.json) 已接入生成流程
- SQLite 专属逻辑已做 provider 分支：
  - 备份服务 / 备份脚本
  - DB 优化器
  - 签到表初始化与主要原生 SQL
  - 相关文件：
    - [scripts/backup-db.ts](D:/qwq/项目/千服/scripts/backup-db.ts)
    - [server/services/backupService.ts](D:/qwq/项目/千服/server/services/backupService.ts)
    - [server/services/dbOptimizer.ts](D:/qwq/项目/千服/server/services/dbOptimizer.ts)
    - [server/controllers/userLevelController.ts](D:/qwq/项目/千服/server/controllers/userLevelController.ts)
- 本地验证通过：
  - `npm run typecheck:server`
  - `npm run server:build`
- 服务器 PostgreSQL 现状已确认：
  - PostgreSQL 16 在线
  - `127.0.0.1:5432` 可连接
  - 已创建独立 `qianfu` 数据库与角色用于 canary
  - 已把 PostgreSQL schema 空库建表跑通

## 当前真实阻塞

- 不是代码主链问题，而是服务器运行环境问题：
  - 根分区 `/dev/vda1` 仅剩极少可用空间，实测长期处于 `100%`
  - 在 `/www/wwwroot` 做任何完整 canary 副本都会因为磁盘不足失败
  - 远端 Prisma CLI 与仓库版本漂移，远端直接执行 Prisma migrate 会命中新版配置规则，不适合作为当前主路径
- 已尝试规避：
  - 删除明确可清理的临时部署包与半成品 canary 目录，释放了一部分空间
  - 改为 `/dev/shm` tmpfs canary 路径继续预演
  - 改为本地生成 PostgreSQL schema / client，再上传远端验证
- 仍未完成的最后一步：
  - 在服务器上用最新 PostgreSQL 产物成功拉起 `3011` canary 进程并回 `GET /api/health`

## 宝塔侧现状

- 宝塔面板已安装 `nodejs` 插件，具备 Node 项目/PM2 项目管理能力
- 宝塔当前没有 PostgreSQL 图形化插件
- MySQL 服务当前因 OOM 处于失败状态，不适合作为本轮迁移目标
- 因此“全部数据库交给宝塔图形化托管”在当前机器上不成立
- 当前可落地的宝塔托管边界是：
  - 站点/Nginx 配置交给宝塔
  - Node 项目尽量纳入宝塔 Node 项目管理
  - 数据库服务层暂时仍走系统 PostgreSQL

## 结论

- 代码层面：
  - PostgreSQL 支持链已经比之前完整得多，已经不是“完全不能切”的状态
- 服务器层面：
  - 现在阻塞继续推进的主因是磁盘空间，不是主业务代码
- 生产主站：
  - 仍保持 SQLite 现网
  - `https://mc-u.top` 主站未因本轮 PostgreSQL 预演而被破坏

## 下一步建议

1. 先在服务器继续释放根盘空间，至少保证数百 MB 到 1 GB 稳定余量
2. 重新跑 `3011` PostgreSQL canary 健康检查
3. canary 启动通过后，再做 SQLite -> PostgreSQL 真实数据迁移
4. 数据迁移通过后，再安排主进程切换

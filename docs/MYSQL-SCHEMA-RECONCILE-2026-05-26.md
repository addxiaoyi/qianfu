# MySQL Schema 对账（2026-05-26）

## 目标

- 解决“Prisma 模型定义”与“线上手工 ALTER”长期漂移问题。
- 生成可审计 SQL，而不是直接盲改生产库。

## 对账工具

- 通用实现：`scripts/schema-reconcile.mjs`
- MySQL 兼容入口：`scripts/mysql-schema-reconcile.mjs`
- PostgreSQL 入口：`scripts/postgresql-schema-reconcile.mjs`
- 生成报告：`npm run db:mysql:reconcile` / `npm run db:postgres:reconcile`
- 发布零漂移门禁：`npm run db:mysql:assert-clean` / `npm run db:postgres:assert-clean`
- 自动识别 provider：`npm run db:schema:reconcile` / `npm run db:schema:assert-clean`

工具只执行 Prisma `migrate diff`，不会执行生成的 SQL，也不会运行 `migrate deploy`。数据库 URL 通过 schema datasource 和子进程环境传递，不出现在 Prisma 命令行参数、控制台或 JSON 报告中。

## 用法

1. 指定目标 MySQL URL（建议只读账号先做对账）：

```bash
MYSQL_SCHEMA_DIFF_URL="mysql://user:pass@host:3306/qianfu" npm run db:mysql:reconcile
```

2. 产物输出目录：

- `output/mysql-schema-reconcile/<timestamp>-db-to-schema.sql`：使当前数据库收敛到部署 schema 的前向 SQL。
- `output/mysql-schema-reconcile/<timestamp>-schema-to-db.sql`：反向差异，仅用于审计当前数据库额外结构。
- `output/mysql-schema-reconcile/<timestamp>-report.json`：目标主机（不含凭据）、SQL 哈希、语句数和破坏性语句计数。

PostgreSQL 使用同名文件，目录为 `output/postgresql-schema-reconcile/`。

## 解释

- `schema-to-db.sql`：从“schema 视角”到“当前数据库现状”的漂移（主要用于看数据库比 schema 少/多什么）。
- `db-to-schema.sql`：把“当前数据库”收敛到 `prisma/schema.mysql.prisma` 所需 SQL（要落库时优先看这个）。

## 2026-05-26 实测记录

1. 目标 `qianfu`（`wb.ddns.s3.fan:3306`）：
- `steve`：`P1010`（无库权限）
- `root`：`P1003`（库不存在）

2. 改用 `qianfu_public` 后成功：

```bash
MYSQL_SCHEMA_DIFF_URL="mysql://steve:***@wb.ddns.s3.fan:3306/qianfu_public" npm run db:mysql:reconcile
```

产物：
- `output/mysql-schema-reconcile/2026-05-26T12-51-18-276Z-schema-to-db.sql`（6352 bytes）
- `output/mysql-schema-reconcile/2026-05-26T12-51-18-276Z-db-to-schema.sql`（32114 bytes）

统计：
- `db-to-schema.sql`：`CreateTable=30`、`AlterTable=4`、`AddForeignKey=42`
- `schema-to-db.sql`：`DropTable=30`、`AlterTable=4`、`DropForeignKey=42`

## 建议流程

1. 在预发布环境注入真实生产形态配置，运行 `npm run db:schema:reconcile` 并审阅 JSON 报告。
2. 对 `db-to-schema.sql` 做人工评审；只要 `destructiveStatementCount > 0`，必须先完成数据迁移方案和完整备份。
3. 在测试库执行经评审的前向 SQL，验证数据保留与应用兼容性。
4. 数据库收敛后运行 `npm run db:schema:assert-clean`，必须以零漂移退出。
5. 部署应用后运行 `npm run release:staging:verify`，验证生产环境策略、数据库零漂移、严格 readiness 和前端构建一致性。

`release:staging:verify` 是只读验证，不会应用迁移或执行 SQL。

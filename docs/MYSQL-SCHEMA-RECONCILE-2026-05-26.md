# MySQL Schema 对账（2026-05-26）

## 目标

- 解决“Prisma 模型定义”与“线上手工 ALTER”长期漂移问题。
- 生成可审计 SQL，而不是直接盲改生产库。

## 新增工具

- 脚本：`scripts/mysql-schema-reconcile.mjs`
- 命令：`npm run db:mysql:reconcile`

## 用法

1. 指定目标 MySQL URL（建议只读账号先做对账）：

```bash
MYSQL_SCHEMA_DIFF_URL="mysql://user:pass@host:3306/qianfu" npm run db:mysql:reconcile
```

2. 产物输出目录：

- `output/mysql-schema-reconcile/<timestamp>-schema-to-db.sql`
- `output/mysql-schema-reconcile/<timestamp>-db-to-schema.sql`

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

1. 先在测试库执行 `db-to-schema.sql`，验证无破坏性影响。
2. 再在低峰期生产执行，执行前做完整备份。
3. 执行后重新跑：
   - `npm run server:build`
   - `npm run release:preflight`

# API 查询与分页指南（E01-E10）

## 目标

统一分页、排序、筛选、搜索、时间范围与性能策略，确保不同列表接口具备一致的查询体验。

## 统一查询参数

- `page`: 页码，默认 `1`，最小 `1`。
- `limit`: 每页条数，默认 `20`（审计日志默认 `50`），范围 `1-100`。
- `search` / `q`: 关键字参数，`q` 为 `search` 别名。
- `fuzzy`: 是否模糊匹配，默认 `true`；传 `false` 时执行精确匹配。
- `sortBy`: 排序字段，仅允许白名单字段。
- `sortOrder` / `order`: 排序方向，支持 `asc|desc`，默认 `desc`。
- `startDate` / `endDate`: 时间范围（ISO 日期字符串），边界为闭区间。
- `status`: 状态过滤（各资源枚举见下文）。

## 已统一能力的接口

- `GET /api/v1/servers`
  - 支持分页、排序、关键词、模糊查询、状态过滤、时间范围、多条件组合查询。
  - 默认排序：`activity desc, updated_at desc`。
- `GET /api/v1/admin/users`
  - 支持分页、排序、关键词、模糊查询、状态过滤（`verified|unverified`）、时间范围。
  - 默认排序：`created_at desc`。
- `GET /api/v1/payment/user/list`
  - 支持分页、排序、关键词、模糊查询、状态/套餐过滤、时间范围。
  - 默认排序：`created_at desc`。
- `GET /api/v1/payment/admin/list`
  - 支持分页、排序、关键词、模糊查询、状态/套餐/用户过滤、时间范围。
  - 默认排序：`created_at desc`。
- `GET /api/v1/tickets`
  - 支持分页、排序、关键词、模糊查询、状态/优先级过滤、时间范围。
  - 默认排序：`updated_at desc`。
- `GET /api/v1/admin/audit/logs`
  - 支持分页、排序、关键词（`search|q`）、动作/级别/用户过滤、时间范围。
  - 默认排序：`created_at desc`。

## 多条件组合规则

- 规则一：结构化过滤条件采用 `AND` 组合（例如 `status + time range + category`）。
- 规则二：关键字匹配字段采用 `OR` 组合（例如 `name OR summary OR ip`）。
- 规则三：关键字条件整体再并入外层 `AND`，保证组合可预测。

## 状态过滤约定

- 服务器列表：`online | offline | unknown`
- 用户列表：`all | verified | unverified`
- 工单列表：`OPEN | IN_PROGRESS | RESOLVED | CLOSED`
- 支付列表：由业务状态字符串驱动（如 `PENDING | COMPLETED | FAILED`）

## 时间范围约定

- `startDate`：对应 `>= startDate`
- `endDate`：对应 `<= endDate`
- 解析失败会触发统一校验错误 `VALIDATION_ERROR`。

## 查询性能策略（E10）

- 列表查询统一白名单排序字段，避免无索引高风险排序。
- 公共服务器列表使用 Redis 缓存（带查询维度哈希 key）。
- 新增关键复合索引（Prisma）以覆盖高频筛选/排序组合：
  - `Payment`: `user_id+created_at`、`status+created_at`
  - `Ticket`: `user_id+status+updated_at`
  - `AuditLog`: `created_at+action`、`user_id+created_at`
  - `PermissionHistory`: `user_id+created_at`

## 联调示例

```http
GET /api/v1/servers?page=1&limit=20&search=mini&fuzzy=true&status=online&sortBy=activity&sortOrder=desc
```

```http
GET /api/v1/payment/admin/list?page=1&limit=20&q=wechat&status=COMPLETED&startDate=2026-01-01&endDate=2026-01-31
```

```http
GET /api/v1/admin/audit/logs?page=1&limit=50&search=UPDATE_USER_ROLE&sortBy=created_at&sortOrder=desc
```

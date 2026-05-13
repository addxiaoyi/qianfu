# API 字段字典

本字典提供高频请求字段与响应字段说明，供联调、测试与排障快速检索。

## 请求字段（D03）

### 通用分页参数

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `page` | integer | 否 | `1` | 页码，从 1 开始 |
| `limit` | integer | 否 | `20` | 每页数量，建议 `1~100` |

### 服务器创建（`POST /api/v1/servers`）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 服务器名称，最大 100 字符 |
| `host` | string | 是 | 主机地址（域名/IP） |
| `port` | integer | 否 | 端口，默认 `25565` |
| `version` | string | 否 | 游戏版本 |
| `description` | string | 否 | 服务器描述 |

### 工单创建（`POST /api/v1/tickets`）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 工单标题 |
| `description` | string | 是 | 工单描述（支持安全清洗） |
| `priority` | enum | 否 | `LOW`/`MEDIUM`/`HIGH` |
| `paymentId` | integer | 否 | 关联支付记录 ID |

## 响应字段（D04）

### 统一成功响应

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | boolean | 固定 `true` |
| `message` | string | 业务提示文案 |
| `data` | any | 业务数据 |
| `requestId` | string | 请求追踪 ID |
| `timestamp` | string(date-time) | 响应时间 |
| `meta` | object | 附加元信息（分页/批量统计） |

### 统一错误响应

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | boolean | 固定 `false` |
| `error.message` | string | 错误描述 |
| `error.code` | string | 业务错误码 |
| `error.statusCode` | integer | HTTP 状态码镜像 |
| `error.requestId` | string | 请求追踪 ID |
| `error.details` | any/null | 错误细节（校验等） |
| `timestamp` | string(date-time) | 响应时间 |

### 分页元信息

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `meta.total` | integer | 总条数 |
| `meta.page` | integer | 当前页 |
| `meta.limit` | integer | 每页条数 |
| `meta.totalPages` | integer | 总页数 |

## 错误码字段参考（D05）

详细错误码与处理建议见：`docs/API-ERROR-CODE-CATALOG.md`。

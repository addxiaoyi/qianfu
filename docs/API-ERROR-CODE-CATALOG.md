# API 错误码目录

本目录与 `server/constants/errorCodeCatalog.ts` 保持一致，作为联调与排障入口。

## 客户端与通用错误

| Code | HTTP | Description |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | 请求语法不合法 |
| `UNAUTHORIZED` | 401 | 未认证或认证失效 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源状态冲突 |
| `UNPROCESSABLE_ENTITY` | 422 | 业务语义校验失败 |
| `TOO_MANY_REQUESTS` | 429 | 请求过频 |
| `VALIDATION_ERROR` | 400 | 参数校验失败 |
| `INVALID_INPUT` | 400 | 输入不满足业务规则 |
| `INVALID_OPERATION` | 400 | 当前状态不允许该操作 |
| `RESOURCE_ALREADY_EXISTS` | 409 | 资源已存在 |
| `RESOURCE_NOT_FOUND` | 404 | 业务资源不存在 |
| `RESOURCE_CONFLICT` | 409 | 资源冲突 |

## 认证与会话

| Code | HTTP | Description |
| --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | 账号凭证错误 |
| `TOKEN_EXPIRED` | 401 | 令牌已过期 |
| `TOKEN_INVALID` | 401 | 令牌无效 |
| `SESSION_EXPIRED` | 401 | 会话过期 |
| `AUTHENTICATION_FAILED` | 401 | 认证流程失败 |
| `PERMISSION_DENIED` | 403 | 权限规则拒绝 |

## 限流与超时

| Code | HTTP | Description |
| --- | --- | --- |
| `RATE_LIMIT_EXCEEDED` | 429 | 业务限流超限 |
| `RATE_LIMITED` | 429 | 自定义限流触发（兼容历史代码） |
| `LIMIT_EXCEEDED` | 429 | 操作超出系统限制 |
| `TIMEOUT_ERROR` | 408 | 请求超时 |
| `GATEWAY_TIMEOUT` | 504 | 上游超时 |

## 服务器与依赖

| Code | HTTP | Description |
| --- | --- | --- |
| `INTERNAL_ERROR` | 500 | 服务内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 依赖服务不可用 |
| `NETWORK_ERROR` | 503 | 网络错误 |
| `DATABASE_ERROR` | 500 | 数据库操作失败 |
| `UNIQUE_CONSTRAINT_VIOLATION` | 409 | 唯一约束冲突 |
| `FOREIGN_KEY_CONSTRAINT_VIOLATION` | 400 | 外键约束失败 |

## 文件相关

| Code | HTTP | Description |
| --- | --- | --- |
| `FILE_UPLOAD_ERROR` | 400 | 文件上传失败 |
| `FILE_NOT_FOUND` | 404 | 文件不存在 |
| `FILE_SIZE_EXCEEDED` | 413 | 文件体积超限 |

## 支付相关

| Code | HTTP | Description |
| --- | --- | --- |
| `PAYMENT_FAILED` | 402 | 支付失败 |
| `PAYMENT_REQUIRED` | 402 | 需要先完成支付 |
| `INSUFFICIENT_BALANCE` | 402 | 余额不足 |
| `INSUFFICIENT_FUNDS` | 402 | 资金不足 |
| `INVALID_PAYMENT_METHOD` | 400 | 支付方式无效 |
| `TRANSACTION_NOT_FOUND` | 404 | 交易记录不存在 |

## 联调建议

- 优先通过 `error.code` 判断业务分支，不要只依赖文案。
- 服务端会在错误响应中返回 `requestId`，用于链路追踪。
- 参数错误优先读取 `error.details`，其结构由校验中间件统一输出。

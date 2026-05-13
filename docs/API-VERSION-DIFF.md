# API 版本差异说明（D09）

## 当前状态

- 默认版本：`v1`
- 支持版本：`v1`
- 文档基线：`docs/openapi.generated.json`

## v1 基线摘要

- 统一前缀：`/api/v1`
- 统一响应：
  - 成功：`success/message/data/requestId/timestamp/meta`
  - 失败：`success=false + error{message/code/statusCode/details/requestId}`
- 分页：`meta.total/page/limit/totalPages`

## 未来版本差异记录模板

当新增 `v2` 或更高版本时，请按接口维度补齐以下表格：

| 接口 | v1 | v2 | 差异类型 | 迁移建议 |
| --- | --- | --- | --- | --- |
| `GET /servers` | 支持 `page/limit` | 支持 `cursor/limit` | 查询协议变更 | 客户端分页器改为游标模式 |

差异类型建议枚举：

- `新增字段`
- `字段弃用`
- `字段类型变更`
- `路径变更`
- `鉴权变更`
- `状态码语义变更`

## 版本迁移流程

1. 在 `server/constants/api.ts` 更新 `SUPPORTED_API_VERSIONS`。
2. 在 `server/middleware/apiVersioning.ts` 注册新版本配置。
3. 生成新文档并更新本文件差异表。
4. 在 `docs/API-CHANGELOG.md` 记录版本迁移条目。

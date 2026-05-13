# API 响应设计规范（C01-C10）

本规范定义服务端统一响应语义，目标是让列表、详情、创建、更新、删除、批量、空数据、错误码、业务文案都可预测、可复用、可测试。

## 1. 统一成功包络

所有成功响应统一使用：

```json
{
  "success": true,
  "message": "Ticket created successfully",
  "data": {},
  "requestId": "req_xxx",
  "timestamp": "2026-04-27T10:00:00.000Z",
  "meta": {}
}
```

统一构造入口：`server/utils/response.ts`

- `sendSuccess`
- `sendListResponse`
- `sendDetailResponse`
- `sendCreatedResponse`
- `sendUpdatedResponse`
- `sendDeletedResponse`
- `sendBatchResponse`
- `sendEmptyResponse`

## 2. 分页与列表（C01/C02/C08）

分页列表统一结构：

```json
{
  "success": true,
  "message": "Ticket list retrieved successfully",
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

约束：

- `meta` 必含 `total/page/limit/totalPages`
- 空列表不报错，返回 `200`，`data: []`
- 空列表消息统一为 `No {resource} found`

## 3. 详情（C03）

详情接口统一走 `sendDetailResponse`：

- 资源存在：`200`
- 资源不存在：统一错误包络（`404 + NOT_FOUND`）

## 4. 创建（C04）

创建接口统一走 `sendCreatedResponse`：

- 状态码统一 `201`
- 建议设置 `Location` 响应头
- `message` 统一为 `{resource} created successfully`

## 5. 更新（C05）

更新接口统一走 `sendUpdatedResponse`：

- 状态码统一 `200`
- `message` 统一为 `{resource} updated successfully`

## 6. 删除（C06）

删除接口统一走 `sendDeletedResponse`：

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "mode": "soft"
  }
}
```

约束：

- `mode=soft|hard` 必须显式
- 硬删除消息：`{resource} permanently deleted successfully`

## 7. 批量操作（C07）

批量接口统一走 `sendBatchResponse`：

```json
{
  "success": true,
  "data": {
    "summary": { "total": 2, "successful": 1, "failed": 1 },
    "results": [
      { "id": 1, "success": true },
      { "id": 2, "success": false, "error": "Not found" }
    ]
  },
  "meta": { "total": 2, "successful": 1, "failed": 1 }
}
```

要求：

- `results` 必须能区分成功/失败项
- `summary` 与 `meta` 保持一致，便于网关/前端统一统计

## 8. 错误码说明（C09）

错误码目录统一维护在：

- `server/constants/errorCodeCatalog.ts`
- 文档镜像：`docs/API-ERROR-CODE-CATALOG.md`

要求：

- 错误码唯一
- 每个错误码有 `httpStatus/description/handling`
- 状态码映射与 `getStatusCodeForErrorCode` 一致

## 9. 业务提示文案（C10）

统一文案目录：

- `server/constants/businessMessages.ts`

特点：

- 支持 `zh-CN` / `en-US`
- 支持 `{{resource}}` 占位符
- 响应助手默认从目录取文案，可按接口覆盖

## 10. 例外策略

存在少量三方回调接口（例如支付网关回调）要求纯文本响应（`success` / `fail`），此类端点允许不使用统一 JSON 包络，但必须在接口文档中标注“第三方协议约束”。

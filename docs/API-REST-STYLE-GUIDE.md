# API REST 规范基线（A01-A10）

> 生效日期：2026-04-27  
> 适用范围：`server/routes/**` 下所有业务接口 + `server/middleware/**` 统一处理链

## 1. 风格与命名（A01-A04）

- 统一风格：Resource-Oriented REST。
- 资源命名：路径段使用 `kebab-case`，禁止 `camelCase`、`snake_case`、大写。
- 方法语义：
  - `GET` 仅用于读取。
  - `POST` 用于创建或动作型子资源触发。
  - `PUT/PATCH` 用于更新。
  - `DELETE` 用于删除。
- 路径层级：`/{domain}/{resource}/{id}/{sub-resource}`，避免在路径里重复写 `/api` 前缀。

## 2. 响应结构（A05-A07）

- 成功响应统一结构：
  - `success: true`
  - `message: string`
  - `data: any`
  - `requestId?: string`
  - `timestamp: string`
  - `meta?: object`
- 错误响应统一结构：
  - `success: false`
  - `error.message: string`
  - `error.code: string`
  - `error.statusCode: number`
  - `error.requestId?: string`
  - `error.details?: any`
  - `timestamp: string`

## 3. 状态码映射（A08）

- 业务错误码与 HTTP 状态码映射统一维护于 `server/utils/errors.ts#getStatusCodeForErrorCode` 与 `server/constants/errorCodeCatalog.ts`。
- 中间件层错误输出必须包含 `error.statusCode`，避免上下游自行推断。

## 4. 前缀与版本（A09-A10）

- 根前缀统一：`API_PREFIX = /api`。
- 版本前缀统一：`API_VERSION_PREFIX = /api/v1`。
- 版本协商统一通过 `apiVersioningMiddleware`：
  - URL 前缀 > Header(`X-API-Version`) > Query(`api-version`) > 默认版本。
- 向后兼容重写统一通过 `backwardCompatRedirect` 处理。

## 5. 自动守卫

- 脚本：`npm run guard:api-contract`
- 作用：
  - 检查 `server/routes/**` 是否误写 `/api` 前缀。
  - 检查路径段是否符合 `kebab-case`。
  - 检查路由入口是否通过 `API_PREFIX` / `API_VERSION_PREFIX` 统一管理。

## 6. 例外路径

以下为运维探针/诊断保留的非版本化路径：

- `/api/health`
- `/api/ready`
- `/api/health/detailed`
- `/api/auth/oauth-status`
- `/api/test-mcstatus-direct`
- `/health`

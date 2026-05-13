# API 请求参数规范（B01-B10）

> 生效日期：2026-04-27  
> 实现位置：`server/middleware/requestValidation.ts` + `server/utils/validation.ts`

## 1. 统一入口（B01）

- 所有核心 API 路由通过 `validateBody / validateQuery / validateParams` 做参数校验。
- 校验失败统一抛出 `VALIDATION_ERROR`（HTTP 400）。

## 2. 统一错误细节（B02/B03/B04/B05/B06/B07）

- 校验失败详情统一结构：
  - `source`：`body | query | params`
  - `field`：字段路径
  - `message`：错误信息
  - `code`：Zod issue code

## 3. 参数标准化（B08/B09/B10）

- 默认标准化规则：
  - `trimStrings = true`：自动去首尾空白
  - `emptyStringAsUndefined = true`（body/query）：
    - 将空字符串标准化为 `undefined`
  - `nullAsUndefined = true`（query）：
    - 查询参数中的 `null` 统一按 `undefined` 处理
- 可通过中间件 options 覆盖默认行为。

## 4. 路由接入范围（第一批）

- `server/routes/auth.ts`
- `server/routes/adminSetup.ts`
- `server/routes/ai.ts`
- `server/routes/audit.ts`
- `server/routes/payment.ts`
- `server/routes/review.ts`
- `server/routes/tickets.ts`
- `server/routes/user.ts`
- `server/routes/userManagement.ts`
- `server/routes/preferences.ts`
- `server/routes/servers.ts`

## 5. 推荐实践

- 新增接口时优先在 route 层先校验，再进入 controller。
- 对分页/筛选/排序参数统一使用 `server/utils/validation.ts` 中的查询 schema。
- 对复杂参数保持 schema 单一来源，避免 route 与 controller 双份定义漂移。

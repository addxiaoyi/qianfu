# API 文档工作流

本项目以 OpenAPI 作为接口文档单一真相来源，并通过守卫脚本保证“文档与代码同步”。

## 1. 自动生成（D01）

文档生成命令：

```bash
npm run generate:openapi
```

产物：

- `docs/openapi.generated.json`

说明：

- 生成脚本会读取 `server/config/swagger.ts` + 路由中的 `@swagger` 注释。
- 生成时会自动标准化旧注释路径为 `/api/v1/*` 形态。

## 2. 同步守卫（D02）

同步校验命令：

```bash
npm run guard:openapi-sync
```

行为：

- 若 `docs/openapi.generated.json` 与当前代码注释生成结果不一致，则校验失败。
- 合并前校验 `npm run validate` 已接入该守卫。

## 3. 参数与响应字段完整性（D03/D04）

字段规范来源：

- OpenAPI 组件定义：`server/config/swagger.ts`
- 请求参数规范：`docs/API-REQUEST-VALIDATION-GUIDE.md`
- 响应规范：`docs/API-RESPONSE-DESIGN-GUIDE.md`
- 字段字典：`docs/API-FIELD-REFERENCE.md`

## 4. 示例请求与响应（D06/D07）

示例来源：

- OpenAPI `components.examples`
- 联调指南：`docs/API-INTEGRATION-GUIDE.md`

## 5. 版本与变更（D08/D09）

- 接口变更记录：`docs/API-CHANGELOG.md`
- 版本差异说明：`docs/API-VERSION-DIFF.md`

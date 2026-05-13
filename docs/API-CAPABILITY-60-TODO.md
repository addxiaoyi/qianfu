# 接口能力 60 Todo 看板

> 目标：将“接口能力 60 项”沉淀为可执行、可验收、可追踪清单。  
> 使用方式：完成一项后打勾，并在 PR 中附上对应测试/文档证据。

## 验收约定

- `Definition`：规范或约束已明确，团队有统一口径。
- `Implementation`：代码已落地并接入主链路。
- `Verification`：至少有单测/集成测试/烟雾脚本之一覆盖。
- `Docs`：OpenAPI 或项目文档可查，便于联调。

---

## 一、基础接口规范（10）

- [x] `A01` 统一 REST API 风格（已落地：`docs/API-REST-STYLE-GUIDE.md`）。
- [x] `A02` 统一资源命名规范（已落地：`guard:api-contract` 校验路径段命名）。
- [x] `A03` 统一 HTTP 方法使用（已落地：规范文档 + 合同守卫规则）。
- [x] `A04` 统一路径层级结构（已落地：路由入口统一前缀治理 + 路径规则约束）。
- [x] `A05` 统一返回数据格式（已落地：统一 success envelope 构造）。
- [x] `A06` 统一错误返回结构（已落地：统一 error envelope，含 `statusCode/requestId`）。
- [x] `A07` 统一成功返回结构（已落地：`message/data/requestId/timestamp/meta` 统一字段）。
- [x] `A08` 统一状态码映射（已落地：统一映射函数 + 错误输出补齐 `statusCode`）。
- [x] `A09` 统一接口前缀管理（已落地：`API_PREFIX`/`API_VERSION_PREFIX` 常量中心化）。
- [x] `A10` 统一接口版本管理（已落地：版本协商与兼容重写中间件统一管理）。

## 二、请求参数处理（10）

- [x] `B01` 请求参数基础校验（已落地：`validateBody/validateQuery/validateParams` 统一入口）。
- [x] `B02` 必填参数校验（已落地：缺失参数统一返回 `VALIDATION_ERROR`）。
- [x] `B03` 类型校验（已落地：Zod 统一类型校验 + 结构化错误细节）。
- [x] `B04` 长度校验（已落地：统一 schema 中长度约束生效）。
- [x] `B05` 格式校验（已落地：邮箱/URL/日期等格式规则统一在 schema 层）。
- [x] `B06` 枚举值校验（已落地：枚举字段统一由 schema 限定）。
- [x] `B07` 范围校验（已落地：数值与时间范围规则统一由 schema 控制）。
- [x] `B08` 默认值处理（已落地：schema default + 统一校验链路处理）。
- [x] `B09` 空值处理（已落地：空字符串/null 统一标准化策略）。
- [x] `B10` 参数转换与标准化（已落地：route 层统一 trim/空值归一化/查询参数规范化）。

## 三、响应设计（10）

- [x] `C01` 统一分页响应结构（已落地：`sendPaginated/sendListResponse` 统一 `meta(total/page/limit/totalPages)`）。
- [x] `C02` 统一列表响应结构（已落地：列表统一由 `sendListResponse` 输出并收口空列表语义）。
- [x] `C03` 统一详情响应结构（已落地：`sendDetailResponse` 在核心控制器接入）。
- [x] `C04` 统一创建响应结构（已落地：`sendCreatedResponse` 统一 `201 + Location` 语义）。
- [x] `C05` 统一更新响应结构（已落地：`sendUpdatedResponse` 统一更新成功结构与状态码）。
- [x] `C06` 统一删除响应结构（已落地：`sendDeletedResponse` 统一 `deleted + mode(soft|hard)`）。
- [x] `C07` 统一批量操作响应结构（已落地：`sendBatchResponse` 统一 `summary + results` 可追踪结构）。
- [x] `C08` 统一空数据响应结构（已落地：`sendListResponse/sendEmptyResponse` 统一空数据返回语义）。
- [x] `C09` 统一错误码说明（已落地：`server/constants/errorCodeCatalog.ts` + `docs/API-ERROR-CODE-CATALOG.md`）。
- [x] `C10` 统一业务提示文案（已落地：`server/constants/businessMessages.ts` 统一文案键与多语言模板）。

## 四、文档能力（10）

- [x] `D01` 接口文档自动生成（已落地：`npm run generate:openapi` 由 `swaggerSpec` 自动产出 `docs/openapi.generated.json`）。
- [x] `D02` 接口文档与代码同步（已落地：`guard:openapi-sync` 接入 `validate`，可检测文档漂移）。
- [x] `D03` 参数字段说明完整（已落地：`server/config/swagger.ts` 组件字段描述 + `docs/API-FIELD-REFERENCE.md`）。
- [x] `D04` 响应字段说明完整（已落地：统一成功/错误/分页包络 schema 与字段说明）。
- [x] `D05` 错误码文档完整（已落地：`docs/API-ERROR-CODE-CATALOG.md` + `server/constants/errorCodeCatalog.ts`）。
- [x] `D06` 示例请求完整（已落地：OpenAPI `components.examples` + `docs/API-INTEGRATION-GUIDE.md`）。
- [x] `D07` 示例响应完整（已落地：成功/校验失败示例在 OpenAPI 与联调指南双处可查）。
- [x] `D08` 接口变更记录完整（已落地：`docs/API-CHANGELOG.md`）。
- [x] `D09` 接口版本差异说明（已落地：`docs/API-VERSION-DIFF.md`）。
- [x] `D10` 接口联调说明完整（已落地：`docs/API-INTEGRATION-GUIDE.md` 覆盖鉴权/环境/限流/常见问题）。

## 五、分页与查询（10）

- [x] `E01` 分页参数支持（已落地：统一 `page/limit` 解析与默认值，接入 `buildPagination`）。
- [x] `E02` 排序参数支持（已落地：`sortBy/sortOrder(order)` 白名单控制 + 默认降级策略）。
- [x] `E03` 筛选参数支持（已落地：`status/category/platform/role/planId/userId/priority` 等筛选统一接入）。
- [x] `E04` 关键字搜索支持（已落地：`search/q` 统一入口 + 长度/模式安全校验）。
- [x] `E05` 多条件组合查询支持（已落地：结构化条件 `AND` + 关键词字段 `OR` 的统一组合规则）。
- [x] `E06` 模糊查询支持（已落地：`fuzzy=true|false` 可配置，支持模糊/精确匹配切换）。
- [x] `E07` 时间范围查询支持（已落地：`startDate/endDate` 统一解析，闭区间过滤语义一致）。
- [x] `E08` 状态过滤支持（已落地：状态字段枚举化并在文档中统一说明）。
- [x] `E09` 列表默认排序支持（已落地：各列表接口定义默认排序并统一兜底）。
- [x] `E10` 查询性能优化（已落地：公共列表缓存 + 关键查询复合索引增强，见 `prisma/schema.prisma`）。

## 六、接口健壮性（10）

- [x] `F01` 重复请求处理（已落地：`createDuplicateRequestGuard` + 关键写接口接入）。
- [x] `F02` 幂等接口设计（已落地：支付创建内置幂等 + 通用 `createIdempotencyMiddleware` 回放能力）。
- [x] `F03` 超时处理（已落地：`createRequestTimeoutMiddleware` 全局 API 接入 + 上游 `AbortController`）。
- [x] `F04` 异常捕获统一化（已落地：统一错误中间件 + 进程级 `unhandledRejection/uncaughtException` 收口）。
- [x] `F05` 错误日志记录（已落地：结构化日志与审计日志包含 `requestId`/上下文）。
- [x] `F06` 参数缺失降级处理（已落地：`validateRequest` 归一化 + schema 默认值降级策略）。
- [x] `F07` 非法请求拦截（已落地：WAF/AntiCrawler 拦截并统一错误包络输出）。
- [x] `F08` 请求频率限制（已落地：全局+路由+身份分级限流，支持 Redis/内存降级）。
- [x] `F09` 接口兼容性处理（已落地：`apiVersioning/backwardCompatRedirect` 版本兼容重写）。
- [x] `F10` 接口测试用例覆盖（已落地：新增健壮性中间件单测 + 既有请求校验测试覆盖基线）。

---

## 建议推进节奏

- 第 1 周：`A01-A10` + `B01-B10`（先统一规范和参数入口）。
- 第 2 周：`C01-C10` + `E01-E10`（统一响应与查询体验）。
- 第 3 周：`D01-D10` + `F01-F10`（文档闭环与健壮性收口）。

## 推荐验收命令

- 快速校验：`npm run lint`、`npm run test:run`
- 合并前：`npm run validate`
- 发布前：`npm run release:preflight`
- API 文档：`npm run generate:openapi`

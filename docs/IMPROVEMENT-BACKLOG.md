# 千服项目改进 Backlog

> 生成时间：2026-04-19  
> 当前基线：TypeScript 0 errors · ESLint 0 errors/0 warnings · Build ✅ · 覆盖率 85.94%  
> 优先级：🔴 必须修复 | 🟡 建议改进 | 💭 可选优化

---

## 🔴 HIGH — 阻塞级问题

### H-01：`syncService.ts` 重复变量声明（已修复）

**文件**：`server/services/syncService.ts`  
**状态**：已修复。`cmsClient` 的重复声明已删除，保留了带空值守卫的条件初始化。后续所有 CMS 调用继续通过 `cmsClient` 判空保护。

---

### H-02：`wallet.ts` 签名使用 `toFixed(2)` 而存储是整数分（已修复）

**文件**：`server/lib/wallet.ts`  
**状态**：已修复。签名中的金额现在使用原始整数分字符串，避免 `700.00` / `7.00` 这类格式不一致导致的完整性校验问题。

---

### H-03：`paymentController.ts` 使用 MD5 签名验签（已缓解）

**文件**：`server/controllers/paymentController.ts`  
**状态**：已缓解。MD5 仍受第三方网关协议约束，但现已补充代码注释说明，并在验签前增加 `dt` 时效性检查（5 分钟窗口），降低重放风险。

---

## 🟡 MEDIUM — 建议改进

### M-01：`auditController.ts` 权限检查重复（应使用 `requirePermission` 中间件）

**文件**：`server/controllers/auditController.ts:20-24`  
**问题**：手动解析 permissions JSON 字符串并比对权限，与 `server/middleware/auth.ts` 中的 `requirePermission` 中间件功能重复，且容易遗漏。类似模式在 `reviewController.ts`、`permissionGroupController.ts` 多处可见。

```ts
// 当前（不统一）
const userPermissions = req.user.permissions ? JSON.parse(req.user.permissions) : [];
const hasPermission = userPermissions.includes('admin') || ...;

// 建议（使用已有中间件）
router.get('/', requirePermission('admin'), getAuditLogs);
```

**影响文件**：`auditController.ts`, `reviewController.ts`, `permissionGroupController.ts`

---

### M-02：`aiController.ts` 使用 `req: any`（已修复）

**文件**：`server/controllers/aiController.ts`  
**状态**：已修复。`getLanguage` 与 `chat` 入口都已改为使用 `Request` 类型，避免类型污染。

---

### M-03：`paymentHandler.ts` 权限硬编码（已修复）

**文件**：`server/services/paymentHandler.ts`  
**状态**：已修复。付款成功后的权限升级现在会合并已有权限，并在更新后清除用户缓存，避免覆盖用户原有能力。

---

### M-04：`response.ts` 中使用 `console.warn` 而非 logger（已修复）

**文件**：`server/utils/response.ts`  
**状态**：已修复。用户偏好与权限解析失败时现在统一走结构化 logger，便于生产环境收集和聚合。

---

### M-05：`syncService.ts` 双重 `cmsClient` 声明造成 TS 编译器隐患

（见 H-01，此处同一个问题同时影响运行时和编译时）

---

### M-06：Prisma schema 中 JSON 字段使用 `String` 类型（迁移中）

**文件**：`prisma/schema.prisma`、`server/utils/jsonField.ts`、`server/controllers/userController.ts`、`server/services/userLevelService.ts`、`scripts/migrate-json-fields.ts`  
**状态**：已抽出统一 JSON 读写辅助层，完成了 JSON 字段迁移脚本，并开始收敛 `permissions` / `preferences` 的字符串 JSON 处理逻辑。

**受影响字段**：

| 模型 | 字段 | 当前类型 | 建议 |
|------|------|----------|------|
| User | `permissions` | `String @default("[]")` | 使用 Json 或专用表 |
| User | `preferences` | `String? @default("{}")` | 使用 Json |
| Server | `tags` | `String? @default("[]")` | 使用 Json |
| Server | `supported_versions` | `String?` | 使用 Json |
| Server | `network_env` | `String?` | 使用 Json |
| Transaction | `metadata` | `String?` | 使用 Json |

**问题**：业务层需手动 `JSON.parse/stringify`，容易出错，且无法利用数据库级别的 JSON 查询。  
**注意**：迁移需要 Prisma migration + 数据转换，涉及数据库变更，风险中等。

---

### M-07：`ReviewController.ts` 存在 N+1 查询

**文件**：`server/controllers/reviewController.ts:45-73`  
**问题**：先查 `pendingServers`，再批量查 owners，但用 `findMany` + `in: ownerIds` 的方式已经是 1+1=2 次查询，可通过 Prisma `include` 减到 1 次：

```ts
// 建议
const pendingServers = await localPrisma.server.findMany({
  where: { review_status: 'PENDING' },
  include: {
    owner: { select: { id: true, username: true, email: true, role: true } }
  }
});
```

---

### M-08：`notificationQueue.ts` ID 生成使用 `Math.random()`（已修复）

**文件**：`server/services/notificationQueue.ts`  
**状态**：已修复。任务 ID 现在使用 `crypto.randomUUID()`，减少高并发碰撞风险。

---

### M-09：`aiController.ts` Jailbreak 检测仅覆盖英文（已修复）

**文件**：`server/controllers/aiController.ts`  
**状态**：已修复。中文 jailbreak 关键词已补充，覆盖常见“忽略上面的指令 / 忘记之前的规则”类表达。

---

### M-10：`moderationService.ts` 对 AI 审核结果直接信任（已修复）

**文件**：`server/services/moderationService.ts`  
**状态**：已修复。已为 AI 审核响应增加 Zod schema 校验，格式异常时会进入安全降级路径。

---

### M-11：`nginx.conf` CSP 包含 `unsafe-eval`（安全降级）

**文件**：`nginx.conf:41`  
**问题**：`script-src 'self' 'unsafe-inline' 'unsafe-eval'` 中 `unsafe-eval` 允许 `eval()` 执行，显著降低 XSS 防护级别。

**修复方向**：  
- 通过 Vite 构建配置消除对 `eval` 的依赖  
- 若某依赖必须使用 eval，用 nonce 或 hash 替代通配符  

---

### M-12：`serverStatusHistoryService.ts` 缺少数据保留策略（已修复）

**文件**：`server/services/cleanupService.ts`  
**状态**：已修复。清理调度现已定期删除 7 天前的 `ServerStatusHistory` 记录，避免无限增长。

---

### M-13：`components/ui` 目录扁平化（已完成）

**目录**：`src/components/ui/`  
**状态**：核心组件已按职责迁移到 `layout/`、`feedback/`、`media/`、`game/`，并在应用入口中实际使用。

**建议**：按职责拆分：

```
src/components/
├── ui/         # 基础原子组件 (Button, Input, Card...)
├── layout/     # 布局组件 (PageTransition, SkipToContent...)
├── feedback/   # 用户反馈 (Toast, GlitchError, NoSignal...)
├── media/      # 媒体相关 (OptimizedImage...)
└── game/       # 游戏主题 (MinecraftSwitch, RetroSkeleton...)
```

**注意**：涉及大量文件移动和 import 路径更新，建议配合 IDE 批量重构。

---

### M-14：`server-service` 和 `user-service` 中 `_getUserFromUserService` 被前缀标记为未使用

**文件**：`services/server-service/src/services/serverService.ts`  
**问题**：已用 `_` 前缀绕过 ESLint，但实际上该函数有业务价值，应要么实现并使用，要么删除。

---

## 💭 LOW — 可选优化

### L-01：前端 `api-client.ts` 和 `useApiQueries.ts` 中 `any` 类型使用（已修复一部分）

**文件**：`src/lib/api-client.ts`、`src/hooks/useApiQueries.ts`  
**状态**：已修复主要 `any` 类型和部分参数类型断言，仍可继续逐步收紧上层接口。

---

### L-02：`PermissionHistory` 表缺少复合索引（已修复一部分）

**文件**：`prisma/schema.prisma`  
**状态**：已补充 `user_id`、`admin_id`、`created_at` 索引，后续可根据真实查询模式再评估是否需要复合索引。

---

### L-03：`Ticket.payment_id` 关联字段类型不一致（已补充索引）

**文件**：`prisma/schema.prisma`  
**状态**：已为 `payment_id` 补充索引，减少按支付单号回查工单时的全表扫描风险。

---

### L-04：CI/CD Pipeline 缺失（已修复）

**文件**：`.github/workflows/ci.yml`  
**状态**：已补齐 CI 流程，包含 typecheck、lint、Prisma 校验、本地 API smoke、构建和全量覆盖率汇总。

---

### L-05：`server/config/env.ts` 中 `console.error` 未使用 logger（保留）

**文件**：`server/config/env.ts`  
**状态**：该位置发生在 logger 初始化之前，保留标准错误输出是合理的。

---

### L-06：`base.ts` Repository 基类 `Prisma_INCLUDE` / `Prisma_SELECT` 类型定义不准确（已修复）

**文件**：`server/core/repository/base.ts`  
**状态**：已修复。实际代码中 `Prisma_INCLUDE` / `Prisma_SELECT` 类型 hack 已被移除，Repository 基类重构为使用 `Record<string, unknown>` 的 `include`/`select` 类型，不再依赖 Prisma 内部类型。

---

### L-07：测试覆盖率仍有提升空间（当前 85.94%）

**建议新增测试**：`server/lib/wallet.ts`、`server/middleware/auth.ts`、`server/services/notificationQueue.ts`、`server/controllers/paymentController.ts`、`server/services/moderationService.ts` 等核心路径。

---

### L-08：`nginx.conf` 缺少速率限制配置（已修复）

**文件**：`nginx.conf`  
**状态**：已补充 `limit_req_zone` / `limit_req`，入口层可以先行限流。

**建议**：

```nginx
http {
  limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
  
  location /api {
    limit_req zone=api burst=20 nodelay;
    ...
  }
}
```

---

### L-09：`authController.ts` 密码修改后未清除用户缓存（已修复）

**文件**：`server/controllers/authController.ts`  
**状态**：已修复。修改密码后会主动清除用户缓存，避免 TTL 窗口内继续使用旧的用户信息。

---

### L-10：`cleanupService.ts` 缺少 `ServerStatusHistory` 清理（已修复）

**状态**：已在清理调度中加入 `ServerStatusHistory` 保留策略。

---

## 📊 已完成改进项（已追踪，本轮更新）

| ID | 描述 | 完成时间 |
|----|------|----------|
| ✅ C-01 | SQL 注入修复（auditController） | 2026-04-18 |
| ✅ C-02 | 硬编码支付密钥移除 | 2026-04-18 |
| ✅ C-03 | AI XSS 修复（dangerouslySetInnerHTML） | 2026-04-18 |
| ✅ C-04 | CSRF bypass 修复 | 2026-04-18 |
| ✅ C-05 | WAF 默认关闭修复 | 2026-04-18 |
| ✅ C-06 | 认证逻辑缺陷修复 | 2026-04-18 |
| ✅ C-07 | permissions JSON.parse 崩溃修复 | 2026-04-18 |
| ✅ C-08 | Nginx 安全头添加 | 2026-04-18 |
| ✅ C-09 | API 版本化 (M-15) | 2026-04-18 |
| ✅ C-10 | errorHandler any 类型清理 (M-14) | 2026-04-18 |
| ✅ C-11 | ESLint 0 warnings (L-01) | 2026-04-18 |
| ✅ C-12 | Node 版本锁定 .nvmrc (L-10) | 2026-04-18 |
| ✅ C-13 | 用户缓存失效策略 (M-06) | 2026-04-18 |
| ✅ C-14 | React Query 全局配置 (M-07) | 2026-04-18 |
| ✅ C-15 | 测试覆盖率提升至 85.94% (L-06) | 2026-04-18 |
| ✅ H-01 | `syncService.ts` 重复 `cmsClient` 声明 | 2026-04-19 |
| ✅ H-02 | `wallet.ts` 金额签名精度不一致 | 2026-04-19 |
| ✅ H-03 | `paymentController.ts` MD5 回调验签加时效检查 | 2026-04-19 |
| ✅ M-02 | `aiController.ts` 去除 `req: any` | 2026-04-19 |
| ✅ M-04 | `response.ts` 结构化日志替换 `console.warn` | 2026-04-19 |
| ✅ M-08 | `notificationQueue.ts` 改用 `randomUUID()` | 2026-04-19 |
| ✅ M-09 | `aiController.ts` 扩展中文 jailbreak 关键词 | 2026-04-19 |
| ✅ M-10 | `moderationService.ts` 增加 schema 校验 | 2026-04-19 |
| ✅ L-09 | `authController.ts` 修改密码后清除用户缓存 | 2026-04-19 |

---

## 🏗️ 架构级改进（长期目标）

### A-01：将 `server/` 迁移到 packages/shared 统一错误/日志

**现状**：`server/utils/errors.ts` 和 `packages/shared/src/errors/` 存在重复定义，微服务也各自维护一套 logger。  
**目标**：统一使用 `@qianfu/shared` 的 errors 和 logger，消除重复。

---

### A-02：将支付角色升级逻辑迁移到规则引擎（已部分完成）

**文件**：`server/services/paymentHandler.ts`  
**状态**：支付角色权限现在支持从 `SystemConfig` 读取配置，并经过 Zod 校验；未配置或配置损坏时回落到默认权限集合。后续可补管理端界面进行编辑。

---

### A-03：引入 OpenAPI 类型生成（前后端类型同步）

**状态**：已完成核心交付。Zod → OpenAPI 生成脚本、`openapi-typescript` 类型生成命令、统一消费入口、前端可观测摘要和生成类型文件均已接入。  
**目标**：从 Zod schema 自动生成 OpenAPI spec，再通过 `openapi-typescript` 生成前端类型，实现单一真相来源。

---

*文档由代码审查 Agent 自动生成，建议每次 Sprint 结束时更新优先级。*

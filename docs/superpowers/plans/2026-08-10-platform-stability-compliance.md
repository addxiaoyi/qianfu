# 平台稳定性与合规体验完善实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复服务器标签导致的前端崩溃，收敛支付入口，调整签到奖励，并移除论坛功能入口，同时补齐产品侧的内容治理与个人备案合规提示。

**Architecture:** 先在共享解析/策略层保证异常数据不会传播到 UI，再在路由与导航层收敛公开能力。支付只保留一个已配置且可验证的主通道，签到奖励通过后端策略计算并由唯一约束保证每日一次；合规相关内容采用静态政策页面、发布前确认和管理员审核，不在客户端伪造备案状态。

**Tech Stack:** React 19 + TypeScript + Vite；Express 5 + Prisma；Vitest；Tailwind CSS。

---

### Task 1: 标签与 AI 标注数据稳定性

**Files:**
- Modify: `qianfu-liandeng/src/utils/serverView.ts`
- Modify: `qianfu-liandeng/src/components/ServerCard.tsx`
- Modify: `server/controllers/servers/list.ts`
- Test: `tests/unit/server-list-tags-resilience.test.ts`

- [ ] 写测试覆盖 `tags` 为数组、JSON 字符串、逗号字符串、对象和空值时统一得到字符串数组。
- [ ] 先运行测试确认对象/异常 JSON 场景失败。
- [ ] 让后端列表序列化和前端展示都经过同一套安全解析，AI 标注异常时显示“待审核”而不是把对象传给 `.slice().map()`。
- [ ] 运行该测试与服务器列表相关测试。

### Task 2: 支付主通道收敛与降级

**Files:**
- Modify: `server/services/paymentProviderSelection.ts`
- Modify: `server/controllers/paymentController.ts`
- Modify: `server/routes/payment.ts`
- Modify: `qianfu-liandeng/src/pages/Payment.tsx`
- Test: `tests/unit/payment-primary-provider-contract.test.ts`

- [ ] 写测试要求未配置、停用或不健康的通道不能被静默切换为 qiupay，并要求接口返回明确的通道未就绪状态。
- [ ] 先运行测试确认当前选择逻辑会错误回退。
- [ ] 只暴露一个主支付通道配置，隐藏重复的旧配置字段；二维码/跳转地址缺失时返回可诊断错误，不生成空轮询页。
- [ ] 验证支付金额仍限制在 0.1–10000 元，并保留回调签名校验与幂等处理。
- [ ] 运行支付单测、构建和支付接口冒烟。

### Task 3: 签到奖励调整与闭环

**Files:**
- Modify: `server/services/checkinRewardPolicy.ts`
- Modify: `server/services/checkinRewardSettlementService.ts`
- Modify: `qianfu-liandeng/src/pages/Dashboard.tsx`
- Test: `tests/unit/checkin-reward-policy.test.ts`
- Test: `tests/unit/checkin-reward-settlement.test.ts`

- [ ] 写测试明确新的低额奖励、连续签到上限、每日一次和重复请求幂等规则。
- [ ] 先运行测试确认旧奖励值或重复结算场景失败。
- [ ] 用后端策略统一计算奖励；钱包入账、经验值和签到历史在同一事务内完成，重复请求只返回原记录。
- [ ] 前端展示真实到账金额和下一次可签到时间，不用固定文案冒充余额增加。
- [ ] 运行签到相关测试和 dashboard 合约测试。

### Task 4: 去除论坛能力入口并加强内容治理

**Files:**
- Modify: `qianfu-liandeng/src/app/routes.tsx`
- Modify: `qianfu-liandeng/src/components/layout/*`
- Modify: `server/routes/index.ts`
- Modify: `server/bootstrap/security.ts`
- Test: `tests/unit/no-forum-entry-contract.test.ts`

- [ ] 写测试确认导航、页脚和路由表不再暴露论坛入口；已有旧链接返回 404/不可用提示。
- [ ] 先运行测试确认现有入口仍存在。
- [ ] 移除论坛导航、页面和 API 注册；保留服务器评论/举报等必要的审核能力，并加上频率限制、长度限制和敏感内容拦截。
- [ ] 运行路由完整性、审核和安全测试。

### Task 5: 个人备案合规产品边界

**Files:**
- Modify: `qianfu-liandeng/src/pages/Rules.tsx`
- Modify: `qianfu-liandeng/src/pages/ServerEditor.tsx`
- Modify: `server/controllers/servers/crud.ts`
- Modify: `server/services/moderationService.ts`
- Test: `tests/unit/compliance-policy-pages-contract.test.ts`
- Test: `tests/unit/server-publish-compliance.test.ts`

- [ ] 写测试确认政策页包含主体信息、隐私/未成年人/侵权举报/内容审核/备案说明，发布接口要求同意平台规则并拒绝明显违规内容。
- [ ] 先运行测试确认缺失确认字段或违规内容仍能发布。
- [ ] 增加发布前合规确认、版权/隐私提示、举报入口和审核状态文案；不展示虚假的 ICP/备案号。
- [ ] 运行合规和发布闭环测试，并记录需要在备案管理部门/支付服务商后台完成的人工事项。

### Task 6: 构建、冒烟与可恢复部署

**Files:**
- Modify only generated release files when the repository's build scripts require it.
- Verify: `qianfu-liandeng/dist/`, production manifest and API health.

- [ ] 运行前端构建、类型检查、关键单测和路由审计。
- [ ] 检查产物不再包含 `tags.slice` 直用路径。
- [ ] 使用原子、可回滚的前端发布脚本部署到生产机；部署前记录当前 release 软链接，部署后回读新 manifest。
- [ ] 验证 `/servers`、`/payment`、`/dashboard`、`/rules` 和旧论坛路径。

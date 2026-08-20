# Platform Feedback Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收敛资料与资源页的杂讯表达，降低支付入口的重复曝光，提高签到奖励，并补一层低成本前端外链防线。

**Architecture:** 这次只动 4 个已有页面和 1 个签到策略服务，不扩张到支付通道、鉴权体系或部署脚本。先用静态契约测试锁住用户反馈，再做最小实现，并用定向测试、typecheck、build 兜底。

**Tech Stack:** React, TypeScript, Vitest, Tailwind, Node.js backend service helpers

---

### Task 1: 锁定页面反馈契约

**Files:**
- Modify: `tests/unit/account-pages-ux-contract.test.ts`
- Modify: `tests/unit/frontend-content-resilience-contract.test.ts`
- Modify: `tests/unit/checkin-reward-increase.test.ts`

- [ ] 为资料页、标签页、账单页、资源页写出当前反馈对应的失败断言
- [ ] 跑定向测试，确认它们先红

### Task 2: 收敛页面表达并降低支付曝光

**Files:**
- Modify: `qianfu-liandeng/src/pages/Profile.tsx`
- Modify: `qianfu-liandeng/src/pages/ProfileTags.tsx`
- Modify: `qianfu-liandeng/src/pages/Billing.tsx`
- Modify: `qianfu-liandeng/src/pages/ResourceCenter.tsx`
- Modify: `qianfu-liandeng/src/store/uiStore.ts`

- [ ] 资料页快捷入口改成账单与支持，不再直达支付
- [ ] 账单页去掉重复“支付中心”按钮，改成账务支持入口
- [ ] 标签页头部和 Tab 样式降噪，移除过重的 matrix/italic/巨型标题
- [ ] 资源页移除 AI 外显标注，改成普通说明块

### Task 3: 提高签到奖励并补一层外链防线

**Files:**
- Modify: `server/services/checkinRewardPolicy.ts`
- Modify: `qianfu-liandeng/src/pages/ResourceCenter.tsx`

- [ ] 将日常签到奖励提高到温和上调区间
- [ ] 将七日连签奖励同步提高
- [ ] 资源页外链统一走 `sanitizeUrl` 兜底，避免未来脏数据直接落进 `href`

### Task 4: 回归验证

**Files:**
- Test: `tests/unit/account-pages-ux-contract.test.ts`
- Test: `tests/unit/frontend-content-resilience-contract.test.ts`
- Test: `tests/unit/checkin-reward-increase.test.ts`
- Test: `tests/unit/checkin-reward-policy.test.ts`

- [ ] 跑定向测试直到全绿
- [ ] 跑 `npm run typecheck`
- [ ] 跑 `npm --prefix qianfu-liandeng run build`

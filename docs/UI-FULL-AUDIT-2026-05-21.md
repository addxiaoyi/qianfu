# 全页面与移动端可用性验收（2026-05-21）

## 目标
- 覆盖桌面公开页、登录后用户页、管理员页、移动端登录后页。
- 重点验证你反馈的问题：移动端输入框点击不触发页面刷新、工单页可见且可用。
- 同时做基础视觉审查：页面可读、布局完整、无明显白屏/异常栈文本。

## 环境
- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`
- 时间：2026-05-21

## 本次修复

### 1) 修复全量验收脚本登录态误判
- 文件：`scripts/ui-full-audit.cjs`
- 关键调整：
  - 登录态改为基于 `localStorage.qf_local_auth_token` + 页面内 `fetch('/api/v1/profile')` 鉴权验证。
  - 受保护路由若回跳 `#/login` 判定失败。
  - 补齐受保护路由集合（含推广任务页）。

### 2) 新增移动端交互验收脚本（真实输入操作）
- 文件：`scripts/ui-mobile-interaction-audit.cjs`
- 覆盖操作：
  - `/tickets/new`：点击并输入标题/描述；
  - `/me/edit`：点击并输入用户名/邮箱；
  - `/messages`：点击并输入搜索框；
  - `/editor`：点击并输入服务器名称/版本/IP；
  - 每一步都校验：
    - URL 前后不变；
    - 未回到 `#/login`；
    - token 仍存活。

### 3) 移动端底部导航遮挡可用性修复
- 问题：移动端“新建工单”等页底部主按钮被底部导航挤压遮挡。
- 修复文件：
  - `qianfu-liandeng/src/components/mobile/MobileBottomNav.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileLayout.tsx`
  - 修复内容：
  - 移除 `MobileBottomNav` 自身 `fixed`，统一由 `MobileLayout` 负责固定容器；
  - 增加内容区底部安全留白（`pb-56`）；
  - 保留底部渐变过渡，减少遮挡体感。

## 验收结果

### A. 全页面巡检
- 命令：`node scripts/ui-full-audit.cjs`
- 报告：`output/ui-audit-2026-05-21/report.json`
- 结果：
  - `total=47`
  - `failed=0`

### B. 移动端输入稳定性巡检
- 命令：`node scripts/ui-mobile-interaction-audit.cjs`
- 报告：`output/ui-audit-2026-05-21/mobile-interaction-report.json`
- 结果：
  - `total=4`
  - `failed=0`
  - 四个输入场景均保持当前路由，不回跳登录，token 存活。

### C. 构建验证
- 命令：`npm run build`（`qianfu-liandeng`）
- 结果：通过。

## 证据路径（截图）
- 全量截图目录：
  - `output/ui-audit-2026-05-21/shots/desktop/...`
  - `output/ui-audit-2026-05-21/shots/mobile/...`
- 关键截图示例：
  - `output/ui-audit-2026-05-21/shots/mobile/interaction/tickets-new-input.png`
  - `output/ui-audit-2026-05-21/shots/mobile/interaction/profile-edit-input.png`
  - `output/ui-audit-2026-05-21/shots/mobile/interaction/messages-search-input.png`
  - `output/ui-audit-2026-05-21/shots/mobile/interaction/editor-input.png`

## 当前结论
- 你指出的移动端输入触发刷新、工单页面显示问题，在本地当前构建下已复现验证为已修复。
- 桌面与移动端本轮覆盖页面均可正常打开、登录后页面可访问、无回跳登录误报。
- 仍建议在真实手机（iOS Safari / Android Chrome）各做一次手动点击回归，以覆盖软键盘与系统浏览器差异。

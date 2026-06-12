# 移动端输入触发刷新与工单页面空白修复记录（2026-05-21）

## 问题描述
- 手机端在“发服/工单/消息”等页面点击输入框时，容易触发页面刷新或页面状态被重置。
- 部分入口（尤其是个人中心里的服务菜单）在手机端会跳到桌面路由，导致页面空白或内容不显示（例如工单相关入口、账单入口、资料编辑入口）。

## 根因结论
1. `App.tsx` 使用 `window.innerWidth` 驱动 `isMobile` 并直接在运行时切换整套路由树（mobileRoutes/desktopRoutes）。手机软键盘弹出时 viewport 变化会触发该判定重算，导致输入框 focus 后页面树重建，表现为“点输入像刷新、页面跳回或空白”。
2. 移动端存在若干入口指向桌面路由（如 `/dashboard/servers`、`/dashboard/billing`、`/dashboard/profile`），若没有移动端兜底重定向会出现页面错跳或内容不显示。
3. 多个页面/组件里存在未声明 `type` 的 `<button>`，在表单上下文中默认会按 `submit` 行为处理，可能放大重载/跳转体感。

## 本次修复

### 1) 移动容器刷新逻辑收敛
- 文件：`qianfu-liandeng/src/components/mobile/MobileLayout.tsx`
- 调整：
  - 仅当 `onRefresh` 存在时才启用下拉刷新手势与指示器。
  - `touch start` 顶部判定改为容器 `scrollTop`，避免使用全局 `window.scrollY` 误判。
  - 对输入类元素（`input/textarea/select/contenteditable`）触摸起点直接忽略刷新链路。

### 2) 移动路由补齐与兜底
- 文件：`qianfu-liandeng/src/App.tsx`
- 调整：
  - 将移动/桌面壳体判定改为“首屏锁定”：
    - 通过 `matchMedia('(max-width: 767.98px)') + touch` 仅在首次加载决定 `isMobileShell`
    - 后续键盘弹起导致的 `resize` 不再切换整套路由树
  - 新增移动可达页：`/me/edit`（挂载 `ProfileEdit`）。
  - 新增移动端重定向：
    - `/dashboard/servers -> /servers`
    - `/dashboard/tickets -> /tickets`
    - `/dashboard/tickets/new -> /tickets/new`
    - `/dashboard/tickets/:id -> /tickets`
    - `/dashboard/billing -> /payment`
    - `/dashboard/profile -> /me`
  - 新增移动端 `*` 路由兜底到 `/mobile`。

### 3) 表单按钮显式声明非提交类型
- 关键文件：
  - `qianfu-liandeng/src/components/MatrixDialog.tsx`
  - `qianfu-liandeng/src/components/RichTextEditor.tsx`
  - `qianfu-liandeng/src/pages/ServerEditor.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileAdminDashboard.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileMessages.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileNotifications.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileSearch.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileSettings.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileTicketCreate.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileTicketDetail.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileTicketList.tsx`
  - `qianfu-liandeng/src/components/mobile/MobileUserCenter.tsx`
- 调整：为交互按钮补充 `type="button"`（保留真正提交按钮 `type="submit"` 不变）。

### 4) 移动端通用 Hook 去除整页 reload
- 文件：`qianfu-liandeng/src/hooks/useMobile.ts`
- 调整：
  - `refresh()` 从 `window.location.reload()` 改为可注入 `onRefresh` 回调执行。
  - 未传入 `onRefresh` 时不做任何全页刷新动作。
  - 保留 `refreshing` 状态用于页面内数据刷新指示。
- 目的：阻断后续页面误用该 hook 时再次引入“点击输入触发整页刷新”的回归风险。

### 5) 本地预览兼容性补丁
- 文件：`qianfu-liandeng/vite.config.ts`
- 调整：在 Windows 本地开发环境关闭 HMR，避免 `vite-react-refresh-wrapper` / Rolldown 组合在该工作区出现 `moduleType` 500，导致页面空白。

### 6) 手机浮动设置按钮下移
- 文件：`qianfu-liandeng/src/components/GlobalSettingsPanel.tsx`
- 调整：移动端浮窗从 `bottom-28` 再上移到 `bottom-40`，避免遮挡工单/编辑页底部主按钮。

## 验证结果
- 已执行：`npm run build`
- 结果：前端 TypeScript 与 Vite 构建均通过。
- 本地手机视口实测：`/#/login`、`/#/tickets/new`、`/#/editor` 输入和提交均未触发整页刷新。

## 2026-05-22 续修（输入触发刷新二次加固）

### 1) 启动 URL 规范化改为“无刷新替换”
- 文件：`qianfu-liandeng/src/main.tsx`
- 调整：
  - 将 `window.location.replace(...)` 改为 `window.history.replaceState(...)`。
  - 新增 `replaceUrlWithoutReload()`，仅在 URL 变化时替换地址栏，不触发文档级重载。
- 目的：
  - 避免 `/#/xxx -> /xxx` 规范化时出现整页导航，降低“填表过程中像刷新”体感。

### 2) 移动壳体判定去除 touch 依赖
- 文件：`qianfu-liandeng/src/App.tsx`
- 调整：
  - `detectInitialMobileShell()` 从“窄屏 + touch”改为：
    - `pathname/hash/search` 显式标记移动路由优先；
    - 否则按窄屏（`max-width: 767.98px`）判定。
- 目的：
  - 解决内嵌浏览器/模拟器里 `touch` 能力上报异常导致误判桌面壳的问题。
  - 保障 `/#/mobile` 等移动入口在窄屏环境稳定落入移动路由，不再错跳桌面页面。

### 3) 本轮验证
- `npm run build`（`qianfu-liandeng`）：通过。
- `node scripts/ui-mobile-public-input-check.cjs`（`QA_BASE_URL=http://127.0.0.1:4177`）：`failed=0`。
- 补充无登录输入稳定性检查（Playwright 内联脚本）：
  - 覆盖 `/#/login`、`/#/register`、`/#/forgot-password`、`/#/mobile`；
  - 填写输入并触发 Enter 后 URL 保持不变；
  - 结果：`failed=0`。

## 回归建议（移动端优先）
1. 登录后从“我的”进入“我的服务”各入口，确认不再空白。
2. 在发布页输入框、标签输入、富文本工具栏、弹窗输入中连续点击与输入，确认不再触发整页刷新。
3. 在工单列表/详情/新建页输入与切换筛选，确认页面状态稳定。
4. 在 iOS Safari 与 Android Chrome 各做一次上述流程回归。

## 2026-05-22 线上实装补记（生产域名 `https://mc-u.top`）

### 1) 用户反馈复核结论
- 反馈“移动端输入后仍会刷新”和“编辑页底部按钮被浮动按钮遮挡”属实。
- 线上当时仍在旧入口包：
  - `assets/index-MbbnOz8z.js`
- 旧包中 `GlobalSettingsPanel` 仍为固定 `bottom-8` 样式，未包含“移动端隐藏 + 下移”修复。

### 2) 线上 QA 账号（按“你自己创一个”执行）
- 在生产 MySQL 直接创建并验证通过：
  - `identifier`: `qa_mobile_20260522`
  - `email`: `qa.mobile.20260522@local.test`
  - `email_verified`: `true`
  - `role`: `NORMAL`
- 登录接口核验：
  - `POST https://mc-u.top/api/v1/auth/login` 返回 `success: true`。

### 3) 发布执行
- 本地构建：
  - `npm --prefix qianfu-liandeng run build`
- 新入口产物：
  - `assets/index-BNAdFnFp.js`
  - `assets/index-Cx7ddkUv.css`
- 发布方式：
  - 打包本地 `qianfu-liandeng/dist`
  - 上传 `/tmp/qianfu-mobile-refresh-fix-20260522-124905.tar.gz`
  - 远端替换 `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
  - `nginx -t` 与 `nginx -s reload` 均成功
- 发布后首页哈希确认：
  - `https://mc-u.top/` 引用 `assets/index-BNAdFnFp.js`

### 4) 线上验证结果
- `node scripts/ui-mobile-public-input-check.cjs`（`QA_BASE_URL=https://mc-u.top`）：`failed=0`
- `node scripts/ui-mobile-interaction-audit.cjs`（生产 QA 账号）：`failed=0`
- `node scripts/ui-full-audit.cjs`（生产 QA 账号）：`total=35, failed=0`
- 生产健康：
  - `https://mc-u.top/api/health` 返回 `healthy`
  - `https://mc-u.top/api/ready` 返回 `ready`

### 5) 当前状态
- 生产已切换到包含移动端刷新修复和浮动按钮遮挡修复的新包。
- 若个别终端仍异常，优先排查微信/内嵌浏览器缓存与页面恢复机制（前端入口已启用 `Cache-Control: no-store`）。

## 2026-05-22 控制台报错修复补记（OAuth + CSP + Manifest）

### 1) 用户反馈错误
- `oauth/callback/github?error=oauth_callback_failed&message=The+operation+was+aborted+due+to+timeout`
- `Loading the stylesheet https://fonts.googleapis.com/... violates CSP style-src 'self' 'unsafe-inline'`
- `Error while trying to use icon-144x144.png (Download error or resource isn't a valid image)`

### 2) 根因
1. 前端 `src/index.css` 仍有 `@import https://fonts.googleapis.com/...`，而线上 CSP 已限制 `style-src 'self'`，因此浏览器必然拦截。
2. GitHub OAuth 交换 token 与拉取 profile 仅单次请求，网络抖动时容易超时直接失败。
3. `manifest.json` 声明了多个 PNG 图标与 shortcut 图标，但线上历史包缺少对应文件，导致浏览器读取 manifest 资源报错。

### 3) 修复
1. 移除前端 Google Fonts 远程 `@import`，改为本地系统字体栈（无需放宽 CSP）。
2. GitHub OAuth 后端增强：
   - 在 `server/controllers/githubAuthController.ts` 增加 `fetchWithRetry`（超时+重试）
   - token exchange / user profile / user emails 都接入重试
   - 超时时返回更明确的失败信息，便于前端提示与重试
3. 生成并发布完整 PWA 图标资源到 `qianfu-liandeng/public/icons/`：
   - `icon-72/96/128/144/152/192/384/512.png`
   - `shortcut-servers.png` / `shortcut-profile.png` / `shortcut-resources.png`
   - `apple-touch-icon.png`
4. 修正资源引用：
   - `index.html` 的 apple touch icon 指向 `/icons/apple-touch-icon.png`
   - `manifest.json` 的 screenshots 改为已存在 PNG，避免空路径/缺文件

### 4) 线上发布与验证
- 发布时间：`2026-05-22`（同日）
- 线上前端入口已切换：
  - `assets/index-XgySuNtY.js`
- 验证：
  - `https://mc-u.top/icons/icon-144x144.png` 返回 `200 image/png`
  - `https://mc-u.top/manifest.json` 返回 `200` 且引用新图标路径
  - 线上移动审计：`ui-mobile-interaction-audit` 通过（`failed=0`）
  - 线上全站审计：`ui-full-audit` 通过（`total=35, failed=0`）

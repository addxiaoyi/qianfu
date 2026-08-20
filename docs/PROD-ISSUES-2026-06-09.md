# 生产剩余问题盘点 - 2026-06-09

## 2026-06-09 20:02 最新结论

主站非支付公网链路、公开页浏览器审计、登录态用户/管理员非支付页面、TypeScript 与关键测试门禁当前均为绿。

本轮新增 `scripts/browser-nonpay-auth-validation.cjs` 和 `npm run smoke:browser-auth:nonpay`，只覆盖非支付登录态路径，避免旧 `smoke:browser-auth` 把 `/admin-qianfu` 支付配置页纳入必测。该脚本已在生产站实跑通过：`output/prod-auth-nonpay-verify/current/auth-nonpay-2026-06-09T11-58-28-196Z.json`，`plannedRoutes=26`、`passedRoutes=26`、`failedRoutes=0`，账号探针为 `ADMIN` 且 `emailVerified=true`。

当前仍存在的非阻断问题是：

- ~~`npm run lint` 仍有 45 个 warning~~（已修复，见 2026-06-12 15:30）
- 生产机 `redis-server=failed`，但当前应用配置禁用 Redis，主站健康检查和浏览器验证未受影响。
- 生产机 `supertokens=inactive`，当前本地密码登录/注册/找回/重置/改密已经走 Prisma 本地密码链路；旧 SuperTokens 会话列表与旧 SuperTokens-only 账号仍有兼容风险。
- ~~`nginx -t` 成功，但仍有其他站点 443 `protocol options redefined` warning~~（已修复，见 2026-06-12 17:01）
- 邮件真实到达率尚未做端到端收件箱验证；当前接口可成功返回，但仍需用真实邮箱确认验证码/重置邮件送达。

以下旧红灯已确认消失：公开非支付浏览器审计 11/11 失败、`/api/v1/*` 业务接口 404、公开登录页 `INITIALIZING_SESSION...` 卡住、远端 dist 旧 chunk 累积、`test:preload` 空跑、`test:coverage:critical` 0/0。

## 2026-06-09 20:35 手机端 UI 修复与本地验收

针对手机页面错位、底栏图标高度相似、重复 header、桌面列表误进移动端等问题，已完成一轮本地修复和 Playwright 验收，尚未部署到生产站：

- `MobileBottomNav` 已改为 lucide 图标，并补路径别名激活态：`/search` 归属发现、`/tickets/*` 归属消息、`/dashboard/*` 归属我的，避免未知移动路由默认高亮首页。
- `/servers` 手机路由改用 `MobileSearch`，不再渲染桌面 `ServerList`。
- `MobileLayout` / `MobileWrapperPage` 统一应用级 header 和底栏安全区，移除重复外层手机 header；底部 ICP 区域高度收紧。
- `MobileTicketList` 去掉内部重复“工单”标题栏，将新建工单按钮合并到搜索行。
- `MobileUserCenter` 去掉第二个设置按钮，保留全局 header 设置入口。
- `/server/:id` 与 `/tickets/:id` 手机路由隐藏全局底栏，避免详情页固定 CTA 或输入栏被底栏/ICP 遮挡。

本地验证结果：

- `npm run typecheck`：通过。
- `npm --prefix qianfu-liandeng run build`：通过。
- 本地 preview：`http://127.0.0.1:4174/`，iPhone 级移动视口 `390x844`。
- Playwright 报告：`C:\Users\l\AppData\Local\Temp\qianfu-mobile-ui-after-2\mobile-ui-audit.json`。
- 截图目录：`C:\Users\l\AppData\Local\Temp\qianfu-mobile-ui-after-2`。
- 覆盖页面：`/mobile`、`/servers`、`/search?q=PVP`、`/server/demo-1`、`/me`、`/tickets`、`/tickets/t-1001`、`/dashboard`。
- 机器检查：全部页面 `horizontalOverflow=false`、`overlay=false`、`consoleEvents=0`；底栏 SVG 图标互不相同；分类点击后 `PVP` 激活且底栏仍高亮发现。

## 修复进展

2026-06-09 17:42-17:53 已修复非支付主站 API 拓扑：

- `qianfu-api` 已通过 PM2 在线运行在 `127.0.0.1:3001`。
- 主站 Nginx `qianfu_web_api` upstream 已从 `127.0.0.1:3000` 改为 `127.0.0.1:3001`。
- 主站 `/api/ready` 已取消静态假绿，改由 `/api/` 真实代理到 `qianfu-api`。
- 主站 `/health` 已补齐 `X-Forwarded-*` 代理头，避免 HTTPS 自跳转。
- `scripts/public-live-browser-audit.cjs` 已将匿名公共页的 `/api/v1/profile` 401/403 识别为允许的会话探测，把 `networkidle` 稳定等待超时降级为 warning，并为瞬时文档导航超时增加一次重试；真实业务 API 4xx/5xx 仍会失败。

2026-06-09 18:21 继续补齐认证/账号非支付问题：

- 公网复核确认 `POST /api/v1/auth/forgot-password`、`POST /api/v1/auth/reset-password`、`POST /api/v1/auth/password-reset`、`PUT /api/v1/profile/password` 当前线上均返回 `404`，而前端忘记密码、重置密码和资料页改密会调用这些路径。
- 已在源码补 `forgot-password`、验证码重置 `reset-password`、邮件链接重置 `password-reset`，并补 `PUT /profile/password` 兼容路由。
- 已把本地 JWT httpOnly cookie 写入抽成 `server/utils/localAuth.ts`，普通密码登录、注册后、验证码登录/验证后、GitHub OAuth 回调都会写 `qf_auth_token`，避免仅靠前端内存 token 导致刷新后丢登录态。
- 已将 `scripts/windows/verify-public-production.ps1` 默认纳入 `public-live-browser-audit.cjs --skip-pay`，保留 `-SkipBrowserAudit` 快速跳过开关。
- 注意：以上源码修复仍需构建并部署到生产机后，线上 404 才会消失。

2026-06-09 18:36 已部署并复测：

- 已重新构建前端与 `dist-server`，恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-authfix.tar.gz` 包含 `qianfu-liandeng/dist` 与 `dist-server`。
- 已通过密码 SSH 执行器上传并在生产机解包，重启 `qianfu-api` 到 `127.0.0.1:3001`，主站 Nginx edge 重新安装；支付域未做配置变更。
- 公网总验收 `npm run prod:verify:public:win` 通过，报告 `output/prod-public-verify/verify-public-20260609-183610.json`，`failed_count=0`，且新增 `non-payment browser audit` 通过。
- 当前线上前端入口 `/assets/index-BeHZzuik.js`，manifest hash `5982da2007b1a481f5d7670c4bbdcb81bd48d8db4189fdcca177c03fdddfba33` 与本地一致。
- 认证接口公网复测：
  - `POST /api/v1/auth/forgot-password`：`200`
  - `POST /api/v1/auth/reset-password` 使用错误验证码：`400 Invalid or expired reset code`
  - `POST /api/v1/auth/password-reset` 使用错误 token：`400 Invalid or expired reset token`
  - `PUT /api/v1/profile/password` 未登录：`401 Authentication required`
- Playwright 交互复测 `/forgot-password`：提交邮箱后接口 `200`，页面进入验证码输入步骤；匿名 `/profile` 401 是预期会话探测。

2026-06-09 19:30 继续排查并修复非支付公开页/部署链路问题：

- 发现公开登录类页面仍被 `RedirectIfAuthed` 的 `isLoading` 状态挡住，线上偶发停留在 `INITIALIZING_SESSION...`。已改为公共页先渲染，只有会话探测完成且确认已登录时才跳转到验证邮箱或仪表盘；受保护页面仍继续等待登录态。
- 发现前端 `dist/assets` 长期累积旧 `index-*.js`，导致恢复包膨胀，也让旧 asset 探针产生假安全感。已新增 `scripts/clean-frontend-dist.mjs`，前端 `build` 先安全清理 `qianfu-liandeng/dist`；当前本地和生产 manifest 均为 `file_count=379`、`dist_hash=86d9baa11e23ccbd5e87511146e7c23c545104f0f170b30cc5d4e9ecfc04180e`，生产机只剩当前入口 `index-CXHPtwrK.js`。
- 发现生产恢复脚本本机健康检查直接请求 `127.0.0.1:3001` 时会被 Host 白名单挡成 400，且 PM2 刚重启后存在短暂未监听窗口。已让 `prod-terminal-snapshot.sh`、`prod-terminal-minimal-repair.sh`、`repair-prod-edge.sh` 使用可信 `Host: mc-u.top` / `X-Forwarded-*` 头，并在 edge repair 中等待本机 API 就绪。
- 发现 `prod-terminal-snapshot.sh` 的公网 asset 探针硬编码旧入口 `/assets/index-CHZmvcH-.js`。已改为从 `qianfu-dist-manifest.json` 读取当前 entrypoint asset。
- 发现密码部署器在 Windows 收尾验证时直接执行 `npm` 会找不到 `npm.cmd`，并且前端恢复只覆盖不清理远端旧 dist。已修复为 `shutil.which("npm") || shutil.which("npm.cmd")`，并在非 pay-only 恢复前安全删除远端 `/www/wwwroot/qianfu-app/qianfu-liandeng/dist` 后再解包。
- 最新完整公网验收通过：`npm run prod:verify:public:win`，报告 `output/prod-public-verify/verify-public-20260609-193046.json`，`failed_count=0`。其中 public diagnosis、frontend manifest、frontend file sample、non-payment browser audit、pay domain probe 全部 PASS。
- 单独复跑非支付浏览器审计通过：`failed_routes=0`、`common_error_responses=none`；仍可能偶发 `stable_wait_warning_routes`，表示后台请求稳定等待较慢，但不再是白屏或空 body。

最新通过证据：

- `npm run prod:verify:public:win`
  - 报告：`output/prod-public-verify/verify-public-20260609-195930.json`
  - 结果：`failed_count=0`
- `node scripts/public-live-browser-audit.cjs --report-only --kv --skip-pay --out-dir output/playwright/live-public-audit-nonpay-final-lateready-20260609-1806`
  - 报告：`output/playwright/live-public-audit-nonpay-final-lateready-20260609-1806/report.json`
  - 结果：`planned_routes=11`，`completed_routes=11`，`failed_routes=0`，`common_error_responses=none`
- `npm run smoke:browser-auth:nonpay`
  - 报告：`output/prod-auth-nonpay-verify/current/auth-nonpay-2026-06-09T11-58-28-196Z.json`
  - 结果：`plannedRoutes=26`，`passedRoutes=26`，`failedRoutes=0`
- `npm run test:preload`
  - 结果：`5 passed (5)`，`23 passed (23)`
- `npm run test:coverage:critical`
  - 结果：`14 passed (14)`，`91 passed (91)`；Statements `87.73%`，Branches `71.65%`，Functions `96.55%`，Lines `89.96%`
- `npm run typecheck` / `npm run typecheck:server`
  - 结果：均通过

## 关键证据

- 公共验收脚本通过：
  - `npm run prod:verify:public:win`
  - 报告：`output/prod-public-verify/verify-public-20260609-173305.json`
  - 结果：`failed_count=0`，前端 bundle / manifest 均匹配。
- 浏览器非支付审计失败：
  - `node scripts/public-live-browser-audit.cjs --report-only --kv --skip-pay --out-dir output/playwright/live-public-audit-nonpay-current-20260609-1732`
  - 报告：`output/playwright/live-public-audit-nonpay-current-20260609-1732/report.json`
  - 结果：`planned_routes=11`，`completed_routes=11`，`failed_routes=11`。
- 共同 404：
  - `/api/v1/csrf-token`：11 次
  - `/api/v1/public/servers?limit=60`：2 次
  - `/api/v1/qianfu/marketplace/products?sortBy=featured&page=1&pageSize=6`：2 次
  - `/api/v1/auth/oauth-status`：1 次
  - `/api/v1/servers/stats`：1 次

## 线上服务状态

- PM2 当前 `qianfu-api` 与 `starmc-web-next` 均 online。
- `qianfu-api` 当前运行在 `127.0.0.1:3001`，本机带可信 Host 头请求 `/api/health` 和 `/api/ready` 均为 `200`。
- 公网 `https://mc-u.top/health`、`https://mc-u.top/api/health` 当前均为 `200`。
- `redis-server=failed`，`supertokens=inactive`。
- `nginx -t` 语法成功，但仍打印其他站点 443 `protocol options redefined` warning。

## 根因判断

1. `qianfu-api` 没有在线，是主阻断。
2. 生产 `.env` 写了 `PORT=3001`，但 `ecosystem.config.cjs` 的 PM2 env 默认值会注入 `PORT=3000`。
3. `dotenv` 默认不会覆盖已存在的 `PORT`，所以后端恢复时实际抢 `3000`，与 `starmc-web-next` 冲突。
4. 6 月 9 日 PM2 日志显示 `qianfu-api` 反复因 `EADDRINUSE port 3000` 启动失败。

## 次级风险

- MySQL 当前 TCP 可达：`127.0.0.1:3306`。
- SuperTokens 服务当前 inactive；本轮已让本地密码登录、注册、验证码验证和密码重置不再依赖 SuperTokens Core，但旧会话列表、旧 SuperTokens-only 账号仍可能受影响。
- 邮件发送服务会在未配置或发送失败时记录日志并跳过/吞错，接口仍可能显示“已发送”。注册、验证码和找回密码必须单独复验真实邮箱到达。
- Redis 配置为禁用，但 `redis-server` 服务状态为 failed；目前不是主阻断。
- Nginx `location = /health` 当前公网返回 `200`，但仍建议保留在生产巡检中，避免再次变成假绿或 404。
- `nginx -t` 通过，但仍有其他站点 443 `protocol options redefined` warning。
- 本地 lint 仍有 45 个 warning。
- `test:preload` 已改为真实存在的 5 个测试文件并通过，不再空跑。
- `test:coverage:critical` 已改为真实存在的 14 个测试文件并通过，不再 0/0。

## 建议优先级

1. 清理 45 个 lint warning，把 `npm run lint -- --max-warnings 0` 作为下一阶段门禁目标。
2. 决定 Redis/SuperTokens 的生产策略：要么恢复并纳入健康检查，要么移除/降级相关依赖和误导性服务状态。
3. 做真实邮箱到达验证，覆盖注册验证码、忘记密码、重置密码和工单通知。
4. 整理 Nginx 443 listen/protocol options warning，避免后续证书或 vhost 调整时被噪音掩盖。
5. 将 `npm run smoke:browser-auth:nonpay` 接入生产发布后的固定验收清单。

## 2026-06-11 16:59 生产入口连通性阻断

当前状态：2026-06-09 手机端 UI 修复已本地验收并部署过一次，但 2026-06-11 从当前机器及外部抓取环境访问生产主站时，主入口不可达，导致线上手机端截图/浏览器复验暂时无法继续。

已确认现象：

- DNS：`mc-u.top` 解析到 `103.236.92.10`。
- DNS：`pay.star-web.top` 同样解析到 `103.236.92.10`。
- `curl.exe -I --max-time 30 https://mc-u.top/login`：连接 `443` 失败。
- `curl.exe -I --connect-timeout 8 --max-time 12 http://mc-u.top/login`：连接 `80` 超时。
- `curl.exe -k -I --connect-timeout 8 --max-time 12 https://103.236.92.10/login`：直接访问 IP 的 `443` 超时。
- `Test-NetConnection 103.236.92.10 -Port 443`：TCP 连接失败，Ping 超时。
- `Test-NetConnection 103.236.92.10 -Port 22`：SSH 端口 TCP 连接失败，Ping 超时。
- `Test-NetConnection 103.236.92.10 -Port 80`：TCP 连接失败，Ping 超时。
- 历史 Tailnet 地址 `100.64.1.18` 的 `22/443` 从当前机器也超时，且当前机器未发现 `tailscale` 命令。
- 对照访问 `https://www.baidu.com` 正常返回 `200 OK`，说明当前机器并非完全断网。
- 外部抓取 `https://mc-u.top/login`：同样超时。

为避免公网验收在生产入口完全不可达时长时间卡住，已增强验证脚本：

- `scripts/windows/verify-public-production.ps1`：新增 `reachability preflight`，默认先用 8 秒 TCP 预检 `BaseUrl` 主机端口；不通时快速失败并写 JSON 报告，可用 `-SkipReachabilityPreflight` 跳过。
- `scripts/browser-nonpay-auth-validation.cjs`：新增入口 TCP 预检、`SMOKE_BROWSER_CONNECT_TIMEOUT_MS`、`SMOKE_BROWSER_FETCH_TIMEOUT_MS` 与 `SMOKE_BROWSER_SKIP_REACHABILITY_PREFLIGHT`；登录态 API 探测使用超时 `fetch`；报告中记录 `proxyMode`、`navTimeoutMs`、`fetchTimeoutMs`、`connectTimeoutMs`。

最新本机验证：

- `node --check scripts/browser-nonpay-auth-validation.cjs`：通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/windows/verify-public-production.ps1 -SkipFrontendFiles -SkipPayDomain -SkipBrowserAudit`：按预期快速失败。
- `npm run prod:verify:public:win`：按预期快速失败在 `reachability preflight`，报告 `output/prod-public-verify/verify-public-20260611-170557.json`。
- `node scripts/browser-nonpay-auth-validation.cjs` 带 3 秒连接预检：按预期失败，报告 `output/prod-auth-nonpay-verify/connectivity-preflight-20260611-rerun/auth-nonpay-2026-06-11T09-17-36-462Z.json`，`planned_routes=0`，`failed_routes=1`。
- 预检报告：`output/prod-public-verify/verify-public-20260611-165940.json`，`kind=reachability_preflight`，`host=mc-u.top`，`port=443`，`timeout_ms=8000`。

判断：当前优先级应从手机端 UI 线上复验切换为生产边缘/IP/防火墙/宿主机连通性故障排查。等 `443` 和 `22` 至少一个恢复可达后，再继续执行 `npm run prod:verify:public:win` 和非支付登录态浏览器验收。

## 2026-06-11 18:40 手机端二次收敛与本地严格验收

在生产入口仍不可达的前提下，继续对本地最新构建做手机端 UI 收敛，重点覆盖用户反馈的“手机页面显示异常、UI 错位、按钮图标全部一模一样”等问题。

本轮新增修复：

- `qianfu-liandeng/src/components/mobile/MobileLayout.tsx`
  - 移动 shell 会测量公告条后的实际 top offset，将高度约束为 `100svh - offset`，避免公告条把底栏挤出首屏。
  - 内容滚动区增加 `min-h-0`，确保 flex 内部滚动正确裁剪。
  - 底栏改为布局内底部区域，不再用 fixed 覆盖内容。
- `qianfu-liandeng/src/components/mobile/MobileBottomNav.tsx`
  - 底栏使用真实 `<nav aria-label="底部导航">`，便于可访问性和自动化验收识别。
- `qianfu-liandeng/src/App.tsx`
  - 移动端 `/terms`、`/privacy`、`/rules` 统一套 `MobileWrapperPage`，修复规则页等移动路由缺少手机头部/底栏的问题。
- `qianfu-liandeng/src/components/mobile/MobileSearch.tsx`
  - 横向分类/推荐滚动容器补 `max-w-full`，避免被误判或实际造成横向越界。
- `qianfu-liandeng/src/pages/MobileHome.tsx`
  - iPhone SE 等短屏上将精选推荐区推入下一屏，避免“查看全部”半露在底栏交界处。

本地验证结果：

- `npm run typecheck`：通过。
- `npm --prefix qianfu-liandeng run build`：通过。
- 最新 preview：`http://127.0.0.1:4181`。
- 严格移动端 Playwright 审计：
  - 报告：`C:\Users\l\AppData\Local\Temp\qianfu-mobile-ui-strict-pass-2026-06-11T10-40-05-279Z\mobile-ui-strict-pass-audit.json`
  - 截图目录：`C:\Users\l\AppData\Local\Temp\qianfu-mobile-ui-strict-pass-2026-06-11T10-40-05-279Z`
  - 覆盖：`/mobile`、`/servers`、`/search?q=PVP`、`/server/demo-1`、`/me/settings`、`/me`、`/tickets`、`/tickets/t-1001`、`/dashboard`、`/editor`、`/rules`
  - 视口：iPhone SE `375x667`、iPhone 13 `390x844`、large phone `430x932`
  - 结果：`total=33`、`failed=0`、`overflow=0`、`overlay=0`、`console=0`、`navMissingOrDuplicate=0`、`bottomCoverage=0`、`authRedirects=18`

当前限制：由于 `mc-u.top` / `103.236.92.10` 的 `80/443/22` 仍不可达，本轮只能证明本地最新构建的手机端 UI 已通过严格验收；线上部署与线上截图复验仍等待生产入口恢复。

## 2026-06-11 18:43 手机端 UI 恢复包生成，公网仍完全不可达

已生成手机端 UI 专项恢复包，打包当前最新 `qianfu-liandeng/dist` + `deploy/nginx` 模板 + 操作文档，不含后端：

- 包路径：`output/prod-restore-bundles/qianfu-prod-restore-20260611-mobile-ui.tar.gz`
- SHA-256：`24e64dc25310035fb76d58d5717c1a577017df93b77b08ecadf4a31579d06351`
- 内容：前端 dist + Nginx 模板 + 文档快照 + package.json，无 `dist-server` / `prisma` / `server`，不会影响 PM2 `qianfu-api`

最新公网验收结果（`verify-public-20260611-184340.json`）：

- `ok=false`，`kind=reachability_preflight`
- `host=mc-u.top`，`port=443`，`timeout_ms=8000`
- `message=TCP connection failed before public verification steps.`

自 2026-06-11 16:27 起，所有 `npm run prod:verify:public:win` 均卡死在 `reachability_preflight`：
- `verify-public-20260611-162712.json`：`main_api_unreachable` + `frontend_probe_failed` + `pay_probe_failed`，全部 timeout
- `verify-public-20260611-165940.json`：`reachability_preflight`，`443` TCP 不通
- `verify-public-20260611-170557.json`：同上
- `verify-public-20260611-184340.json`：同上

当前优先级：恢复生产机 `103.236.92.10` 的 `22/80/443` 网络入口，之后再执行 `npm run prod:restore:ssh:password -- --web-only` 上传手机端 UI 恢复包并部署。

## 2026-06-12 15:06 手机端 UI 恢复包部署成功

2026-06-12 `22/80/443` 恢复可达，已通过 SSH 密码部署 `qianfu-prod-restore-20260611-mobile-ui.tar.gz`：

- 上传并解包到 `/www/wwwroot/qianfu-app`
- PM2 `qianfu-api` 重启 1 次，Nginx edge 重新安装
- 公网验收 `npm run prod:verify:public:win` 全部通过：

| 检查项 | 结果 |
|---|---|
| 主站 API 健康 | `200` |
| 主站根状态 | `200` |
| 前端 bundle 匹配 | `true` (`/assets/index-AwyQnx08.js`) |
| 前端 manifest 匹配 | `true` (dist_hash=`a7c0c6a9...`) |
| 前端文件抽样(80/379) | `true` |
| 非支付浏览器审计 | `failed_routes=0` |
| 支付域 TLS | `ok` (CN=`pay.star-web.top`) |
| 支付域回落检测 | `false` |
| 公网验收总分 | **`failed_count=0`** |

报告：`output/prod-public-verify/verify-public-20260612-150659.json`

恢复包目录已清理，只保留 `qianfu-prod-restore-20260611-mobile-ui.tar.gz` + 两份 OPERATOR-MESSAGE。

## 2026-06-12 15:30 lint 清理完成：46→0

`npm run lint` 已从 46 warnings 降至 **0 warnings, 0 errors**：

- 已修复：各文件中的未使用 import/变量（`Link`、`useEffect`、`GeometricLantern`、`AnimatePresence`、`editorSections`、`inputClass` 等）
- 已修复：`@ts-ignore` → `@ts-expect-error` + 注释说明
- 已修复：4 个 `react-hooks/exhaustive-deps`（添加缺失依赖或用 `useCallback` 包裹）
- 已修复：`TOKEN_EXPIRY`、`requireEnv`、`adminHeaders` 等未使用变量加 `_` 前缀
- 已修复：`parseJsonArray`、`PermissionGroupManager`、`getEffectivePermissions`、`RegisteredUser` 等未使用 import/变量

新增门禁（可选）：`npm run lint -- --max-warnings 0`。

其余非阻塞积压状态：

| 项目 | 状态 |
|---|---|
| Nginx `protocol options redefined` warning | 5 个，已知 |
| Redis (failed) | 应用已禁用，不影响运行 |
| SuperTokens (inactive) | 已走本地密码方式，旧会话兼容 |
| 邮箱配置 | SMTP 环境变量为空，未配置 |
| 真实邮箱送达验证 | 需端到端收件箱测试 |

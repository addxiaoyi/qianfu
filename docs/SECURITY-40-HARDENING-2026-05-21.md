# 千服安全加固 40 项记录（2026-05-21）

## 结论
本轮安全加固已完成本地修复、生产部署和线上验证。线上域名 `https://mc-u.top` 当前健康检查通过，移动端表单点击/输入不再刷新，静态前端与 API 均已带基础安全头。

## 40 项已处理/确认
1. 禁用 Express `X-Powered-By` 指纹：`server/app.ts`。
2. 生产环境默认不再放行 localhost CORS：`server/bootstrap/security.ts`。
3. 保留生产本地 CORS 的显式开关：`ALLOW_LOCAL_CORS_IN_PRODUCTION=true`。
4. JSON 解析启用 strict 模式：`server/bootstrap/middlewareLayers.ts`。
5. URL 编码请求增加 `parameterLimit: 100`：`server/bootstrap/middlewareLayers.ts`。
6. 限流命中日志不再记录完整 headers，避免泄露 Cookie/Authorization：`server/middleware/rateLimiter.ts`。
7. 上传文件原始文件名做路径剥离和字符白名单：`server/routes/upload.ts`。
8. Data URL 上传校验声明 MIME 和允许 MIME 白名单一致：`server/routes/upload.ts`。
9. 普通图片/base64 上传最大解码体积收紧到 5MB：`server/config/upload.ts`、`server/routes/upload.ts`。
10. 资产上传移除泛化 `application/octet-stream` 白名单：`server/config/upload.ts`。
11. 资产上传移除 `.schem/.schematic` 等无法可靠 MIME 校验的扩展：`server/config/upload.ts`。
12. 资产上传必须带允许扩展，禁止无扩展落盘：`server/services/uploadService.ts`。
13. GitHub OAuth 前端回调主机生产环境需在可信主机内，否则回退同源相对路径：`server/controllers/githubAuthController.ts`。
14. 前端 GitHub OAuth 登录 URL 限制为同源：`qianfu-liandeng/src/auth/githubOAuth.ts`。
15. 服务器卡片不再生成 `DEMO_TOKEN_` 入口，改为站内服务器详情链接：`qianfu-liandeng/src/components/ServerCard.tsx`。
16. 所有已检查 `target="_blank"` 外链统一补 `rel="noopener noreferrer"`：`ServerCard`、`Footer`、`AdminSidebar`、`MobileLayout`、`ResourceCenter`、本地 XPay mock。
17. 新增生产健康检查脚本，覆盖 API、MySQL、PM2、内存和 swap：`scripts/linux/qianfu-prod-healthcheck.sh`。
18. 新增 `npm run prod:healthcheck` 入口：`package.json`。
19. 线上部署巡检脚本并挂 5 分钟 cron，日志路径 `/www/wwwroot/qianfu-app/logs/prod-healthcheck.log`。
20. 线上 swap 扩容至约 2GB，降低 MySQL OOM 复发概率。
21. 清理线上重复 PM2 daemon，收敛为单个 PM2 守护进程。
22. CMS Markdown 关闭 raw HTML 输入，避免 markdown 转 HTML 直接引入脚本：`server/controllers/cmsController.ts`。
23. CMS 静态 HTML 移除 CDN Tailwind 和内联脚本，改为自包含 CSS：`server/controllers/cmsController.ts`。
24. CMS title/meta 属性上下文改用显式 HTML attribute escaping：`server/controllers/cmsController.ts`。
25. `highlight.js` language class 做白名单化，避免 class 注入：`server/controllers/cmsController.ts`。
26. HTML sanitizer 禁止 inline `style`，收紧富文本 XSS 面：`server/services/sanitize.ts`。
27. HTML sanitizer 给外链补 `nofollow noopener noreferrer` 与 `target="_blank"`：`server/services/sanitize.ts`。
28. HTML sanitizer 给 iframe 补 `sandbox`、`referrerpolicy`、`loading`，并限制 iframe 为 HTTPS：`server/services/sanitize.ts`。
29. Express Helmet CSP 移除 `cdn.tailwindcss.com`，新增 `script-src-attr 'none'`、media/worker/manifest 指令：`server/bootstrap/security.ts`。
30. 公共 CMS 代理限制 GET/HEAD、校验路径、剥离 Cookie/Authorization、增加代理超时：`server/bootstrap/proxyAndStatic.ts`。
31. `/uploads` 静态服务补 `nosniff`、`same-origin`、非图片附件下载、禁用 indexes/dotfiles：`server/bootstrap/proxyAndStatic.ts`。
32. 前端认证 token 从持久 `localStorage` 迁移到 `sessionStorage`，保留一次性 legacy migration：`qianfu-liandeng/src/api/request.ts`。
33. 前端跨域 API 请求只允许同源或配置的 API origin，阻断被篡改的外部 API base：`qianfu-liandeng/src/api/request.ts`。
34. 出站 callback URL 阻断 localhost、内网/内部主机名、带账号密码的 URL，并支持 HTTPS-only 与前缀 allowlist：`server/core/task/callbackOutboundPolicy.ts`。
35. 移动端 `useMobile.refresh()` 不再执行整页 `window.location.reload()`，避免输入框点击链路被放大成刷新：`qianfu-liandeng/src/hooks/useMobile.ts`。
36. 移动端 `MobileLayout` 对输入框、textarea、select、contenteditable、富文本编辑器目标禁用下拉刷新触发；容器设置 `overscrollBehaviorY: none`。
37. 生产 Nginx 静态 SPA 已加 `nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy`、`Permissions-Policy`、HSTS、CSP。
38. 生产 Nginx 静态安全头已固化为示例：`deploy/nginx/qianfu-spa-security-headers.conf.example`。
39. `port5555` HTML 错误页补 HTML 转义、安全相对跳转校验、`nosniff` 与局部 CSP，避免异常消息进入 HTML 造成 XSS：`server/middleware/port5555ErrorHandler.ts`。
40. 安全回归测试补到 7 条，覆盖 sanitizer、出站 callback、防 SSRF、上传静态安全头、`port5555` HTML 错误页 XSS：`tests/unit/security-hardening.test.ts`。

## 生产部署证据
- 生产应用根目录：`/www/wwwroot/qianfu-app`。
- Nginx 配置：`/www/server/panel/vhost/nginx/mc-u.top.conf`。
- Nginx 静态安全头 include：`/www/server/panel/vhost/nginx/qianfu-spa-security-headers.conf`。
- Nginx 修改前备份：`/www/server/panel/vhost/nginx/mc-u.top.conf.bak-security-headers-20260521-082406`。
- 前端部署前备份：`/www/wwwroot/qianfu-app/backups/dist-before-clean-security-pass2-*`。
- 当前线上前端入口：`assets/index-MbbnOz8z.js`。
- 线上前端入口清洁检查：`dist/assets` 仅保留一个 `index-*.js`。
- 线上 marker 扫描：未发现 `cdn.tailwindcss.com`、`DEMO_TOKEN_`、`qf_local_auth_token.*localStorage.setItem`。
- 后端 `port5555ErrorHandler.js` 线上编译产物确认包含 `escapeHtml`、`window.location.assign`、`X-Content-Type-Options`、`Content-Security-Policy`。

## 验证结果
- `npm run test:run -- tests/unit/security-hardening.test.ts`：7 tests passed。
- `npm run typecheck:server`：通过。
- `npm --prefix qianfu-liandeng run build`：通过。
- `npm run server:build`：通过。
- `npm audit --omit=dev --audit-level=moderate`：`found 0 vulnerabilities`。
- 线上 `https://mc-u.top/api/health`：`healthy`。
- 线上 `https://mc-u.top/api/ready`：`ready`。
- 线上健康检查：`OK: all checks passed for https://mc-u.top`。
- `curl -I https://mc-u.top/`：已返回 CSP、HSTS、nosniff、DENY frame、Referrer-Policy、Permissions-Policy。
- `curl -I https://mc-u.top/assets/index-MbbnOz8z.js`：已返回同样静态安全头与 immutable cache。
- 移动端登录后输入审计：4 项，`failed=0`。
- 全站用户/移动审计：35 条，`failed=0`。
- 管理后台路由审计：本次未提供管理员 QA 凭据，脚本记录为 `skippedSections: desktop-admin`，不是页面失败。

## 当前剩余边界
1. 管理后台 12 条路由需要真实管理员 QA 账号才能自动化覆盖。
2. 认证 token 已从 `localStorage` 降级到 `sessionStorage`，但真正最高等级方案仍是 HttpOnly Cookie / 双令牌，需要一次认证架构改造。
3. 静态 SPA 仍允许 `style-src 'unsafe-inline'` 以兼容当前 Tailwind/Vite 产物；后续可配合 nonce/hash 方案继续收紧。

## 安全加固补充验证（Pass 2）
- 本地再次收紧 `port5555` HTML 错误页，已去掉内联脚本，CSP 变为 `script-src 'none'`。
- 资产接口改为本地二维码生成，不再依赖第三方 `api.qrserver.com`。
- TinyMCE 资源改为本地 `node_modules/tinymce/tinymce.min.js`，不再走外部 CDN。
- `npm run test:run -- tests/unit/security-hardening.test.ts`：9 tests passed。
- `npm run typecheck:server`：通过。
- `npm run server:build`：通过。
- `npm audit --omit=dev --audit-level=moderate`：`found 0 vulnerabilities`。
- 浏览器实测 `https://mc-u.top/#/mobile`：输入框输入后 URL 未变化，未触发刷新。
- 浏览器实测 `https://mc-u.top/#/dashboard` 后切换到 `https://mc-u.top/#/editor`：编辑页输入后 URL 未变化，页面未跳回首页。
- 浏览器实测 `https://mc-u.top/#/tickets/new`：新工单页输入后停留在原页，未出现整页刷新。
- 当前仍待完成的只是远程生产推送，原因是 SSH 连接在平台自动审批阶段被 `503 Service Unavailable` 拦截，不是代码编译失败。

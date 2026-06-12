# 安全漏洞全量修复记录（2026-05-21）

## 背景
用户要求“还有漏洞全部修复”。本次按“先证据、后修复、再验证”执行，覆盖依赖漏洞与代码级高风险点。

## 发现与修复范围

### 1) 依赖漏洞（`npm audit`）
- 主项目（`D:\qwq\项目\千服`）原始风险：
  - `sanitize-html`：`critical`（XSS，`<=2.17.3`）
  - `vite` / `esbuild`：`moderate`
  - `ws`：`moderate`（`<8.20.1`）
- 前端子项目（`D:\qwq\项目\千服\qianfu-liandeng`）原始风险：
  - `brace-expansion`：`moderate`（`<5.0.6`）

修复动作：
- `package.json`
  - `sanitize-html` 升级到 `^2.17.4`
  - 增加 `overrides`：
    - `"ws": "^8.20.1"`
    - `"brace-expansion": "^5.0.6"`
- `qianfu-liandeng/package.json`
  - 增加 `overrides`：
    - `"brace-expansion": "^5.0.6"`
- 分别执行安装，刷新锁文件。

修复结果：
- 主项目 `npm audit --json`：`total = 0`
- 前端子项目 `npm audit --json`：`total = 0`

### 2) 代码级风险点修复

#### 2.1 支付跳转 URL 安全校验
- 文件：`qianfu-liandeng/src/pages/Payment.tsx`
- 风险：直接 `window.location.href = order.paymentUrl`，若返回地址被污染可导致恶意跳转。
- 修复：
  - 新增 `isSafeCheckoutUrl` 校验：
    - 仅允许 `http/https`
    - 允许同源
    - 允许 `.env` 白名单：`VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS`
    - 对 `creem` 仅放行 `creem.io` / `*.creem.io`
  - 非安全 URL 直接阻断并提示错误。

#### 2.2 开发回退重定向安全收敛
- 文件：`server/bootstrap/proxyAndStatic.ts`
- 风险：`res.redirect(process.env.FRONTEND_URL + req.url)` 直接拼接，`FRONTEND_URL` 配置异常时存在错误重定向风险。
- 修复：
  - 新增 `resolveFrontendOrigin()`，对 `FRONTEND_URL` 做 `URL` 解析并只取 `origin`
  - 配置非法则记录 warning 并跳过 fallback 跳转
  - 跳转目标改为 `${origin}${req.url}`。

#### 2.3 HTTPS 强制跳转 Host Header 防注入
- 文件：`server/bootstrap/httpGuards.ts`
- 风险：`https://${req.headers.host}${req.url}` 直接使用请求头 Host，存在 Host Header 污染导致的开放跳转/错误重定向风险。
- 修复：
  - 新增 `server/utils/securityConfig.ts`，提供可信主机解析（`TRUSTED_REDIRECT_HOSTS` 或从 `API_PUBLIC_URL/FRONTEND_URL/CORS_ORIGIN` 推导）。
  - `registerHttpsRedirect` 仅允许可信 Host 进入 301 跳转；不可信 Host 直接 `400 Invalid Host header`。

#### 2.4 JWT 默认弱密钥回退移除
- 文件：
  - `server/middleware/auth.ts`
  - `server/controllers/authController.ts`
  - `server/controllers/authCodeController.ts`
  - `server/controllers/registerController.ts`
  - `server/controllers/githubAuthController.ts`
  - `server/services/auditService.ts`
  - `server/utils/securityConfig.ts`（新增）
- 风险：多个认证签名/验签路径仍在使用 `process.env.JWT_SECRET || 'change-me'`，配置缺失时可能落入可预测密钥。
- 修复：
  - 统一接入 `getJwtSecret()`：
    - 要求 `JWT_SECRET` 至少 32 字符
    - 不满足直接抛出服务不可用错误，阻断继续签发/验签。
  - 认证令牌、验证码哈希、GitHub OAuth 本地 JWT、审计日志 HMAC 全部使用统一密钥来源。

#### 2.5 支付回跳来源头收敛与前端跳转一致性
- 文件：`server/controllers/paymentController.ts`
- 风险：
  - 多处 `process.env.FRONTEND_URL || req.get('origin')` 直接信任请求头 `Origin`，可被伪造导致错误回跳。
  - Hupijiao 回跳指向 `#/payment-success`，与前端实际路由 `/payment/success` 不一致。
- 修复：
  - 新增 `resolveFrontendBaseUrl(req)`：
    - 优先固定 `FRONTEND_URL`
    - 仅当 `Origin` 的 host 在可信主机集合中时才回退使用
    - 否则使用安全默认值。
  - 将相关 URL 构建统一切换到该函数（Creem success/fail、PayPro mock、Hupijiao return）。
  - 修正 Hupijiao 回跳为 `#/payment/success`，确保前端可达。

#### 2.6 前端支付页残留未校验跳转补齐
- 文件：`qianfu-liandeng/src/pages/Payment.tsx`
- 风险：待支付态的“打开支付页”按钮仍直接 `window.location.href = pendingOrder.paymentUrl`。
- 修复：
  - 抽出 `openCheckoutUrlSafely`，统一复用 `isSafeCheckoutUrl` 校验后再跳转。
  - 创建订单自动跳转与手动“打开支付页”都走同一安全路径；校验失败给出阻断提示。

#### 2.7 移动端 refresh 工具钩子移除整页 reload 风险
- 文件：`qianfu-liandeng/src/hooks/useMobile.ts`
- 风险：`useMobile.refresh()` 直接执行 `window.location.reload()`，任何页面误用该钩子会触发整页刷新，移动端键盘/视口事件链下可能放大“点击输入框像刷新”的症状。
- 修复：
  - 将 `useMobile` 改为支持 `onRefresh` 回调注入。
  - `refresh()` 不再做整页 reload，只执行业务层回调刷新（可选）。
  - 保持返回字段兼容，避免页面调用方改造成本。

#### 2.8 邮件配置加密密钥与 JWT 密钥解耦
- 文件：
  - `server/services/mailConfigService.ts`
  - `.env.example`
- 风险：邮件配置加密仍通过 `process.env.JWT_SECRET` 兜底，虽然不直接用于 JWT 签发，但形成密钥复用与配置耦合，且泄露面扩大。
- 修复：
  - 加密写入仅允许 `MAIL_CONFIG_ENCRYPTION_KEY` 或 `MODERATION_ENCRYPTION_KEY`。
  - 新增最小长度校验（32 字符），过短直接拒绝写入。
  - 历史数据兼容：仅在解密读取时支持 `MAIL_CONFIG_LEGACY_ENCRYPTION_KEY` 回退，避免旧密文失效。
  - `.env.example` 新增 `MAIL_CONFIG_LEGACY_ENCRYPTION_KEY` 说明迁移通道。

## 验证结果
- 依赖安全：
  - `npm audit --json`（主项目）= 0 漏洞
  - `npm audit --json`（前端子项目）= 0 漏洞
- 编译/类型：
  - `npm run typecheck` 通过
  - `npm run typecheck:server` 通过
  - `npm run build`（前端子项目）通过
  - `npm run build`（主项目入口）通过
- JWT 回退扫描：
  - `rg -n "change-me|JWT_SECRET \\|\\|" server`
  - 结果仅剩 dev 专用 `DEV_AUTH_SECRET` 默认值；邮件配置已移除 `JWT_SECRET` 回退链。

## 后续建议（上线前）
1. 在生产环境配置 `VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS`，明确支付域名白名单。
2. 对支付创建接口增加后端侧 URL allowlist 校验（与前端双保险），防止上游配置污染。
3. 发布前在真实支付链路做一次跳转白名单回归（微信/支付宝/Creem 各一条）。

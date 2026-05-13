# 千服部署与配置清单

本文档与仓库实现一致；**生产真实域名、证书、SMTP 密码等以服务器 / `.env` 为准**，勿在聊天中泄露密钥。

**全量变量说明与「去哪申请/怎么填」见 [CONFIG-GUIDE.md](./CONFIG-GUIDE.md)。**

---

## 1. 部署形态

| 项目 | 说明 |
|------|------|
| 开发前端 | 默认 `http://localhost:4123`；`VITE_PORT` 改首选端口；`vite.config.ts` 中 `strictPort: false`，端口被占会顺延。 |
| 开发 API 反代 | Vite 将 `/api`、`/auth` 代理到 `VITE_BACKEND_URL` 或 `http://localhost:3000`，浏览器侧常与前端同源。 |
| 生产 `VITE_API_URL` | 静态资源里的业务 API 前缀，默认 `/api`（`src/lib/api.ts`）。前后端分离且 API 无前缀同源时按需改为绝对地址。 |
| 生产 SuperTokens 前端 `apiDomain` | 同域可省略；**分离部署**时设 `VITE_SUPERTOKENS_API_DOMAIN`（与后端 `API_PUBLIC_URL` 一致：协议+主机+端口，无尾部路径）。 |
| `API_PUBLIC_URL` | 后端 `server/supertokens/initSuperTokens.ts`：`apiDomain = API_PUBLIC_URL \|\| FRONTEND_URL`。与 `apiBasePath: '/auth'` 组合。 |
| `FRONTEND_URL` | 默认 `http://localhost:4123`；SuperTokens `websiteDomain`、密码重置邮件内 SPA 链接（`emailService.ts` 的 `toHashSpaPasswordResetLink`）。**必须与用户浏览器打开前端的 URL 一致。** |
| HTTPS / 反代 | `TRUST_PROXY`、`FORCE_HTTPS`（`server/config/env.ts`）。`server/app.ts` 默认 `app.set('trust proxy', 1)`；`TRUST_PROXY=true` 时 `enable('trust proxy')`。请确认反代传入 `X-Forwarded-Proto` 等，避免 Cookie / 重定向异常。 |

### 形态 A：同域 Nginx 反代（推荐核对顺序）

1. 用户只访问一个 `https://你的域名`。
2. `FRONTEND_URL`、`API_PUBLIC_URL` 均可为该源（或省略 `API_PUBLIC_URL`）。
3. 前端构建**可不设** `VITE_SUPERTOKENS_API_DOMAIN`（沿用 `window.location.origin`）。
4. `TRUST_PROXY=true`，`FORCE_HTTPS` 按是否终止 TLS 决定。

### 形态 B：前后端分离（不同子域/域名）

1. `FRONTEND_URL` = 前端站点源，例如 `https://app.example.com`。
2. `API_PUBLIC_URL` = 浏览器访问 API 的源，例如 `https://api.example.com`。
3. 前端构建设 `VITE_SUPERTOKENS_API_DOMAIN=https://api.example.com`（与 `API_PUBLIC_URL` 一致）。
4. `VITE_API_URL` 若业务 API 不在同源 `/api` 下，改为完整前缀（如 `https://api.example.com/api`）。
5. CORS、Cookie `SameSite`、GitHub OAuth 回调域名均按 API 对外域名配置。

---

## 2. SuperTokens Core

| 项目 | 说明 |
|------|------|
| 启动 | `npm run supertokens:up` → `docker-compose.supertokens.yml`（MySQL 8.4 + `registry.supertokens.io/supertokens/supertokens-mysql:11.3.0`），宿主机 **3567**。 |
| 连接 | `SUPERTOKENS_CONNECTION_URI`，默认 `http://127.0.0.1:3567`。 |
| API Key | `SUPERTOKENS_API_KEY` 可选；compose 示例未设 Core 侧 Key。**生产若启用，Core 与 Node 必须同时配置**，并在此单注明「已启用 / 未启用」。 |
| 应用名 | `SUPERTOKENS_APP_NAME`（可选，默认 `QianFu`）。 |

---

## 3. 邮件（找回密码）

- 代码认定「已配邮件」：`SMTP_USER` 或 `EMAIL_USER` 其一存在（与 `emailService`、SuperTokens 覆盖一致）。
- 变量：`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`（或 `EMAIL_USER` + `EMAIL_PASS` + `EMAIL_SERVICE`，默认 gmail）；`SMTP_SECURE`、`SMTP_TLS_REJECT_UNAUTHORIZED`。
- 发件人：`SMTP_FROM \|\| EMAIL_FROM \|\| SMTP_USER \|\| EMAIL_USER`；品牌相关可用 `BRAND_NAME`、`BRAND_LOGO_URL`、`CONTACT_EMAIL` 等。

**向运维确认（不必贴密码）：**

- [ ] 服务器 `.env` 是否已写入 SMTP/邮箱变量  
- [ ] `SMTP_USER` 或 `EMAIL_USER` 是否其一为真  
- [ ] 是否已发送一封真实测试邮件（含找回密码流程）  

---

## 4. GitHub 登录

| 侧 | 条件 |
|----|------|
| 前端 | `VITE_GITHUB_LOGIN_ENABLED=true`（`LoginDialog.tsx`、`supertokens-frontend.ts`） |
| 后端 | `GITHUB_CLIENT_ID` 与 `GITHUB_CLIENT_SECRET` **同时**存在才启用 ThirdParty |

- **OAuth App 回调 URL**：以 SuperTokens 与 GitHub 控制台为准，一般为 `https://<apiDomain>/auth/callback/github`（`apiDomain` 即生产上的 `API_PUBLIC_URL` 或同源时的站点 origin）。
- Hash 路由兼容见 `src/app/AuthCallbackPage.tsx`、`AppContent.tsx`（`/auth/callback` 与 `#/auth/callback`）。

若只要邮箱密码：**不要**设 `VITE_GITHUB_LOGIN_ENABLED`，且可不配 GitHub 变量。

---

## 5. 数据库与迁移

- Prisma 默认 SQLite：`schema.prisma` 中 `file:./dev.db`；生产可改为 `DATABASE_URL=postgresql://...`。
- 迁移在 `prisma/migrations/`；本地可参考 `npm run local:prepare`（`prisma migrate deploy`）。
- `prisma/generated/` 已列入 `.gitignore`；克隆或 CI 在安装依赖后会通过 `postinstall` 执行 `prisma generate`。若使用 `npm ci --ignore-scripts`，须显式执行 `npx prisma generate`。
- 根目录 `Dockerfile` 生产镜像：`ENTRYPOINT` 为 `scripts/docker-entrypoint.sh`，容器启动时先执行 `npx prisma migrate deploy`（使用环境变量 `DATABASE_URL`），再执行 `CMD`（默认 `node dist-server/server/index.js`）。若迁移改由外部 Job 执行，可设 `SKIP_PRISMA_MIGRATE=1`。
- 上线前明确：空库 / 已有数据、是否曾仅用 `db push`，再决定 `migrate deploy` 策略。

---

## 6. 安全与运维

| 变量 | 要求 |
|------|------|
| `JWT_SECRET` | 至少 32 字符 |
| `ADMIN_TOKEN` | 至少 16 字符 |
| `VITE_ADMIN_TOKEN` | 与后端管理接口等一致；生产勿用示例值 |
| `COOKIE_DOMAIN` | `server/middleware/csrf.ts` 等；子域共享 Cookie 时按需设置 |

---

## 7. 环境变量加载

- `server/index.ts` 在启动时 `import './config/env'`，对 `server/config/env.ts` 中声明的变量做 Zod 校验；**生产校验失败会退出进程**。
- 可选脚本 `scripts/test-supabase-connection.ts` 使用 `SUPABASE_URL` / `SUPABASE_ANON_KEY`，**不属于主业务路径**；需要时自行在 `.env` 配置并运行，无需写入后端主 env 校验表。

---

## 8. 完善目标（可勾选）

- [ ] 本地：SuperTokens Core + 注册登录 + 找回密码邮件跑通  
- [ ] 生产：同域 Nginx 反代 + `FRONTEND_URL` / `API_PUBLIC_URL` / `TRUST_PROXY` 与 Cookie 一致  
- [ ] 只要邮箱密码，不要 GitHub  
- [ ] 前后端分离：`VITE_SUPERTOKENS_API_DOMAIN` + `API_PUBLIC_URL` + `FRONTEND_URL` 三线对齐  

---

## 9. 支付 / 其他

- 千服 / XPay 相关变量见根目录 `.env.example` 中「支付」一节及 `xpay-code/README-DEPLOY.md`。

---

## 10. 生产域名模板（新增）

- 生产上线流程：`PRODUCTION-DOMAIN-RUNBOOK.md`
- Nginx 同域模板：`deploy/nginx/qianfu.same-domain.conf.example`
- Nginx 分域模板：`deploy/nginx/qianfu.api-domain.conf.example`

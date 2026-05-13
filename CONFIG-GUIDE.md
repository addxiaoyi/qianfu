# 千服：全量配置说明与获取方式

把本文件当作「环境变量 + 外部服务」总表。部署流程勾选项仍见 [DEPLOY-CHECKLIST.md](./DEPLOY-CHECKLIST.md)。

**安全提示：** 真密钥只放在服务器或本机 `.env`，不要提交 Git、不要贴在聊天里。

---

## 第一步：生成你的 `.env`

1. 复制示例：`cp .env.example .env`（Windows 可手动复制 `.env.example` 为 `.env`）。
2. 下表中标记 **必填** 的项，在 `.env` 里改成你自己的值。
3. 后端启动时会加载 `server/config/env.ts` 的校验（生产校验失败会退出）。
4. 前端 **`VITE_*` 变量在 `npm run build` 时打进静态包**，改后需重新构建。

---

## 一、核心运行（几乎总是需要）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `NODE_ENV` | 建议 | `development` / `production` / `test` | 生产设为 `production`。 |
| `PORT` | 否 | Node 监听端口，默认 `3000` | 与反代、防火墙一致即可。 |
| `PORT_STRICT` | 否 | `true` 时首选端口被占则失败，不自动顺延 | 需要固定端口时设 `true`（见 `server/index.ts`）。 |
| `DATABASE_URL` | **是** | Prisma 数据库连接串 | **本地 SQLite：** `file:./prisma/dev.db` 或示例里的 `file:./dev.db`（以 `schema.prisma` 为准）。**生产 PostgreSQL：** 在云平台（RDS、Supabase Postgres、自建等）创建库后，使用官方提供的连接 URL（含用户、密码、主机、库名）。 |
| `JWT_SECRET` | **是** | 至少 32 字符；审计日志 HMAC 等复用 | 用密码管理器或 `openssl rand -hex 32` 生成随机串，勿用示例值。 |
| `ADMIN_TOKEN` | **是** | 至少 16 字符；后端管理接口等 | 随机长串；与前端 `VITE_ADMIN_TOKEN` 保持一致（见下表）。 |
| `LOCAL_AUTH_ONLY` | 否 | `true`/`false`，当前主要在 env 校验与离线/全栈 compose 约定 | 与 [LOCAL_FULLSTACK_INTEGRATION.md](./LOCAL_FULLSTACK_INTEGRATION.md)、docker-compose 一致即可。 |
| `FRONTEND_URL` | **是**（生产） | 用户浏览器访问前端的完整源 URL | 填真实站点，如 `https://www.example.com`。开发默认 `http://localhost:4123`。 |
| `API_PUBLIC_URL` | 条件 | 前后端不同域时，浏览器可访问的 API 根（无路径） | 与 Nginx 对外域名一致，如 `https://api.example.com`；同域可省略。 |
| `TRUST_PROXY` | 生产常见 | `true` 时加强 trust proxy（反代后 IP、HTTPS 识别） | 经 Nginx/Caddy/CDN 反代时通常设 `true`，并正确配置 `X-Forwarded-*`。 |
| `FORCE_HTTPS` | 否 | `true` 时非 HTTPS 请求 301 到 HTTPS | 对外全站 HTTPS 且 Node 能识别 `req.secure`（常配合 `TRUST_PROXY`）时使用。 |
| `COOKIE_DOMAIN` | 否 | 子域共享 Cookie 时，如 `.example.com` | 按域名架构填写；单域可留空。 |

---

## 二、前端构建（`VITE_*`，构建前写入）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `VITE_ADMIN_TOKEN` | 与后台管理功能一起用时 **是** | 如 `AuditLog.tsx` 里管理接口 Bearer | **必须与** 服务端 `ADMIN_TOKEN` **完全一致**（自行生成，勿提交）。 |
| `VITE_API_URL` | 否 | 业务 API 前缀，默认 `/api` | 同域反代保持默认；API 在别的域名时填绝对地址，如 `https://api.example.com/api`。 |
| `VITE_SUPERTOKENS_API_DOMAIN` | 分离部署时 **是** | SuperTokens 前端 `apiDomain` | 与 `API_PUBLIC_URL` 相同（协议+主机+端口）；同域省略。 |
| `VITE_GITHUB_LOGIN_ENABLED` | 否 | `true` 显示 GitHub 登录 | 仅前端开关；后端还需 `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`。 |
| `VITE_BACKEND_URL` | 本地开发 | Vite 把 `/api`、`/auth` 代理到此地址 | Node 若未占 3000，填实际端口，如 `http://localhost:3001`（见控制台提示）。 |
| `VITE_PORT` / `VITE_PREVIEW_PORT` | 否 | 开发 / preview 首选端口 | 默认 4123 / 4124；被占会顺延（`strictPort: false`）。 |
| `VITE_USE_POLLING` | 否 | `1` 时文件监听用轮询（部分 Win/网盘环境） | 卡 HMR 时设 `1`。 |
| `VITE_SIGNATURE_ENABLED` | 否 | `true` 时请求带签名头（需与后端一致） | 与 `SIGNATURE_ENABLED`、`SIGNATURE_SECRET` 同时启用。 |
| `VITE_SIGNATURE_SECRET` | 条件 | 与后端 `SIGNATURE_SECRET` 相同 | 随机密钥，前后端一致。 |
| `VITE_SIGNATURE_NONCE_ENABLED` | 否 | 是否启用 nonce | 与后端签名中间件策略一致。 |
| `VITE_MAX_CACHE_SIZE` / `VITE_CACHE_TTL` | 否 | `useBufferedFetch` 缓存 | 数字字符串；有默认值。 |

---

## 三、SuperTokens Core

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `SUPERTOKENS_CONNECTION_URI` | 本地建议 | Core 地址，默认 `http://127.0.0.1:3567` | 本地：`npm run supertokens:up` 后使用默认。**远程/托管：** 填服务商给的 Core URL。 |
| `SUPERTOKENS_API_KEY` | 否 | Core API Key | 若 Core 开启 Key，在 Core 配置与 Node **两侧** 设相同值（官方文档 / 自建 compose）。 |
| `SUPERTOKENS_APP_NAME` | 否 | 应用显示名 | 默认 `QianFu`，可改品牌名。 |

---

## 四、GitHub OAuth（可选）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `GITHUB_CLIENT_ID` | 成对 | GitHub OAuth App | [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → New OAuth App。 |
| `GITHUB_CLIENT_SECRET` | 成对 | 同上 | 创建 App 后生成 Client secrets，只显示一次，请保存。 |
| **Callback URL** | — | GitHub 后台填写 | 一般为 `https://<你的 apiDomain>/auth/callback/github`（`apiDomain` = `API_PUBLIC_URL` 或同源站点 origin）。以 SuperTokens + GitHub 实际回调路径为准。 |

同时前端设 `VITE_GITHUB_LOGIN_ENABLED=true`。

---

## 五、邮件 SMTP（找回密码、工单通知等）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 条件 | 标准 SMTP | 企业邮箱、SendGrid、阿里云邮件、腾讯企业邮等控制台查看 SMTP 服务器与端口；**应用专用密码** 在邮箱安全设置里生成。 |
| `SMTP_SECURE` | 否 | `true` 通常对应 465 SSL | 按服务商说明。 |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | 否 | `false` 仅调试自签证书 | 生产建议保持默认校验。 |
| `SMTP_FROM` / `EMAIL_FROM` | 建议 | 发件人 | 格式可为 `邮箱` 或 `显示名 <邮箱>`（按服务商要求）。 |
| `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_SERVICE` | 无 `SMTP_HOST` 时 | Nodemailer 内置服务名（如 `gmail`） | Gmail 需在 Google 账号开启应用密码（非普通登录密码）。 |
| `EMAIL_BASE_URL` | 否 | 邮件内绝对链接基准 | 默认可用 `PORT`/`FRONTEND_URL` 推导；工单链接等需与真实前台地址一致。 |
| `BRAND_NAME` / `BRAND_LOGO_URL` / `CONTACT_EMAIL` / `CONTACT_PHONE` | 否 | 邮件模板展示 | 按品牌填写。 |

代码以 **`SMTP_USER` 或 `EMAIL_USER` 是否存在** 判断「是否已配邮件」。

---

## 六、安全 / CORS / CSRF / WAF

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `CORS_ALLOWED_ORIGINS` | 生产建议 | 逗号分隔的允许 Origin | 列出所有前端源，如 `https://app.example.com,https://www.example.com`。 |
| `PREVIEW_URL` | 否 | 生产 CORS 额外允许 | 若有独立预览域名则填写。 |
| `CORS_ORIGIN` | 否 | 旧示例里存在；当前生产以 `CORS_ALLOWED_ORIGINS` + `FRONTEND_URL` 等逻辑为准（见 `server/app.ts`） | 可忽略或与前端源一致。 |
| `CSRF_BYPASS` | 否 | `true` 全局绕过（**极不推荐生产**） | 仅调试。 |
| `CSRF_BYPASS_PATHS` | 否 | 逗号分隔路径白名单 | 特殊回调需排除 CSRF 时慎用。 |
| `CSRF_ALLOWED_ORIGINS` | 否 | 允许的 Origin 列表 | 与前后端实际域名一致。 |
| `WAF_ENABLED` | 否 | `true` 启用简易 WAF | 按需。 |
| `WAF_MAX_REQUESTS` | 否 | 窗口内最大请求数 | 默认 100。 |
| `CSP_REPORT_URI` | 否 | CSP 违规上报地址 | 有收集服务时填写。 |
| `SQL_INJECTION_PROTECTION` | 否 | 设 `false` 可关闭 | 默认开启。 |
| `XSS_PROTECTION` | 否 | 设 `false` 可关闭 | 默认开启。 |

---

## 七、请求签名（可选，前后端同时开）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `SIGNATURE_ENABLED` | 否 | `true` 启用服务端验签 | 与 `VITE_SIGNATURE_ENABLED` 一致。 |
| `SIGNATURE_SECRET` | 启用时 **是** | HMAC 密钥 | 随机长串；与 `VITE_SIGNATURE_SECRET` 相同。 |
| `SIGNATURE_WHITELIST_PATHS` | 否 | 逗号分隔，不参与验签的路径 | 按需。 |

---

## 八、Redis（可选）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `REDIS_URL` | `REDIS_ENABLED=true` 时 **是** | 连接串，如 `redis://localhost:6379` | 云 Redis 控制台复制 URL；Docker 见 `docker-compose` 示例。 |
| `REDIS_ENABLED` | 否 | `true` 启用限流等 Redis 能力 | 与 `REDIS_URL` 同时配置。 |

---

## 九、CMS 同步（可选）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `CMS_URL` | 否 | CMS 基地址 | 自建或 SaaS CMS 提供的 API 根。 |
| `CMS_API_KEY` | 否 | 请求头密钥 | CMS 后台生成 API Key（见 `server/services/syncService.ts`）。 |

---

## 十、支付：千服 QianFu / XPay

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `QIANFU_ENABLED` | 否 | `true` 启用千服签名调用 Java XPay | 与业务需求一致。 |
| `QIANFU_APP_ID` / `QIANFU_SECRET_KEY` | 启用时 | 与 Java 侧 `qianfu.app-id`、`secret-key` **一致** | Java 项目配置或运维提供。 |
| `QIANFU_API_URL` | 否 | Java `qianfu-api` 地址 | 默认 `http://localhost:8888/qianfu-api`；生产改为实际域名端口。 |
| `QIANFU_CALLBACK_URL` | 启用时 | Node 千服回调，须公网可达 | 如 `https://你的域名/api/qianfu/xpay/notify`。 |
| `QIANFU_WHITELIST` | 否 | 逗号分隔 IP/主机 | 回调来源白名单，按部署填写。 |
| `XPAY_API_URL` / `XPAY_NOTIFY_URL` / `XPAY_TOKEN` | 旧版跳转收银台 | `paymentController`、部分回调验签 | 若仍用旧 `/api/payment/create` 链路，与 Java/运维对齐；**QianFuController 回调**里验签用到 `XPAY_TOKEN`（与 Java 约定）。详见 [xpay-code/README-DEPLOY.md](./xpay-3.1_YTM7H/xpay-code/README-DEPLOY.md)。 |

---

## 十一、钱包与其它业务密钥

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `WALLET_SECRET` | 生产建议 | 钱包相关 HMAC | `openssl rand -hex 32` 等生成，勿用默认值。 |
| `ALLOW_DIRECT_WALLET_RECHARGE` | 否 | `true` 允许直充逻辑 | 见 `server/routes/wallet.ts`，生产谨慎开启。 |
| `ENCRYPTION_KEY` / `MASTER_KEY` | 若用到对应加密工具 | 数据加密 | 随机 32 字节类密钥（按 `server/utils/encryption.ts` 要求）。 |
| `MODERATION_ENCRYPTION_KEY` | 若审核功能需要 | 审核配置加密 | 生产必须设置（见 `server/services/configService.ts`）。 |

---

## 十二、AI / 审核（智谱，可选）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `ZHIPU_API_KEY` | 使用 AI 接口时 | 智谱开放平台 API Key | [智谱 AI 开放平台](https://open.bigmodel.cn/) 注册 → API Keys。 |

---

## 十三、Motia（可选）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `MOTIA_ENABLED` | 否 | `true` 启用 Motia 集成 | 见 `server/index.ts`、`server/services/motiaService.ts`。 |
| `MOTIA_URL` | 否 | Motia 服务地址 | 默认 `http://localhost:3005`，按实际服务修改。 |

---

## 十四、一次性管理 / 初始化

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `ADMIN_SETUP_ALLOW_IPS` | 否 | 允许执行初始化接口的 IP 列表 | 生产限制为你的办公出口 IP。 |
| `SYSTEM_SETUP_TOKEN` | 若使用该流程 | 初始化接口的令牌 | 强随机串，用后即废或轮换。 |

---

## 十五、TLS 直连 Node（不经过反代终止 HTTPS 时）

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `SSL_ENABLED` | 否 | `true` 启用 HTTPS Server | 见 `server/config/ssl.ts`。 |
| `SSL_KEY_PATH` / `SSL_CERT_PATH` / `SSL_CA_PATH` | 条件 | 证书与私钥路径 | Let's Encrypt、`acme.sh` 或云证书下载到服务器路径。 |

---

## 十六、日志与其它

| 变量 | 必填 | 用途 | 如何获取 / 填写 |
|------|------|------|----------------|
| `LOG_LEVEL` | 否 | 如 `debug` / `info` / `warn` / `error` | 按需。 |

---

## 十七、仅脚本 / 非主应用

| 变量 | 用途 | 如何获取 |
|------|------|----------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | `scripts/test-supabase-connection.ts` | [Supabase](https://supabase.com/) 项目 Settings → API。 |
| `BACKEND_URL` / `XPAY_URL` | `scripts/verify-local-closed-loop.ts` 等 | 填本地或测试环境 URL。 |

---

## 十八、`.env.example` 里曾出现但代码未读取的项

| 变量 | 说明 |
|------|------|
| `JWT_EXPIRES_IN` | 当前 TypeScript 业务路径未检索到使用；可删或保留备忘。 |
| `PROBE_API_KEY` | 服务端未检索到使用；若未来加探针鉴权可再用。 |

---

## 十九、非环境变量：你还需准备什么

| 项目 | 如何准备 |
|------|----------|
| **SuperTokens Core** | `npm run supertokens:up` 或自建/托管 Core，保证 `SUPERTOKENS_CONNECTION_URI` 可达。 |
| **数据库迁移** | 生产首次：`npx prisma migrate deploy`（先备份，确认空库/已有迁移历史）。 |
| **Nginx / Caddy** | 反代 `/`、`/api`、`/auth` 到 Node 或前后端分离目标；配置 `proxy_set_header X-Forwarded-Proto $scheme` 等。 |
| **GitHub OAuth App** | 见第四节。 |
| **SMTP** | 见第五节。 |
| **Java XPay** | 按 `xpay-code/README-DEPLOY.md` 编译部署，与 `QIANFU_*` 对齐。 |

---

## 二十、过时脚本说明

`scripts/validate-env.ts` 仍要求 `XPAY_TOKEN`、`XPAY_API_URL`、`XPAY_NOTIFY_URL` 等为必填，与当前「可仅用 QianFu + SuperTokens」的栈**不一定一致**。日常以 `server/config/env.ts` 与本文为准；若运行该脚本，请按脚本内列表补齐或自行改脚本。

---

**最小可跑本地闭环（参考）：** `DATABASE_URL` + `JWT_SECRET`（≥32）+ `ADMIN_TOKEN`（≥16）+ SuperTokens Core + `FRONTEND_URL`；邮件与 GitHub、支付按功能再逐项打开。

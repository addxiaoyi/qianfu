# 千服 v2 Rust 基础架构

这是新后端的并行迁移入口，当前不替换现有 Node 服务。

## Workspace

- `apps/api`: Axum HTTP API
- `apps/worker`: 异步任务进程，后续承载 DNS、邮件、媒体和状态探测任务
- `crates/core`: 共享响应模型、错误码、发布校验、任务状态和 OAuth PKCE 基础类型

## Local checks

```bash
cargo fmt --all -- --check
cargo test --workspace
```

## Run

Copy `.env.example` to an untracked environment file, fill the required values,
then run `docker compose --env-file .env.local up --build`. The API is exposed
on `http://127.0.0.1:3100`; the compose health gate waits for PostgreSQL before
starting either process.

Set the required production configuration before starting either process:

```powershell
$env:QF_DATABASE_URL = "postgres://user:password@127.0.0.1/qianfu"
$env:QF_SESSION_SECRET = "replace-with-a-long-random-value"
```

Optional provider settings are passed to the worker through Compose for
Cloudflare, Alibaba Cloud DNS, SMTP, and R2. GitHub OAuth settings are passed
to the API. Secrets are never serialized by the core config type and are
redacted from `Debug` output.

Cookies are `Secure` by default. For local HTTP-only development, set
`QF_COOKIE_SECURE=false`; never disable this setting in production.

When the frontend and API use separate origins, set `QF_ALLOWED_ORIGINS` to a
comma-separated exact-origin allowlist (for example,
`https://mc-u.top,https://www.mc-u.top`). The default remains same-origin only.

The Compose deployment forwards `QF_ALLOWED_ORIGINS`, `QF_COOKIE_SECURE`, and
the `QF_SMTP_*` variables directly to the relevant services; keep these values
in an external secret/environment file rather than committing them.
Set `QF_METRICS_TOKEN` in production to require `Authorization: Bearer ...`
for `/metrics`; leaving it unset is intended only for trusted local networks.

```bash
cargo run -p qianfu-api
curl http://127.0.0.1:3100/api/v2/health
```

默认监听 `127.0.0.1:3100`，可通过 `QF_API_ADDR` 覆盖。

当前提供无副作用的发布校验接口：

```text
POST /api/v2/servers/validate-publish
```

它只规范化名称、简介、Java/基岩版地址、端口、QQ群和封面 URL，不写数据库、不调用 DNS、不探测目标地址。正式发布接口需要在接入 Session、权限和 PostgreSQL 事务后开放。

当前 v2 已提供账号、服务器、DNS 域名绑定、邮件验证、GitHub OAuth、R2
媒体处理与 Minecraft 探测能力。切流仍应以双跑、回滚演练和真实第三方
凭据验收为前提；前端仅会把已实现的 v2 路由切换到 Rust，其他路径继续走
现有 v1 服务。

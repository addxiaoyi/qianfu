# 千服生产域名上线 Runbook

本文给出最短路径：同域反代与分域部署两种方案。变量名与代码保持一致。

## 1. 上线前固定三件事

1. 定域名：`FRONTEND_URL`（用户访问前端）与 `API_PUBLIC_URL`（浏览器访问 API 根）。
2. 定反代：是否同域代理 `/api`、`/auth`。
3. 定构建机变量：所有 `VITE_*` 必须在 `npm run build` 前写入。

## 2. 推荐方案（同域）

- 对外：`https://www.example.com`
- Nginx 负责静态文件并反代 `/api`、`/auth` 到 Node `127.0.0.1:3000`
- 后端关键变量：
  - `NODE_ENV=production`
  - `FRONTEND_URL=https://www.example.com`
  - `TRUST_PROXY=true`
  - `FORCE_HTTPS=true`（TLS 在边缘终止时建议）
- 前端构建变量：
  - `VITE_API_URL=/api`

## 3. 分域方案（前后端分离）

- 前端：`https://www.example.com`
- API：`https://api.example.com`
- 后端关键变量：
  - `FRONTEND_URL=https://www.example.com`
  - `API_PUBLIC_URL=https://api.example.com`
  - `CORS_ALLOWED_ORIGINS=https://www.example.com,https://example.com`
  - `TRUST_PROXY=true`
  - `FORCE_HTTPS=true`
- 前端构建变量：
  - `VITE_API_URL=https://api.example.com/api`
  - `VITE_SUPERTOKENS_API_DOMAIN=https://api.example.com`

## 4. 证书与反代

- 证书建议由 Nginx/Caddy 持有，Node 走内网 HTTP。
- 反代必须转发：
  - `Host`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`

## 5. 生产安全最小集

- 必改密钥：`JWT_SECRET`、`ADMIN_TOKEN`、`XPAY_TOKEN`、`SUPERTOKENS_API_KEY`（启用时）。
- 禁止：`CSRF_BYPASS=true`。
- 建议：`CALLBACK_OUTBOUND_HTTPS_ONLY=true`。
- 如需浏览器调用探测服务：设置 `INTELLIGENT_PROBE_CORS_ORIGINS` 为前端域名。

## 6. 发布顺序

1. 准备服务器 `.env`（参考 `.env.example` 底部生产模板）。
2. 在构建机写入 `VITE_*` 并执行 `npm run build`。
3. 启动后端（Node）并确认 `/health`。
4. 应用 Nginx 配置并 reload。
5. 验收：
   - 首页加载
   - 注册/登录
   - `/auth` 回调
   - 关键写操作（验证 CSRF）
   - 支付回调连通

## 7. 模板位置

- 同域 Nginx：`deploy/nginx/qianfu.same-domain.conf.example`
- 分域 Nginx（API）：`deploy/nginx/qianfu.api-domain.conf.example`
- 主清单：`DEPLOY-CHECKLIST.md`
- 全量变量：`CONFIG-GUIDE.md`

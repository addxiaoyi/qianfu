# 认证安全升级（HttpOnly Phase 1）- 2026-05-26

## 背景

- 当前前端已从 `localStorage` 降级到 `sessionStorage`，但最终目标是 HttpOnly Cookie 认证。

## 本轮落地（兼容阶段）

1. 登录写入 HttpOnly Cookie
- 文件：`server/controllers/authController.ts`
- 行为：本地登录成功后，除返回 JSON token 外，同时设置：
  - `LOCAL_AUTH_COOKIE_NAME`（默认 `qf_auth_token`）
  - `httpOnly=true`
  - `secure` 按 `NODE_ENV`
  - `sameSite` 按 `NODE_ENV`
  - `maxAge=7d`

2. 鉴权支持 Cookie + Bearer 双通道
- 文件：`server/middleware/auth.ts`
- 行为：本地 JWT 优先读取 Bearer，其次读取 HttpOnly Cookie。

3. 登出清理 Cookie
- 文件：`server/controllers/authController.ts`
- 行为：登出时清除：
  - `mu_token`
  - `mu_refresh_token`
  - `LOCAL_AUTH_COOKIE_NAME`

## 新增环境变量

- `.env.example`
  - `LOCAL_AUTH_COOKIE_NAME=qf_auth_token`

## 后续 Phase 2 建议

1. 前端逐步去除对 `token` 字段的强依赖，默认走 Cookie 会话。
2. 对高风险写接口补 `CSRF` 双提交/同源防护校验。
3. 登录响应可选不再回传 token（纯 Cookie 模式），减少前端泄露面。

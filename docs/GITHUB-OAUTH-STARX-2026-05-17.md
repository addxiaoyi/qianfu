# 2026-05-17 GitHub OAuth / STAR-X

## 已完成

- 前端 GitHub 登录入口不再依赖 `VITE_GITHUB_OAUTH_URL`
- 现改为先请求后端 `/api/v1/auth/oauth-status`
- 再跳转到后端 `/api/v1/auth/github/start`
- 后端手动完成 GitHub OAuth code 交换，并签发本地 JWT
- 前端回调页：
  - `/#/oauth/callback/github`
- 已部署到 `103.236.92.10`

## 当前线上配置

- `FRONTEND_URL = http://mc-u.top`
- `API_PUBLIC_URL = http://mc-u.top`
- `GITHUB_CLIENT_ID` 已写入远端 `.env`
- `GITHUB_CLIENT_SECRET` 已写入远端 `.env`

## 当前已验证

- `GET /api/v1/auth/oauth-status` 返回 `github.backendEnabled = true`
- `github.loginUrl = http://mc-u.top/api/v1/auth/github/start`
- `github.expectedCallback = http://mc-u.top/api/v1/auth/github/callback`
- `GET /api/v1/auth/github/start` 返回 `302`
- 公网访问 `http://mc-u.top/api/v1/auth/oauth-status` 返回 `200`
- 公网访问 `http://mc-u.top/api/v1/auth/github/start` 返回 `302`
- 人工回调错误路径验证：
  - `http://mc-u.top/api/v1/auth/github/callback?error=access_denied...`
  - 会正确 `302` 回前端 `/#/oauth/callback/github?...`
- 公网入口 `http://mc-u.top` 已恢复为千服前端，不再是默认 nginx 欢迎页

## 仍需你在 GitHub 后台确认

GitHub OAuth App 的 Authorization callback URL 应为：

- `http://mc-u.top/api/v1/auth/github/callback`

如果 GitHub 后台不是这个地址，最终授权会在 GitHub 侧报错。

## 相关代码

- `server/controllers/githubAuthController.ts`
- `server/routes/auth.ts`
- `server/bootstrap/healthRoutes.ts`
- `qianfu-liandeng/src/auth/githubOAuth.ts`
- `qianfu-liandeng/src/pages/auth/OAuthCallback.tsx`
- `qianfu-liandeng/src/pages/Login.tsx`
- `qianfu-liandeng/src/pages/auth/OAuthSelection.tsx`
- `qianfu-liandeng/src/store/authStore.ts`

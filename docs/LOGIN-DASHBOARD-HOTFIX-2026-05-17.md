# 2026-05-17 登录 / Dashboard 热修复

## 现象

- 登录后用户感知为“没反应”
- 控制台报错：
  - `Uncaught TypeError: t?.id.slice is not a function`
- 首页匿名访问时，统计卡片长期显示 `—`
- Dashboard 地址曾被错误改写成 `/#/dashboard/*`

## 根因

1. 前端默认把用户 `id` 当作字符串使用
   - 但后端返回的是数字 `id`
   - `Dashboard.tsx` 和 `Profile.tsx` 直接调用 `slice()` 导致运行时崩溃

2. 首页统计接口兼容不完整
   - 老前端请求 `/api/servers/stats`
   - 服务端运行路由顺序让 `/servers/:id` 抢先吞掉了 `/servers/stats`
   - 同时首页前端对统计响应没有拆 envelope 的 `data`

3. Dashboard 路由有错误重定向
   - `App.tsx` 存在 `/dashboard -> /dashboard/*`
   - 导致地址栏落成字面量 `*`

4. 风控误伤自动化/验收流
   - `antiCrawler` 对以下前端必经路径误判：
     - `/api/servers/stats`
     - `/api/v1/profile`
     - `/api/v1/auth/login`

## 已修复

- 新增 `qianfu-liandeng/src/utils/user.ts`
  - 统一把后端返回的用户 `id` 标准化为字符串
  - 提供 `formatUserId()` 供展示层安全使用

- 修复前端用户态与页面
  - `qianfu-liandeng/src/store/authStore.ts`
  - `qianfu-liandeng/src/pages/Login.tsx`
  - `qianfu-liandeng/src/pages/VerifyEmail.tsx`
  - `qianfu-liandeng/src/pages/auth/OAuthCallback.tsx`
  - `qianfu-liandeng/src/pages/Dashboard.tsx`
  - `qianfu-liandeng/src/pages/Profile.tsx`

- 修复首页统计
  - `qianfu-liandeng/src/pages/Home.tsx`
  - 改为使用统一 `request('/servers/stats')`，正确读取响应 `data`

- 修复 Dashboard 路由
  - 删除 `qianfu-liandeng/src/App.tsx` 中错误的 `/dashboard/*` 重定向
  - 修复 `RedirectIfAuthed`
    - 已登录状态访问 `/login` / `/register` 时，统一跳到 `/dashboard`
    - 不再错误返回首页

- 修复服务端兼容与风控
  - `server/routes/index.ts`
    - 让 `statsRoutes` 在 `serversRoutes` 之前挂载
    - 直接兼容 `/api/servers/stats`
  - `server/middleware/antiCrawler.ts`
    - 放行登录、会话探测、首页统计等前端必经路径

- 修复匿名首页启动噪音
  - `qianfu-liandeng/src/store/authStore.ts`
  - 无本地 `qf_local_auth_token` 时，不再主动探测 `/api/v1/profile`
  - 首页匿名访问控制台不再出现 401

## 已上线

- 前端静态资源已部署到：
  - `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
- 当前线上入口：
  - `index-De6qdPrw.js`

- API 运行文件已更新并重启：
  - `/www/wwwroot/qianfu-app/dist-server/server/routes/index.js`
  - `/www/wwwroot/qianfu-app/dist-server/server/middleware/antiCrawler.js`
  - `pm2 restart qianfu-api`

## 冒烟结果

- 首页：
  - `GET /api/v1/servers/stats -> 200`
  - 页面统计已显示：
    - 在线节点 `0`
    - 同步延迟 `<1s`
    - 响应时间 `18ms`
    - 可用性 `0%`

- 登录：
  - `POST /api/v1/auth/login -> 200`
  - 成功获得本地 JWT
  - 登录完成后正确跳转到 `/#/dashboard`

- Dashboard：
  - 地址正确为 `/#/dashboard`
  - 左侧用户卡显示 `ID: 5`
  - 不再出现 `id.slice` 崩溃

- 账号设置：
  - `GET /api/v1/profile -> 200`
  - 页面正常显示 `ID #5`

## 当前剩余项

- 当前主登录链路、首页统计、Dashboard、Profile 已完成闭环。
- 若继续收尾，优先项应转到：
  - GitHub OAuth 全流程真人授权再验一轮
  - 把已暴露的 GitHub client secret 轮换掉

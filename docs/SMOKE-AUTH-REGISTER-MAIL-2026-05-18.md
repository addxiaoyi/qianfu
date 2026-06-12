# 2026-05-18 冒烟测试：登录 / 注册 / 用户逻辑 / 邮件发送 / 验证码

## 范围

- 目标环境：`https://mc-u.top`
- 测试链路：
  - OAuth 状态与跳转
  - 密码登录
  - 用户资料读取
  - 用户名可用性检查
  - 新用户注册
  - 新用户登录
  - 验证码发送（邮箱）
  - 管理员邮件配置读取
  - 管理员测试发信

## 本次修复（已部署）

1. 注册接口与前端不一致修复
   - 文件：`server/controllers/registerController.ts`
   - 改动：
     - 新用户注册不再强制 `code`
     - 已存在用户补全注册时仍强制 `code`
   - 原因：
     - 前端注册页未提交验证码，线上注册会直接失败

2. SQL 注入误报修复
   - 文件：`server/utils/sanitizer.ts`
   - 改动：
     - 移除过宽匹配关键词 `script`
   - 原因：
     - 管理员测试发信文本正常内容被误拦，返回 `Potential SQL injection attack detected`

3. 热修部署脚本
   - 文件：`scripts/linux/deploy-hotfix-auth-mail.py`
   - 作用：
     - 上传编译后的热修文件到服务器
     - 重启 `pm2 qianfu-api`
   - 安全约束：
     - 不再内置默认 SSH 密码
     - 必须通过环境变量 `QF_DEPLOY_PASSWORD` 注入

4. 新增综合烟测脚本
   - 文件：`scripts/smoke-auth-register-mail.ts`
   - 覆盖：
     - 登录、注册、验证码发送、邮件测试、profile、oauth 状态
   - 细节：
   - 处理 CSRF token + Cookie 同会话，避免伪失败

## 2026-05-18 追加修复（本地已验证，待部署）

1. 注册验证码闭环修复
   - 文件：
     - `server/controllers/registerController.ts`
     - `server/controllers/authCodeController.ts`
     - `server/controllers/userController.ts`
     - `qianfu-liandeng/src/pages/Register.tsx`
     - `qianfu-liandeng/src/pages/VerifyEmail.tsx`
   - 改动：
     - 新用户注册创建 `email_verified=false` 的账号
     - 注册时立即生成 6 位邮箱验证码，数据库只保存 HMAC 后的验证码
     - 注册响应返回本地 JWT 和未脱敏的安全用户对象
     - 验证码校验成功后返回本地 JWT 和最新用户对象
     - `/profile` 响应不再二次脱敏 `email` / `email_verified`
     - 前端注册成功后保存 token/user，并跳转到 `/verify-code?email=...`
   - 发现并修复：
     - `registerController.ts` 的旧 `require('crypto')` 在 ESM 运行时会触发 500
     - `sendSuccess` 默认二次脱敏会把 `email_verified` 变成 `***MASKED***`

2. 热修部署脚本补齐
   - 文件：`scripts/linux/deploy-hotfix-auth-mail.py`
   - 改动：
     - 上传 `authCodeController.js`
     - 上传 `userController.js`
     - 上传当前 `qianfu-liandeng/dist`
   - 当前状态：
     - 本地 `QF_DEPLOY_PASSWORD` 未设置
     - `ssh -o BatchMode=yes root@103.236.92.10` 返回 `Permission denied (password)`
     - 因此本轮追加修复尚未远端上线

## 部署动作（103.236.92.10）

- 上传文件：
  - `/www/wwwroot/qianfu-app/dist-server/server/controllers/registerController.js`
  - `/www/wwwroot/qianfu-app/dist-server/server/controllers/registerController.js.map`
  - `/www/wwwroot/qianfu-app/dist-server/server/utils/sanitizer.js`
  - `/www/wwwroot/qianfu-app/dist-server/server/utils/sanitizer.js.map`
- 重启：
  - `pm2 restart qianfu-api`
- 结果：
  - `qianfu-api` 在线，重启成功

## 冒烟结果

### A. 综合认证/注册/邮件脚本

- 命令：`npx tsx scripts/smoke-auth-register-mail.ts`
- 结果：`PASS（1项 WARN）`
- 通过项：
  - `oauth-status`
  - `password-login`
  - `csrf-token`
  - `profile`
  - `check-username`
  - `register`
  - `login-new-user`
  - `send-code-email`
  - `mail-config`
  - `mail-config-test-send`
- 警告项：
  - `email-inbox-delivery`
  - 说明：当前脚本默认注册邮箱域名是 `example.com`，只验证“接口成功发起发送”，不验证真实收件箱到达

### B. 现有 Web 流程脚本

- 命令：`npx tsx scripts/smoke-web-flows.ts`
- 结果：`PASS`
- 通过项：
  - 首页加载
  - OAuth start/callback 错误跳转
  - 密码登录
  - profile
  - mail-config / mail-library
  - payment-projects / payment-my
  - qiu-pay health

### C. 本地写入型注册/签到冒烟

- 目标：`http://127.0.0.1:43101`
- 数据库：临时 SQLite 副本 `C:\Users\l\AppData\Local\Temp\qianfu-smoke-dev.db`
- 结果：`PASS`
- 通过项：
  - 注册返回 `email_verified=false`
  - 注册返回本地 JWT
  - `/profile` 可用 JWT 回读真实邮箱和等级字段
  - 注册后立即重发验证码返回 `429`，符合 60 秒限流预期
  - 错误验证码被 `400` 拒绝
  - 首次签到返回 `gainedXp=25`
  - 签到后 `/profile.level_progress=0.8333333333333334`
  - 同日重复签到返回 `alreadyCheckedIn=true`

## 产物

- `logs/smoke-auth-register-mail-2026-05-17T23-44-44-522Z.json`
- `logs/smoke-web-flows-2026-05-17T23-44-55-925Z.json`

## 2026-05-18 等级/签到/注册跳转追加上线

### 修复内容

- `/api/user/checkin/status` 现在同时返回 `checkedInToday`、`todaySigned`、`rewardXp`，避免前端读取不到今日签到状态。
- `/api/user/checkin` 成功和重复签到响应都补齐 `checkedInToday`、`rewardXp`、`checkinAt`，Dashboard、Billing、移动端能即时刷新等级和签到状态。
- 前端把后端返回的 `level_progress` 0-1 比例转换为 0-100 百分比显示，避免等级进度显示成 0%。
- 已登录但未验证邮箱的用户访问 `/login` 或 `/register` 时不再被送到 `/dashboard`，而是跳到 `/verify-code?email=...`。
- 移动端路由补齐 `/verify-code`，防止移动端未验证用户无法进入验证中心。

### 部署结果

- 远端：`103.236.92.10`
- 前端目录：`/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
- 后端进程：`pm2 qianfu-api`
- 部署方式：
  - 前端 dist 压缩包上传后远端 `rsync --delete` 替换
  - `userLevelController.js` 上传后重启 `qianfu-api`
- 验证：
  - `qianfu-api` online
  - `nginx -t` 成功并 reload
  - `https://mc-u.top/api/health` 返回 healthy/ready
  - `/assets/index-*.js` 返回 `application/javascript`

### 新烟测产物

- `logs/smoke-web-flows-live-levelcheckin-2026-05-18.json`：PASS，failedCount=0。
- `logs/smoke-auth-register-mail-live-levelcheckin-2026-05-18.json`：PASS，failedCount=0，测试邮件已被发信接口接受。
- `logs/live-browser-smoke-levelcheckin-2026-05-18.json`：Dashboard 登录、无 JS 崩溃、移动端 overflow=0 通过；其中注册子项因为复用已登录浏览器上下文产生无效失败。
- `logs/live-register-verifyroute-fixed-2026-05-18.json`：PASS，新注册用户最终落到 `/#/verify-code?email=...`，验证码 UI 可见，无控制台错误。

### 仍需人工确认

- 登录 `testuser@0st.top` 收件箱确认最新注册验证码和测试邮件实际到达；脚本只能证明 SMTP/API 接受发送，不能代替收件箱检查。

## 复现命令

```bash
npx tsx scripts/smoke-auth-register-mail.ts
npx tsx scripts/smoke-web-flows.ts
```

## 剩余人工确认（投入生产前）

1. 用真实邮箱执行一轮注册+验证码并确认收件箱到达（含垃圾箱）
2. GitHub OAuth 真人授权全流程（从点击到回跳落地）
3. 轮换已暴露的 OAuth client secret 与 SMTP/Brevo 密钥（安全项）

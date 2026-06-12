# 移动端表单刷新问题：线上阻塞排查记录（2026-05-21）

## 目标
- 修复 `https://mc-u.top/#/mobile` 在手机端“填写表单后偶发整页刷新/回跳”的问题。
- 确认是否已将本地修复版前端构建发布到生产。

## 关键结论
1. 线上当前仍在使用旧前端入口资源：
   - `assets/index-B1qqGAQb.js`
2. 本地已修复构建入口为：
   - `assets/index-D9_NCsbw.js`
3. 因此用户仍会看到旧行为，核心不是“修复代码不存在”，而是“生产静态资源未切换到新构建”。

## 已做验证（本轮）

### 1) 线上资源哈希核验
- 命令：
  - `Invoke-WebRequest https://mc-u.top/` 并提取 `assets/index-*.js`
- 结果：
  - 返回 `assets/index-B1qqGAQb.js`（旧包）
- 覆盖页面：
  - `/#/mobile/login`
  - `/#/mobile/register`
  - `/#/mobile/tickets/create`
  - `/#/mobile/user`
  - `/#/mobile/payment`
- 均引用相同旧包 `index-B1qqGAQb.js`

### 2) 公共表单移动端交互检查（线上）
- 脚本：`scripts/ui-mobile-public-input-check.cjs`
- 目标：`QA_BASE_URL=https://mc-u.top`
- 结果：
  - `total=2, failed=0`
  - 登录页输入与找回密码页输入在脚本路径下未复现跳路由
- 说明：
  - 该检查覆盖的是公开页面输入行为，不能替代完整“登录后每个业务表单”验证。

### 3) 登录后全量移动检查（线上）
- 脚本：
  - `scripts/ui-mobile-interaction-audit.cjs`
  - `scripts/ui-full-audit.cjs`
- 结果：
  - 均在“测试账号登录失败/无 token”阶段中断。
- 说明：
  - 线上环境没有可直接复用的 QA 账号凭据，导致无法自动化跑完登录后页面输入路径。

## 生产发布阻塞（本轮）

### 1) SSH/SFTP 通道不可用（从当前执行环境）
- 尝试端口：`22 / 10022 / 2022 / 8022`
- 现象：
  - TCP 层可连通，但在 SSH 握手阶段被远端直接断开。
  - OpenSSH 报错：`kex_exchange_identification: Connection closed by remote host`
  - Paramiko 报错：`Error reading SSH protocol banner`
  - plink 报错：`Remote side unexpectedly closed network connection`
- 结论：
  - 当前出口环境被远端策略拒绝（非口令错误），导致无法执行自动上传与 `pm2` 重启。

### 2) 宝塔面板公开入口不可达（从当前执行环境）
- 探测地址：
  - `http(s)://103.236.92.10:8888`
  - `http(s)://mc-u.top:8888`
  - `http(s)://103.236.92.10:7800`
  - `http(s)://mc-u.top:7800`
- 结果：
  - `ERR_EMPTY_RESPONSE` / `ERR_CONNECTION_CLOSED`
- 结论：
  - 无法通过公网面板入口替代 SSH 完成发布。

## 当前可执行下一步
1. 获取一个当前环境可用的生产发布通道（任一）：
   - 放通 SSH 白名单（当前执行出口）
   - 提供可访问的宝塔入口地址（含非默认端口）
   - 提供服务器内可执行的一次性发布触发器
2. 一旦通道可用，立即执行：
   - 上传 `qianfu-liandeng/dist` 到 `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
   - 重启 `qianfu-api`（如需）并做 Nginx reload
   - 再次核验首页哈希已切为 `index-D9_NCsbw.js`
   - 复跑移动端输入交互脚本 + 浏览器抽检

## 风险说明
- 在生产仍为 `index-B1qqGAQb.js` 的前提下，用户仍可能持续触发旧版移动端刷新问题。
- 该问题不能通过本地修复“自动生效”，必须完成线上静态资源替换。

## 2026-05-21 续处理：生产已恢复
- 发布通道改用 `mc-u.top` SSH，生产前端入口已切换为：
  - `/assets/index-b9ER-Rd3.js`
  - `/assets/index-DtOwDTa9.css`
- `502 Bad Gateway` 根因确认：
  - MySQL 被 OOM killer 杀掉，`qianfu-api` 连接 `127.0.0.1:3306` 报 Prisma `P1001`。
  - 服务器存在大量残留 PM2 守护/自更新进程，导致内存与 swap 被打满。
- 已执行恢复：
  - 清理残留 PM2 守护和 `pm2 update` 进程。
  - `systemctl start mysqld` 恢复 MySQL。
  - `pm2 save && pm2 kill && pm2 resurrect` 收敛到单个 PM2 daemon。
  - 新增 `/swapfile2`，总 swap 约 2GB。
- 已验证：
  - `https://mc-u.top/api/health` 返回 `200 healthy`。
  - `https://mc-u.top/api/ready` 返回 `200 ready`。
  - `scripts/ui-mobile-public-input-check.cjs` 连跑 5 次，全部 `failed=0`。
  - `scripts/ui-mobile-interaction-audit.cjs` 连跑 3 次，全部 `failed=0`。
  - `scripts/ui-full-audit.cjs` 覆盖 47 条桌面/移动/登录后路由，`failed=0`。
- 已补运维脚本：
  - `scripts/linux/qianfu-prod-healthcheck.sh`
  - `npm run prod:healthcheck`
  - 线上部署位置：`/www/wwwroot/qianfu-app/scripts/linux/qianfu-prod-healthcheck.sh`
- 已挂生产巡检 cron：
  - `*/5 * * * * /www/wwwroot/qianfu-app/scripts/linux/qianfu-prod-healthcheck.sh >> /www/wwwroot/qianfu-app/logs/prod-healthcheck.log 2>&1`
  - 最新手动写入日志结果为 `OK: all checks passed for https://mc-u.top`。

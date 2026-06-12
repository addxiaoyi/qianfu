# 2026-05-16 宝塔部署状态（103.236.92.10）

## 目标机器

- IP: `103.236.92.10`
- 系统: `Ubuntu 24.04`
- 面板: 宝塔 Linux 面板
- Nginx 主配置: `/www/server/nginx/conf/nginx.conf`
- 站点配置目录: `/www/server/panel/vhost/nginx/`
- 应用目录: `/www/wwwroot/qianfu-app`

## 已完成

1. 已接入宝塔默认站点
   - 已替换 `/www/server/panel/vhost/nginx/0.default.conf`
   - 站点根目录指向 `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
   - 已配置：
     - `/api/` -> `127.0.0.1:3001`
     - `/xpay/` -> `127.0.0.1:8889`
     - `/admin/` -> `127.0.0.1:8889`
     - `/open/` -> `127.0.0.1:8889`
     - `/assets/css/`
     - `/assets/images/`
     - `/assets/js/`
     - `/assets/qr/`

2. 运行时已部署
   - `dist-server`
   - `qianfu-liandeng/dist`
   - `prisma/dev.db`
   - `packages/shared`
   - `xpay-code/target/xpay-3.1.0.jar`
   - `xpay-code/sql/init.sql`

3. 依赖已补齐
   - `openjdk-17-jre-headless`
   - `pm2`
   - Redis 二进制已安装，`127.0.0.1:6379` 已有可用进程

4. 数据库已处理
   - 宝塔 MySQL root 密码已恢复为 `admin`
   - `xpay` 数据库已初始化
   - SQLite `AuditLog` 缺失列已补齐

5. 进程状态
   - `qianfu-api`：`pm2` 在线
   - `qianfu-xpay`：`pm2` 在线

## 已验证

### 内部访问（服务器本机）

- `http://127.0.0.1:3001/api/health` -> `200`
- `Host: 103.236.92.10` + `http://127.0.0.1/` -> 前端 `index.html`
- `Host: 103.236.92.10` + `http://127.0.0.1/api/health` -> `200`
- `Host: 103.236.92.10` + `http://127.0.0.1/xpay/` -> `200`
- `POST http://127.0.0.1:3001/api/v1/auth/login`
  - `dev_local / dev123456`
  - 登录成功
- `POST http://127.0.0.1:8889/admin/auth/local/login`
  - `xpayadmin / olutBYFB2271`
  - 登录成功

### 租户模式闭环

- `qianfu` 项目已切到 `xpay-tenant`
- 测试单创建成功：
  - `provider = xpay-tenant`
  - `paymentUrl = http://103.236.92.10/xpay/open/tenants/qianfu/orders/{orderId}/pay`
- `POST /open/gateway/tenants/qianfu/orders/{orderId}/notify`
  - 网关签名验证通过
  - XPay 订单 `callbackStatus = SUCCESS`
  - 主站订单 `status = COMPLETED`

### 域名模式（mc-u.top）

- `mc-u.top` 当前已解析到：
  - `103.236.92.10`
- 已新增宝塔域名站点：
  - `/www/server/panel/vhost/nginx/mc-u.top.conf`
- 服务器内部按 Host 头验证：
  - `Host: mc-u.top` + `/` -> `200`
  - `Host: mc-u.top` + `/api/health` -> `200`
  - `Host: mc-u.top` + `/xpay/` -> `200`
- 支付项目公开 URL 已切换：
  - `xpayGatewayBaseUrl = http://mc-u.top/xpay`
  - `xpayApiUrl = http://mc-u.top/xpay/starmc/pay`
  - `xpayNotifyUrl = http://mc-u.top/api/v1/payment/xpay/notify`
- 新测试单返回：
  - `paymentUrl = http://mc-u.top/xpay/open/tenants/qianfu/orders/{orderId}/pay`
- 域名模式下网关通知闭环仍成功：
  - 主站订单 `COMPLETED`
  - XPay 订单 `callbackStatus = SUCCESS`

## 关键修复

1. `packages/shared` 缺失
   - 远端补齐后，`qianfu-api` 才能真正启动

2. `xpay` 启动脚本不能直接 `source .env`
   - `.env` 里有空格值和 JDBC URL 的 `&`
   - 已改成启动脚本自行解析 `.env` 再导出环境变量

3. `xpay` 外部二维码目录
   - 已给 Java `WebMvcConfig` 增加 `/assets/qr/**` 外部静态映射
   - 这样租户二维码上传后能从磁盘直接被 Spring Boot 提供

## 当前外部阻塞

公网直接访问：

- `http://103.236.92.10/`
- `http://103.236.92.10/api/...`

仍会被上游拦截成“该网站暂无法访问 / 未备案”的默认提示页。

这不是应用没部署，而是机房/线路层面的外部拦截。

## 结论

从服务器内部看：

- 千服前端已部署
- Node API 已部署
- XPay 已部署
- `tenant-gateway` 回调闭环已打通

从公网看：

- `103.236.92.10:80` 仍会被未备案提示页覆盖
- `mc-u.top` 已可直接对外访问当前部署内容

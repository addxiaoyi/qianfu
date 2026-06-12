# XPay 生产接入配置

## 千服 `.env` 必填

```env
NODE_ENV=production
PORT=3001
API_PUBLIC_URL=https://pay.star-web.top

DATABASE_URL=file:/www/wwwroot/qianfu-app/prisma/dev.db
LOCAL_DATABASE_URL=file:/www/wwwroot/qianfu-app/prisma/dev.db

WALLET_SECRET=replace-with-32bytes-or-longer-secret

DEFAULT_PAYMENT_UPSTREAM_PROVIDER=xpay
XPAY_API_URL=https://pay.star-web.top/xpay/starmc/pay
XPAY_TOKEN=replace-with-your-xpay-token
XPAY_NOTIFY_URL=https://pay.star-web.top/api/v1/payment/xpay/notify
```

## 默认项目 `qianfu`

执行：

```bash
npm run seed-payment-projects
```

脚本会把默认项目写入 `SystemConfig`：

- `payment_project:qianfu`

如果默认项目走 XPay，上面 `.env` 的这几项会被带入：

- `DEFAULT_PAYMENT_UPSTREAM_PROVIDER=xpay`
- `XPAY_API_URL`
- `XPAY_TOKEN`
- `XPAY_NOTIFY_URL`

## XPay `application.properties` 对应环境变量

```env
XPAY_PORT=8889

XPAY_DB_URL=jdbc:mysql://127.0.0.1:3306/xpay?characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true
XPAY_DB_USERNAME=root
XPAY_DB_PASSWORD=your-mysql-password

XPAY_REDIS_HOST=127.0.0.1
XPAY_REDIS_PORT=6379

XPAY_SMTP_HOST=smtp.feishu.cn
XPAY_SMTP_PORT=587
XPAY_SMTP_USERNAME=your-mail@example.com
XPAY_SMTP_PASSWORD=your-smtp-password
XPAY_EMAIL_SENDER=your-mail@example.com
XPAY_EMAIL_RECEIVER=your-mail@example.com

XPAY_PUBLIC_URL=https://pay.star-web.top/xpay
XPAY_TOKEN=replace-with-your-xpay-token
XPAY_QR_NUM=5
XPAY_ADMIN_JWT_SECRET=replace-with-long-random-secret
XPAY_SECRET_ENCRYPTION_KEY=replace-with-32bytes-or-longer-secret
XPAY_GATEWAY_NOTIFY_SECRET=replace-with-gateway-notify-secret

XPAY_PROVIDER_ALIPAY_VERIFY_ENABLED=true
XPAY_PROVIDER_ALIPAY_PUBLIC_KEY=replace-with-alipay-public-key

XPAY_PROVIDER_WECHAT_VERIFY_ENABLED=true
XPAY_PROVIDER_WECHAT_API_KEY=replace-with-wechat-api-key
XPAY_PROVIDER_WECHAT_MCH_ID=replace-with-wechat-mch-id
XPAY_PROVIDER_WECHAT_APP_ID=replace-with-wechat-app-id

QIANFU_ENABLED=true
QIANFU_APP_ID=xpay-qianfu-prod
QIANFU_SECRET_KEY=replace-with-qianfu-shared-secret
QIANFU_API_URL=http://127.0.0.1:3001/qianfu-api
QIANFU_CALLBACK_URL=http://127.0.0.1:3001/api/qianfu/xpay/notify
QIANFU_SIGN_ALGORITHM=HmacSHA256
QIANFU_TIMEOUT=30000
QIANFU_RETRY_COUNT=3
```

## 必须手工准备的资源

- MySQL 库：`xpay`
- Redis：`127.0.0.1:6379`
- 厂商回调验签材料：
  - 支付宝公钥
  - 微信 API Key / 商户号 / AppId
- 收款码目录：
  - `xpay-code/src/main/resources/static/assets/qr/alipay/`
  - `xpay-code/src/main/resources/static/assets/qr/wechat/`
  - `xpay-code/src/main/resources/static/assets/qr/qqpay/`

## 启动顺序

1. 启动 MySQL / Redis
2. 启动 XPay
3. 启动千服 API
4. 执行 `npm run seed-payment-projects`
5. 用 `projectKey=qianfu` 调用 `/api/v1/payment/create`

## 当前服务器还缺什么

- `pay.star-web.top` DNS 尚未解析到服务器
- SSL 证书尚未签发
- XPay 的 SMTP 发件账号仍需你确认
- 厂商验签配置仍需填真实值后再打开严格校验

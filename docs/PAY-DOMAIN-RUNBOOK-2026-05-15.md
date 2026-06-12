# `pay.star-web.top` 绑定运行手册

## 目标

把支付入口固定到：

- `https://pay.star-web.top`

并由 Nginx 反代到：

- 千服 API：`127.0.0.1:3000`
- XPay：`127.0.0.1:8889`

## 前提

1. `pay.star-web.top` 已解析到服务器公网 IP
2. 服务器 `80/443` 端口可访问
3. XPay 已在 `8889` 监听
4. 千服 API 已在 `3000` 监听

## Nginx 配置

参考文件：

- `deploy/nginx/pay.star-web.top.conf.example`

自动化部署脚本：

- `scripts/linux/setup-pay-domain.sh`

落地到服务器后：

1. 将证书路径替换为真实路径
2. 配置 `server_name pay.star-web.top`
3. reload Nginx
4. 根路径 `https://pay.star-web.top/` 预期返回纯文本标记：`qianfu-pay-gateway`

如果直接在生产机按仓库默认路径部署，可执行：

```bash
sudo MAIN_SITE_HOST=mc-u.top bash scripts/linux/setup-pay-domain.sh
```

这个脚本现在会额外做几件事：

1. 先写入仅 HTTP 的临时配置，方便 ACME 签证书
2. 申请 `pay.star-web.top` 的 Let’s Encrypt 证书
3. 恢复完整 HTTPS 配置
4. 校验最终 Nginx 文件里的 `server_name` 和证书路径是否仍指向 `pay.star-web.top`
5. 用域名探测脚本检查：
   - 证书是否真的是 `pay.star-web.top`
   - 页面有没有错误回落到 `mc-u.top`

如果你的正式发布入口使用：

```bash
bash scripts/linux/deploy-bt-oneclick.sh
```

建议在 `.env` 里补上：

```env
PAY_DOMAIN_HOST=pay.star-web.top
```

这样部署脚本在发布尾声也会自动复用同一套支付域探针，尽早发现证书错绑、主站回落、或根路径标记丢失。

## 需要同步的环境变量

```env
API_PUBLIC_URL=https://pay.star-web.top
XPAY_API_URL=https://pay.star-web.top/xpay/starmc/pay
XPAY_NOTIFY_URL=https://pay.star-web.top/api/v1/payment/xpay/notify
```

## 验证顺序

1. `curl https://pay.star-web.top/health`
2. `curl http://pay.star-web.top` 是否跳转 HTTPS
3. `npm run probe:pay-domain`
4. 浏览器打开支付页
5. 触发一次真实登录态下单
6. 验证 XPay 回调是否能打到 `/api/v1/payment/xpay/notify`

其中：

```bash
curl -ks https://pay.star-web.top/
```

预期应直接看到：

```text
qianfu-pay-gateway
```

如果 `npm run probe:pay-domain` 输出：

- `tls_status=wrong_principal`
- `cert_cn=mc-u.top`
- `looks_like_main_site=true`

说明支付域名还在误用主站证书，或 443 请求回落到了主站站点块，需要先检查：

- `/www/server/panel/vhost/nginx/pay.star-web.top.conf`
- `server_name pay.star-web.top`
- `/etc/letsencrypt/live/pay.star-web.top/`

## 当前还缺

- DNS 解析生效
- SSL 证书签发
- 站点配置正式部署到服务器

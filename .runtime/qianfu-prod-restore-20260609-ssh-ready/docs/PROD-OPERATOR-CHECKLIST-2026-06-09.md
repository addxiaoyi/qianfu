# 生产恢复人工操作单 - 2026-06-09

目标：恢复 `mc-u.top` 主站 API、当前前端包、`pay.star-web.top` 独立支付域。

当前不能判定完成。恢复后必须通过本文件最后的公网验收。

## 1. 上传恢复包

上传这个文件到生产机任意临时路径：

```text
output/prod-restore-bundles/qianfu-prod-restore-20260609-ssh-ready.tar.gz
```

SHA-256：

```text
待生成后以 `.sha256` 文件为准。
```

推荐上传到：

```text
/www/wwwroot/qianfu-prod-restore-20260609-ssh-ready.tar.gz
```

如果可以从本机 SSH 登录生产机，也可以让脚本自动上传并执行：

```powershell
$env:QF_SSH_HOST = "103.236.92.10"
$env:QF_SSH_USER = "root"
npm run prod:restore:ssh:win
```

先预览命令：

```powershell
npm run prod:restore:ssh:win -- -DryRun
```

只修主站：

```powershell
npm run prod:restore:ssh:win -- -WebOnly
```

只修支付域：

```powershell
npm run prod:restore:ssh:win -- -PayOnly
```

## 2. 在生产机终端执行

```bash
cd /www/wwwroot/qianfu-app
tar -xzf /www/wwwroot/qianfu-prod-restore-20260609-ssh-ready.tar.gz -C /www/wwwroot/qianfu-app
bash scripts/linux/prod-terminal-snapshot.sh
bash scripts/linux/prod-terminal-minimal-repair.sh --preflight-only
bash scripts/linux/prod-terminal-minimal-repair.sh --dry-run --no-strict
sudo bash scripts/linux/prod-terminal-minimal-repair.sh
```

如果 `preflight-only` 提示证书缺失：

- `mc-u.top` 证书应在 `/etc/letsencrypt/live/mc-u.top/`
- `pay.star-web.top` 证书应在 `/etc/letsencrypt/live/pay.star-web.top/`

如果只想先修主站，不碰支付域：

```bash
sudo bash scripts/linux/prod-terminal-minimal-repair.sh --web-only
```

如果只想修支付域：

```bash
sudo bash scripts/linux/prod-terminal-minimal-repair.sh --pay-only
```

## 3. 成功标准

从本机或生产机执行：

```bash
curl -kI https://mc-u.top/api/health
curl -kI https://mc-u.top/api/ready
curl -kI https://mc-u.top/qianfu-dist-manifest.json
curl -kI https://mc-u.top/assets/index-CHZmvcH-.js
curl -k https://pay.star-web.top/
```

预期：

- `/api/health` 是 `200`
- `/api/ready` 是 `200`
- `/qianfu-dist-manifest.json` 是 JSON，不是 HTML
- `/assets/index-CHZmvcH-.js` 是 `200`
- `https://pay.star-web.top/` 返回 `qianfu-pay-gateway`

从本机执行完整验收：

```powershell
npm run prod:verify:public:win
```

必须看到：

- `failed_count=0`
- `frontend_bundle_match=true`
- `frontend_manifest_match=true`
- `pay_tls_status=ok`
- `pay_root_marker_match=true`
- `pay_looks_like_main_site=false`

## 4. 如果仍失败

先保留终端输出，不要覆盖现场。

生产机上执行：

```bash
cd /www/wwwroot/qianfu-app
bash scripts/linux/diagnose-prod-502.sh --summary
bash scripts/linux/prod-terminal-snapshot.sh
pm2 status qianfu-api --no-color
ss -lntp | grep -E ':80|:443|:3000|:3001|:8889'
nginx -t
```

重点看：

- `qianfu-api` 是否监听 `127.0.0.1:3000`
- `/www/server/panel/vhost/nginx/mc-u.top.conf` 的 `/api` upstream 是否指向 `127.0.0.1:3000`
- `/www/server/panel/vhost/nginx/pay.star-web.top.conf` 是否包含 `server_name pay.star-web.top`
- 支付域证书路径是否是 `/etc/letsencrypt/live/pay.star-web.top/`

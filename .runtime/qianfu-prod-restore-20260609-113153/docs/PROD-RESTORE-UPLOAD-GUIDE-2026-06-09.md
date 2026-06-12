# 生产恢复上传指南 - 2026-06-09

当前公网仍未恢复，不能标记完成：

- `https://mc-u.top/api/health` -> `502`
- `https://mc-u.top/api/ready` -> `502`
- `https://mc-u.top/` 仍引用旧入口 `/assets/index-D8ePUst4.js`
- 本地当前入口是 `/assets/index-CHZmvcH-.js`
- `https://mc-u.top/qianfu-dist-manifest.json` 返回 HTML，不是 JSON manifest
- `https://pay.star-web.top` 证书仍命中 `mc-u.top`，并回落主站 HTML

## 当前管理通道

2026-06-09 09:42 复核：

- DNS：`mc-u.top` 和 `pay.star-web.top` 均指向 `103.236.92.10`
- TCP：`80/443/21` 开放
- TCP：`22/2222/22022/10022/3000/3001/7800/8888/8889/10000` 不可用或超时
- `curl.exe ftp://103.236.92.10/` 20 秒超时
- 本地环境变量和 `.env` 未发现 `QF_DEPLOY_PASSWORD`、FTP 或宝塔凭据

结论：当前机器仍不能直接 SSH/宝塔发布。需要以下任一通道：

- 宝塔文件管理 + 生产机终端
- 可用 SSH
- 可用 FTP/SFTP 凭据
- 服务器内一次性执行入口

## 产物一：全量恢复包

适用：可以上传文件，并能在生产机终端执行命令。

文件：

```text
output/prod-restore-bundles/qianfu-prod-restore-20260609-112300.tar.gz
```

校验：

```text
5329f4caad44556f91be3a6c1ee541ee95b9ac60aa7c30cd51c6bc09eaa58d86
```

生产机执行：

```bash
cd /www/wwwroot/qianfu-app
tar -xzf /path/to/qianfu-prod-restore-20260609-112300.tar.gz -C /www/wwwroot/qianfu-app
bash scripts/linux/prod-terminal-snapshot.sh
bash scripts/linux/prod-terminal-minimal-repair.sh --preflight-only
bash scripts/linux/prod-terminal-minimal-repair.sh --dry-run --no-strict
sudo bash scripts/linux/prod-terminal-minimal-repair.sh
```

这个包包含：

- `scripts/linux/prod-terminal-minimal-repair.sh`
- `scripts/linux/prod-terminal-snapshot.sh`
- `scripts/linux/restore-prod-public.sh`
- `scripts/linux/deploy-frontend-dist.sh`
- `scripts/linux/repair-prod-edge.sh`
- `scripts/prod-restore-runners/diagnose-public-prod.mjs`
- Nginx 模板
- 当前 `qianfu-liandeng/dist`

如果希望走更完整的分阶段恢复入口，也可以执行：

```bash
bash scripts/linux/restore-prod-public.sh --preflight-only
bash scripts/linux/restore-prod-public.sh --dry-run
sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/restore-prod-public.sh
```

## 产物二：前端静态 zip

适用：只能通过宝塔文件管理或 FTP 替换静态目录，暂时不能执行后端/Nginx 修复命令。

文件：

```text
output/frontend-dist-bundles/qianfu-liandeng-dist-20260609-0945.zip
```

校验：

```text
3833e77e03fe4cef0876741d8e05d89a1345d38ed1496dd049f7acb2c8789ce6
```

内容抽查已确认包含：

- `index.html`
- `qianfu-dist-manifest.json`
- `assets/index-CHZmvcH-.js`
- `assets/index-CIUYiekq.css`

上传位置：

```text
/www/wwwroot/qianfu-app/qianfu-liandeng/dist
```

注意：zip 内是 dist 根目录内容。解压后应直接看到：

```text
/www/wwwroot/qianfu-app/qianfu-liandeng/dist/index.html
/www/wwwroot/qianfu-app/qianfu-liandeng/dist/qianfu-dist-manifest.json
/www/wwwroot/qianfu-app/qianfu-liandeng/dist/assets/index-CHZmvcH-.js
```

不要解成：

```text
/www/wwwroot/qianfu-app/qianfu-liandeng/dist/qianfu-liandeng-dist-20260609-0945/index.html
```

前端 zip 只能修复旧 bundle / manifest 问题，不能修复：

- 主站 API `502`
- `pay.star-web.top` 证书错绑
- 支付域 vhost 回落主站

## FTP 直传脚本

如果拿到 FTP 凭据，也可以从本机递归上传当前 `qianfu-liandeng/dist`：

```powershell
$env:QF_FTP_HOST = "103.236.92.10"
$env:QF_FTP_USER = "<ftp-user>"
$env:QF_FTP_PASSWORD = "<ftp-password>"
$env:QF_FTP_REMOTE_DIR = "/www/wwwroot/qianfu-app/qianfu-liandeng/dist"
powershell -ExecutionPolicy Bypass -File scripts/windows/upload-frontend-dist-ftp.ps1
```

先 dry-run：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/upload-frontend-dist-ftp.ps1 -DryRun -PreviewLimit 20
```

本轮已验证 dry-run 能枚举 `1863` 个 dist 文件并映射到生产静态目录。该脚本不会清理远端旧文件，只会覆盖/补齐当前 dist 文件；旧 hash chunk 留在远端通常无害，因为新 `index.html` 和 manifest 会指向当前入口。

如果希望 FTP 上传完成后自动检查公网 manifest 和文件抽样：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/upload-frontend-dist-ftp.ps1 -VerifyAfterUpload
```

## 发布后验收

从本机执行：

```powershell
npm run prod:verify:public:win
```

或者逐项执行：

```bash
npm run prod:diagnose:public -- --kv
npm run prod:verify:frontend:manifest
npm run prod:verify:frontend:files:sample
npm run probe:pay-domain
```

本轮已验证 `scripts/windows/verify-public-production.ps1` 会把以下四项汇总到一个 summary：

- 公网总诊断
- 前端 manifest 比对
- 前端文件抽样比对
- 支付域证书/vhost/根标记探针

必须看到：

- `main_api_health_status=200`
- `main_api_ready_status=200`
- `frontend_bundle_match=true`
- `frontend_manifest_match=true`
- `remote_manifest_error` 为空
- `pay_tls_status=ok`
- `pay_root_marker_match=true`
- `pay_looks_like_main_site=false`

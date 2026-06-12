# 生产 502 恢复 Runbook - 2026-06-06

适用场景：

- `https://mc-u.top/` 可打开，但 `/api/health`、`/api/ready` 返回 `502 Bad Gateway`
- `https://pay.star-web.top` TLS 或 API 不可用
- 怀疑 `qianfu-api` 实际监听端口与 Nginx upstream 不一致

## 当前仓库事实

- PM2 默认端口：`3000`
  - 见 `ecosystem.config.cjs`
- PM2 生产默认严格端口：`PORT_STRICT=true`
  - 避免端口占用后静默顺延到 `3001/3002...`
- 服务端默认端口：`3000`
  - 见 `server/index.ts`
- 当前主站同域 Nginx 示例反代：`127.0.0.1:3000`
  - 见 `deploy/nginx/qianfu.same-domain.conf.example`
- 本轮已修正支付域模板与脚本到 `127.0.0.1:3000`
  - `deploy/nginx/pay.star-web.top.conf.example`
  - `scripts/linux/setup-pay-domain.sh`

## 一、先确认进程和监听端口

优先入口：

```bash
bash scripts/linux/diagnose-prod-502.sh
```

如果你准备把当前主机上的 PM2、端口、nginx 配置、证书、curl 结果、现有诊断输出一次性打包给别人看，先执行：

```bash
bash scripts/linux/collect-prod-502-evidence.sh diagnostics
```

它会生成：

- 目录：`diagnostics/qianfu-prod-502-evidence-<timestamp>/`
- 压缩包：`diagnostics/qianfu-prod-502-evidence-<timestamp>.tar.gz`

内容包括：

- PM2 状态与 `ps` / `ss` 监听信息
- 本地 `3000/3001/8889` 探测
- 主站/支付域公网 `curl` 响应
- `prod:diagnose:public` 的跨平台公网汇总结论
- `prod:audit:browser:public` 的浏览器层页面审计结果（若 Playwright 浏览器可用）
- `mc-u.top.conf` / `pay.star-web.top.conf` 快照
- `openssl` 证书信息与 `letsencrypt` 目录信息
- `diagnose-prod-502.sh --summary`
- `qianfu-prod-healthcheck.sh --public-only`
- `probe:frontend-deploy`
- `domain-cert-probe`

如果这次只想打包服务 / nginx / TLS / curl 证据，不想跑浏览器层页面审计，可关闭：

```bash
RUN_BROWSER_AUDIT=0 bash scripts/linux/collect-prod-502-evidence.sh diagnostics
```

浏览器层审计默认有外层时间上限，避免生产机证据采集被单项卡住。必要时可以调整：

```bash
BROWSER_AUDIT_TIMEOUT_SECONDS=240 \
BROWSER_AUDIT_NAV_TIMEOUT_MS=12000 \
BROWSER_AUDIT_ROUTE_READY_TIMEOUT_MS=8000 \
BROWSER_AUDIT_CONCURRENCY=3 \
bash scripts/linux/collect-prod-502-evidence.sh diagnostics
```

如果你是在正式发布过程中使用：

```bash
PUBLIC_SMOKE_BASE_URL=https://mc-u.top \
bash scripts/linux/deploy-bt-oneclick.sh --strict-public-smoke
```

那么现在当严格模式因为公网烟测或支付域探针失败而中断时，部署脚本也会默认先跑一次上面的证据采集，再退出非零。这样即使发布被拦住，现场也会落盘到 `diagnostics/`。

如果只想快速摘结论：

```bash
bash scripts/linux/diagnose-prod-502.sh --summary
```

如果你不在生产机上，只想从任意一台能联网的机器快速看“主站 API / 前端 freshness / 支付域 TLS-vhost”这三块是否一起出问题，可直接执行：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
npm run prod:diagnose:public
```

它会复用现有前端部署探针和支付域证书探针，并把公网 API 状态一起汇总成一份跨平台结论。当前输出还包含 `recommended_actions` / `NEXT:`，会直接把问题拆成主站 API、前端部署、支付域 TLS-vhost 三类下一步动作。
现在这条公网诊断也会顺手检查远端 `qianfu-dist-manifest.json`，输出 `frontend_manifest_match` / `frontend_manifest_error` / `frontend_manifest_dist_hash`。如果 `frontend_manifest_error` 显示远端返回 HTML 或 JSON 解析失败，就说明 manifest 没真正部署到站点根，不能认为前端整包发布完成。

如果需要把这份公网验收结果稳定落盘成 JSON，便于发回或归档：

```bash
npm run prod:diagnose:public:report
```

报告会写入 `output/prod-public-verify/report.json`，同时在命令输出里打印 `report_file=...`。

如果这次重点是确认前端静态目录是否“整包完整发布”，先生成本地 dist 清单：

```bash
npm run frontend:manifest:kv
```

这会写入 `qianfu-liandeng/dist/qianfu-dist-manifest.json`，并输出：

- `file_count`
- `total_bytes`
- `dist_hash`
- `entrypoint_assets`

当前根 `npm run build` 已经会在 Vite 构建后自动生成这份 manifest；生产发布必须把 `qianfu-liandeng/dist` 整目录一起覆盖到站点根，包含 `qianfu-dist-manifest.json`。

如果要在生产机直接修复前端静态目录，推荐走原子发布脚本，而不是手工上传单个文件：

```bash
sudo WEB_DOMAIN=mc-u.top bash scripts/linux/deploy-frontend-dist.sh
```

它会：

- 在临时目录构建前端，而不是直接改 live `dist`
- 生成 `qianfu-dist-manifest.json`
- 把旧 `WEB_ROOT` 移到 `.qianfu-dist-backups/dist-<timestamp>`
- 将新 dist 原子替换到 `WEB_ROOT`
- `nginx -t` 后 reload
- 验证公网 manifest、入口 assets freshness，并按配置抽样或全量校验公网文件

如需先看它将操作哪些路径：

```bash
npm run prod:deploy:frontend:dry
```

如果 Nginx root 不是默认 `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`，显式指定：

```bash
sudo WEB_ROOT=/www/wwwroot/qianfu-app/qianfu-liandeng/dist \
  WEB_DOMAIN=mc-u.top \
  bash scripts/linux/deploy-frontend-dist.sh
```

发布后先比对远端 manifest：

```bash
npm run prod:verify:frontend:manifest
```

如果输出 `remote_manifest_error=Unexpected token '<'` 或远端返回 HTML，说明 `/qianfu-dist-manifest.json` 没有部署成功，当前域名仍在走 SPA fallback 或旧站点根。
同一个信号也会出现在 `prod:diagnose:public` 的 `frontend_manifest_error` 字段里。

如果需要进一步直接拉公网静态文件做内容校验：

```bash
npm run prod:verify:frontend:files
```

这会按本地 manifest 对公网文件做 SHA-256 全量比对。排障时可先跑抽样版：

```bash
npm run prod:verify:frontend:files:sample
```

抽样版只适合快速抓证据，不能替代全量发布验收。

如果你还想再确认“浏览器真正渲染给用户看的页面”有没有一起坏掉，可再跑一条：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
npm run prod:audit:browser:public
```

线上比较慢或公网连接不稳定时，建议带短超时和增量报告参数：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
npm run prod:audit:browser:public -- \
  --report-only --kv \
  --nav-timeout-ms 12000 \
  --dom-ready-timeout-ms 5000 \
  --route-ready-timeout-ms 8000 \
  --interaction-timeout-ms 5000 \
  --stable-wait-ms 300 \
  --concurrency 3
```

这条会直接打开主站几个关键公共页面和支付域首页，补充：

- 控制台错误与 `502` 请求
- 页面标题是否仍停留在“首页”
- 支付域在浏览器里是否先触发证书错误，再回落到主站页面
- `report.json` 会逐路由增量写入；如果命令被外层 timeout 中断，先看 `partial_report`、`completed` 和 `missingRoutes`
- `--concurrency` 默认是 3，会并发跑多个互不依赖的路由，但报告仍按路由清单顺序归档；生产机资源紧张时可降为 1
- 如果文档状态是 `200` 但出现 `empty_body`、`route_ready_error`、入口 JS 请求失败，优先按“线上资源加载/执行失败或旧 bundle 未更新”处理，不要直接归因成当前源码标题逻辑坏了

补充一个已经验证过的对照结论（2026-06-08）：

- 当前仓库本地构建 + `vite preview` 下再次跑浏览器审计后，`title_mismatch_routes=none`
- `/search`、`/resources`、`/rules`、`/login`、`/register`、`/forgot-password` 在当前源码这版里都能拿到独立标题
- 旧 `#/search` 也会在浏览器里转换成 `/search`
- 因此如果线上继续出现这些页面标题统一停在“首页”，优先把它当成“线上仍在跑旧前端 bundle”的部署问题，而不是当前仓库源码里还残留同类 bug
- 同日并发浏览器审计已完整跑完 `12/12` 个线上路由，耗时约 81 秒；这轮页面实际渲染出了旧线上应用，所以 `renderedTitleMismatchRoutes` 覆盖首页、搜索、资源、规则、登录、注册、找回密码和部分 hash 路由，进一步证明现网仍是旧 bundle / API 502 / 支付域 TLS-vhost 组合问题

这个脚本会一次性输出：

- `qianfu-api` 的 PM2 状态
- `3000/3001/8889` 监听情况
- `mc-u.top` / `pay.star-web.top` 的本地与公网健康检查
- 主站/支付域 Nginx 配置里是否仍指向旧端口
- 支付域 Nginx 配置是否真的包含 `server_name pay.star-web.top`
- 支付域证书路径是否真的指向 `/etc/letsencrypt/live/pay.star-web.top/`
- 基于这些信号给出保守的故障归因提示，例如“upstream 指错端口”、“API 本身没起来”或“更像是证书 / DNS 问题”

如果需要手工逐项确认，再执行下面这些命令。

在生产机执行：

```bash
pm2 status qianfu-api --no-color
pm2 describe qianfu-api
ss -lntp | grep -E ':3000|:3001|:443|:80|:8889'
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3000/api/ready
curl -fsS http://127.0.0.1:3001/api/ready
```

预期：

- `qianfu-api` 为 `online`
- `127.0.0.1:3000` 能返回健康 JSON
- 如果 `3001` 无响应而 Nginx 还代理到 `3001`，这就是主因

如果 PM2 进程不在线，再看日志：

```bash
pm2 logs qianfu-api --lines 200
tail -n 200 /www/wwwroot/qianfu-app/logs/pm2-error.log
tail -n 200 /www/wwwroot/qianfu-app/logs/pm2-out.log
```

## 二、确认 Nginx upstream 是否仍指向旧端口

主站：

```bash
grep -n "127.0.0.1:3000\\|127.0.0.1:3001\\|server_name\\|location /api/\\|location /auth/" /www/server/panel/vhost/nginx/mc-u.top.conf
```

支付域：

```bash
grep -n "127.0.0.1:3000\\|127.0.0.1:3001\\|server_name\\|ssl_certificate\\|location /api/\\|location /xpay/" /www/server/panel/vhost/nginx/pay.star-web.top.conf
```

如果看到：

- `mc-u.top.conf` 指向 `127.0.0.1:3001`
- 但 `qianfu-api` 实际只在 `3000` 监听

就把 upstream 改到 `3000`。

## 三、推荐 Nginx upstream 修正

主站 upstream 应类似：

```nginx
upstream qianfu_web_api {
    server 127.0.0.1:3000;
    keepalive 64;
}
```

支付域 upstream 应类似：

```nginx
upstream qianfu_pay_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream qianfu_pay_xpay {
    server 127.0.0.1:8889;
    keepalive 32;
}
```

仓库参考：

- `deploy/nginx/mc-u.top.conf.example`
- `deploy/nginx/qianfu.same-domain.conf.example`
- `deploy/nginx/pay.star-web.top.conf.example`

改完后执行：

```bash
nginx -t
systemctl reload nginx
```

如果想直接用仓库当前模板重建主站和支付域边缘配置，可在生产机执行：

```bash
sudo bash scripts/linux/restore-prod-public.sh
```

这个总入口会先跑公网诊断，再依次执行 `REPAIR_SCOPE=web` 与 `REPAIR_SCOPE=pay`，最后跑严格 all-scope 公网验收；完整日志会写到 `/www/wwwroot/qianfu-app/logs/prod-restore/restore-prod-public-<timestamp>.log`。如果某个阶段失败，脚本仍会继续尝试后续阶段并在最终 summary 里保留 `web_status` / `pay_status` / `final_status`，便于区分主站、前端整包、支付域证书/vhost 哪一段仍未恢复。

先在生产机预览将执行的命令，可用：

```bash
bash scripts/linux/restore-prod-public.sh --dry-run
```

如果想先检查生产机是否具备恢复所需文件、命令、Nginx 模板和证书路径，但不执行任何修复，可用：

```bash
bash scripts/linux/restore-prod-public.sh --preflight-only
```

如果当前机器不能 SSH 到生产机，但可以通过宝塔文件管理上传文件，先在本地生成恢复包：

```bash
npm run prod:restore:bundle
```

生成物会放在 `output/prod-restore-bundles/qianfu-prod-restore-<timestamp>.tar.gz`，包内包含恢复脚本、Nginx 模板、诊断工具、无需 `tsx` 的公网诊断 runner，以及当前 `qianfu-liandeng/dist`。上传到生产机后执行：

```bash
cd /www/wwwroot/qianfu-app
tar -xzf /path/to/qianfu-prod-restore-<timestamp>.tar.gz -C /www/wwwroot/qianfu-app
bash scripts/linux/restore-prod-public.sh --preflight-only
bash scripts/linux/restore-prod-public.sh --dry-run
sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/restore-prod-public.sh
```

这里的 `RUN_BUILD_ARTIFACTS=0` 用于复用恢复包中已包含的当前前端 `dist`，避免生产机在高负载或依赖不完整时重新构建前端。

当前已生成并验证过的恢复包：

```text
output/prod-restore-bundles/qianfu-prod-restore-20260609-090718.tar.gz
sha256: dc543524654e927117e7d97f913d781a76b3d04cdcc57450754f4b3f86daefda
```

如果只想直接用底层脚本重建全部边缘配置，也可以执行：

```bash
sudo bash scripts/linux/repair-prod-edge.sh
```

也可以按故障面拆开执行，避免支付域证书问题阻塞主站恢复：

```bash
sudo REPAIR_SCOPE=web bash scripts/linux/repair-prod-edge.sh
sudo REPAIR_SCOPE=pay bash scripts/linux/repair-prod-edge.sh
```

`REPAIR_SCOPE=web` 只要求主站模板、主站证书和完整前端 `dist`，不会检查或安装 `pay.star-web.top` 配置；修后公网验收只要求主站 API 与主站前端为 `ok`。`REPAIR_SCOPE=pay` 只要求支付域模板和支付域证书，不会替换主站 Nginx 配置或主站 SPA headers include；修后公网验收只要求支付域 TLS/vhost 为 `ok`。

这个脚本会：

- 默认先跑一份 `scripts/linux/collect-prod-502-evidence.sh diagnostics`
- 默认执行 `npm run server:build`，并通过 `scripts/linux/deploy-frontend-dist.sh` 把前端构建到临时目录后原子替换 `WEB_ROOT`
- 检查 `WEB_ROOT/index.html`，避免 Nginx 指向空目录或未更新的前端 `dist`
- 检查 `WEB_ROOT/qianfu-dist-manifest.json`，避免只部署入口 HTML 或缺 chunk 的半发布状态
- 按 `REPAIR_SCOPE` 检查主站或支付域的 Let’s Encrypt `fullchain.pem` / `privkey.pem` 是否存在
- 按 `REPAIR_SCOPE` 备份当前 `mc-u.top.conf`、`pay.star-web.top.conf`、`qianfu-spa-security-headers.conf`
- 按 `REPAIR_SCOPE` 用仓库模板重建主站、支付域或两者的站点配置
- 使用站点级 upstream 名称，避免两个 conf 同时启用时出现 duplicate upstream
- 对齐 API 端口到 `3000`
- 重启 `pm2 qianfu-api`（默认开启，带 `PORT_STRICT=true`）
- `nginx -t && systemctl reload nginx`
- 检查本地 `/api/health`
- 检查支付域根路径是否返回 `qianfu-pay-gateway`
- 顺手执行前端部署新鲜度探针，提醒主站静态前端是否仍停留在旧 bundle / 旧 hash 路由 SEO 标记
- 最后跑一轮 `scripts/linux/diagnose-prod-502.sh --summary`
- 默认执行 `prod:diagnose:public --report-only --kv` 做修后公网验收，直接判断主站 API、前端 freshness、支付域 TLS/vhost 是否都恢复为 `ok`
- 公网验收日志会打印 `recommended_actions`，并在 `repair-prod-edge.sh` 中拆成多行 `[NEXT]`，如果仍失败，会直接提示下一步应先修主站 API、重新部署前端 `dist`，还是修支付域证书 / `server_name`

如果希望修后公网验收不通过时直接失败，并在失败前再打包一份证据，使用严格模式：

```bash
sudo STRICT_PUBLIC_VERIFY=1 bash scripts/linux/repair-prod-edge.sh
```

如果只想修，不想在修前自动留证据，可显式关闭：

```bash
sudo RUN_EVIDENCE=0 bash scripts/linux/repair-prod-edge.sh
```

如果当前产物已经由其他发布流程刚刚构建过，只想重渲染 Nginx 和重启 PM2，可显式跳过构建：

```bash
sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/repair-prod-edge.sh
```

如果只在内网或 DNS 尚未切换的阶段验证本机修复，可临时关闭公网验收：

```bash
sudo RUN_PUBLIC_VERIFY=0 bash scripts/linux/repair-prod-edge.sh
```

如果只想复用同一套公网验收逻辑，不改 Nginx、不重启 PM2、不要求 root，可运行只读模式：

```bash
npm run prod:verify:public
```

主站和支付域也有对应的只读验收入口：

```bash
npm run prod:verify:public:web
npm run prod:verify:public:pay
```

严格只读模式可用于 CI / 发布门禁；现网仍坏时会退出非零：

```bash
npm run prod:verify:public:strict
npm run prod:verify:public:web:strict
```

等价的底层 Bash 写法：

```bash
APP_ROOT=/www/wwwroot/qianfu-app \
VERIFY_ONLY=1 \
bash scripts/linux/repair-prod-edge.sh
```

当前已在本机验证：`VERIFY_ONLY=1` 会复现现网三类问题；`VERIFY_ONLY=1 STRICT_PUBLIC_VERIFY=1 RUN_FAILURE_EVIDENCE=0` 会在现网仍坏时退出非零。

## 四、如果 API 本身起不来

1. 先确认 `.env`：

```bash
grep -nE '^(PORT|NODE_ENV|DATABASE_URL|LOCAL_DATABASE_URL|REDIS_ENABLED|API_PUBLIC_URL)=' /www/wwwroot/qianfu-app/.env
```

2. 检查数据库：

```bash
systemctl is-active mysqld
ss -lntp | grep ':3306'
mysql -h127.0.0.1 -P3306 -uqianfu -p -e "SELECT 1" qianfu
```

3. 如果是 `.env` 或构建产物更新后需要重启：

```bash
cd /www/wwwroot/qianfu-app
APP_NAME=qianfu-api PORT=3000 NODE_ENV=production pm2 startOrRestart ecosystem.config.cjs --only qianfu-api --update-env
pm2 save
```

## 五、主站恢复后立即做的外网验证

```bash
curl -k -I -L --max-time 20 https://mc-u.top/
curl -k --max-time 20 https://mc-u.top/api/health
curl -k --max-time 20 https://mc-u.top/api/ready
```

预期：

- 首页 `200`
- `/api/health` 返回包含 `healthy`
- `/api/ready` 返回包含 `ready`

## 六、支付域恢复后立即做的验证

TLS 和健康检查：

```bash
curl -k -I -L --max-time 20 https://pay.star-web.top/
curl -k --max-time 20 https://pay.star-web.top/
curl -k --max-time 20 https://pay.star-web.top/health
curl -k --max-time 20 https://pay.star-web.top/api/health
```

当前仓库模板里，支付域根路径 `/` 预期会直接返回：

```text
qianfu-pay-gateway
```

如果这里拿到的是主站 HTML，而不是上面的纯文本标记，就很可能不是支付站点块在响应。

如果证书报错，先核对：

```bash
ls -l /etc/letsencrypt/live/pay.star-web.top/
nginx -t
```

再补两项能快速区分“证书绑错域名”还是“纯 upstream 挂掉”的检查：

```bash
curl -ks https://pay.star-web.top/ | head -n 20
openssl s_client -connect pay.star-web.top:443 -servername pay.star-web.top </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -ext subjectAltName
```

仓库里也有一个可复用的域名探测脚本：

```bash
npm run probe:pay-domain
```

或手工指定域名：

```bash
npm run probe:domain-cert -- --host pay.star-web.top --expect-host pay.star-web.top --main-site-host mc-u.top
```

如果你看到：

- 证书 `subject` / `subjectAltName` 里只有 `mc-u.top`
- 或者返回 HTML 里的 `canonical` 仍是 `https://mc-u.top/`
- 或者支付域根路径没有返回 `qianfu-pay-gateway`

那就不是单纯 API upstream 问题，而是 `pay.star-web.top` 的 443 证书绑定或 `server_name` 命中了错误站点。

## 七、仓库内可复用的 smoke

生产机或可访问生产域名的机器上可执行：

```bash
bash scripts/linux/diagnose-prod-502.sh
```

```bash
npm run probe:pay-domain
```

```bash
npm run probe:frontend-deploy
```

这条新探针会直接比对：

- 线上首页 `index.html` 当前引用的前端 bundle
- 本地最新 `qianfu-liandeng/dist/index.html` 引用的 bundle
- 线上首页入口 JS/CSS/modulepreload 资源清单是否与本地 `dist` 完全一致
- 本地入口资源在公网对应路径是否存在，并用 SHA-256 确认远端内容与本地 `dist` 完全一致
- 线上 HTML 是否还残留 `#/search`、`#/servers`、`#/resources` 这类历史 hash 路由 SEO 标记
- `SearchAction.target` 是否仍是旧的 hash 路由版本

如果输出里出现：

- `bundle_mismatch`
- `asset_reference_mismatch`
- `asset_content_mismatch`
- `remote_legacy_hash_markers`
- `search_target_mismatch`

那说明线上站点不只是 API `502`，前端静态资源本身也还没完整部署到当前仓库版本。尤其是 `asset_content_mismatch` / `missing_or_mismatched_assets`，可以直接识别“只替换了 HTML、但 assets 目录没上传或 CDN/缓存仍旧”的半发布状态。

现在 `scripts/linux/diagnose-prod-502.sh` 和 `scripts/windows/diagnose-prod-502.ps1` 也都会顺手带出这组前端 freshness 信号，包括前端根页 HTTP 状态、bundle、旧 hash 路由 SEO 标记和 `SearchAction target`，不必再单独手动比对首页 HTML。

如果当前机器是 Windows，而且不想手敲完整 PowerShell 路径，也可以直接：

```bash
npm run prod:diagnose:win
```

当前这个 Windows 入口已经验证过能在无 WSL 的环境里直接打出公网 `200/502` 状态、支付域证书/回站问题，以及主站前端 freshness 信号。
它现在默认跳过本机 PM2 / 端口 / `/api/health` 这类本地宿主机检查，避免把“这台 Windows 机器自己的 3000 端口状态”误当成生产结论。

如果这台 Windows 机器本身就是目标主机，才使用：

```bash
npm run prod:diagnose:win:local
```

```bash
sudo MAIN_SITE_HOST=mc-u.top bash scripts/linux/setup-pay-domain.sh
```

```bash
QIANFU_BASE_URL=https://mc-u.top bash scripts/linux/qianfu-prod-healthcheck.sh
```

如果生产同时使用独立支付域，建议把支付域也交给这条健康检查一起验：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
bash scripts/linux/qianfu-prod-healthcheck.sh
```

如果你只是从另一台联网机器复核现网，而不是在生产机本身执行，改用：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
bash scripts/linux/qianfu-prod-healthcheck.sh --public-only
```

或直接：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
npm run prod:healthcheck:public
```

脚本现在会额外检查：

- `https://mc-u.top/` 是否仍返回 HTTP 200
- 远端首页 bundle 是否与本地 `qianfu-liandeng/dist/index.html` 一致
- 远端入口资源清单和入口资源 SHA-256 内容是否与本地 `qianfu-liandeng/dist` 一致
- 远端 `qianfu-dist-manifest.json` 是否存在且 `dist_hash` 与本地一致
- 远端 HTML 是否仍残留 `#/search`、`#/servers`、`#/resources` 旧 hash 路由 SEO 标记
- `SearchAction target` 是否仍错误指向 hash 路由
- `https://pay.star-web.top/` 是否仍返回 `qianfu-pay-gateway`
- `/health` 与 `/api/health` 是否健康
- 证书是否命中 `pay.star-web.top`
- 页面是否错误回落到 `mc-u.top` 主站 HTML

`--public-only` 会跳过 PM2 / MySQL / 内存这类宿主机检查，适合单纯验证“已经部署出去的网站现在到底是不是好的”。现在它会把主站 API、主站前端 freshness、以及支付域回站/证书问题一起打出来。

```bash
SMOKE_WEB_BASE_URL=https://mc-u.top npx tsx scripts/smoke-web-flows.ts
```

```bash
SMOKE_WEB_BASE_URL=https://mc-u.top node scripts/browser-auth-validation.cjs
```

```bash
SMOKE_WEB_BASE_URL=https://mc-u.top npx tsx scripts/scan-production-copy.ts
```

如需核对某个支付订单状态：

```bash
SMOKE_WEB_BASE_URL=https://mc-u.top \
PAYMENT_ORDER_ID=<order_id> \
PAYMENT_ADMIN_IDENTIFIER=<admin_identifier> \
PAYMENT_ADMIN_PASSWORD=<admin_password> \
npx tsx scripts/check-payment-order-status.ts
```

## 八、最可能的恢复路径

1. 在生产机确认 `qianfu-api` 实际监听 `3000` 还是 `3001`
2. 把 `mc-u.top.conf` 和 `pay.star-web.top.conf` 的 upstream 改成真实监听端口
3. `nginx -t && systemctl reload nginx`
4. 若 API 未在线，再 `pm2 startOrRestart ecosystem.config.cjs --only qianfu-api --update-env`
5. 跑 `scripts/linux/qianfu-prod-healthcheck.sh`
6. 跑外网 smoke：`smoke-web-flows`、`scan-production-copy`、必要时 `browser-auth-validation`

## 九、当前剩余外部依赖

- 生产机实际 Nginx 配置内容
- 生产机 PM2 进程与监听端口现状
- `pay.star-web.top` 的 DNS 与证书状态

这些都在仓库外，必须上机验证后才能宣告现网恢复。

# 千服当前状态面板 - 2026-06-06

## 仓库内已完成

- 已补跨平台公网诊断入口：
  - `npm run prod:diagnose:public`
  - 直接汇总主站 `/api/health`、`/api/ready`、前端 freshness、支付域证书 / 主站回落 / 根标记
  - 当前已新增 `recommended_actions` / `NEXT:` 输出，会把修复动作拆成主站 API、前端部署、支付域 TLS-vhost 三条可执行下一步
  - 已补 `npm run prod:diagnose:public:report`，会把公网验收 summary 固定写入 `output/prod-public-verify/report.json`，并输出 `report_file=...`
  - `scripts/linux/collect-prod-502-evidence.sh` 现在也会把这份汇总诊断一起打包
  - 当前实测仍输出三条核心结论：
    - 主站更像是“静态根页还活着，但 `/api` 边缘仍坏着”
    - 主站前端仍在使用旧 bundle `/assets/index-D8ePUst4.js`
    - 支付域仍很像落到了主站 TLS/vhost
- `scripts/windows/diagnose-prod-502.ps1` 与 `scripts/linux/diagnose-prod-502.sh` 现在也会附带打印统一公网诊断结果：
  - 这样 Windows / Linux 包装脚本与 `prod:diagnose:public` 的线上结论更一致
  - `prod:diagnose:win` 当前已验证能同时输出独立探针结果和统一公网诊断结果
- `scripts/linux/diagnose-prod-502.sh` 现在在缺少生产机上下文时会少给“本机 3000/3001 不健康就是根因”这类强判断：
  - 在当前 Windows + Git Bash 环境里重新验证后，已经不再错误抛出本机端口导致的主因判断
  - 还会明确提示当前机器不像生产机，优先改用 `npm run prod:diagnose:public`
- 已补浏览器层的公网页面审计：
  - `npm run prod:audit:browser:public`
  - 当前实测（2026-06-08）显示主站多个公共页面虽然文档状态仍是 `200`，但加载时继续出现控制台 `502` 错误
  - 新发现：`/search`、`/resources`、`/rules`、`/login`、`/register`、`/forgot-password` 的页面标题仍是 `千服联灯 · 首页`
  - 支付域在浏览器里会先触发证书错误；忽略证书后仍渲染主站首页，而不是 `qianfu-pay-gateway`
  - 现已补 `--kv` / `--json-summary` / `--report-only` 输出模式，方便被证据采集和其他脚本复用
  - `collect-prod-502-evidence.sh` 现在会在 Playwright 可用时顺手打包这份浏览器审计结果
  - 已于 2026-06-08 再校正浏览器审计脚本的本地标题期望值，使其与当前仓库 `SeoHead` 保持一致：
    - 首页期望从旧的“`首页`”改为 `Minecraft 服务器发现与发布平台`
    - 找回密码页期望从旧的“`忘记`”改为 `找回密码`
  - 已于 2026-06-08 对当前仓库本地构建再次做浏览器实测：
    - `npm run build` 生成的当前前端入口仍是 `/assets/index-CHZmvcH-.js`
    - 本地 `vite preview` + `prod:audit:browser:public -- --base http://127.0.0.1:4173 --pay-url http://127.0.0.1:4173 --report-only --kv`
    - 结果已确认 `title_mismatch_routes=none`
    - `search-history` / `search-hash` 的搜索输入交互也仍是 `ok`
    - 本地审计里出现的 `failed_routes=12` 主要来自静态 preview 没有后端 API，触发 `/api/*` 的 `404`，不是标题或路由本身错误
    - 这进一步说明：当前仓库代码里的页面标题 / history 路由转换已经正常，线上“多个页面标题仍停在首页”更像是旧前端 bundle 还没部署
  - 已于 2026-06-08 再补强 `scripts/public-live-browser-audit.cjs`：
    - 新增 `--nav-timeout-ms` / `--dom-ready-timeout-ms` / `--route-ready-timeout-ms` / `--interaction-timeout-ms` / `--stable-wait-ms` / `--wait-until`
    - 新增 `--concurrency`，默认并发 3 个路由，避免故障态下一条条排队吃满超时
    - 默认改为 `wait_until=commit`，先尽快拿到文档响应，再尝试等待 DOM 和路由关键内容
    - 每完成一个路由都会刷新 `report.json`，即使外层命令超时也能留下 `partial_report=true` 的结构化证据
    - 当页面仍是 `about:blank` 时不再把它误判成标题错配；当文档已返回但正文为空时会追加 `empty_body`
  - 最新并发浏览器复核（2026-06-08，`output/playwright/live-public-audit-concurrent-20260608/report.json`）显示：
    - `completed=12/12`、`partial=false`、`failed=12`，完整跑完约 81 秒
    - `renderedTitleMismatchRoutes` 覆盖首页、搜索、资源、规则、登录、注册、找回密码和部分 hash 路由，说明这次不是空白页误判，而是线上旧应用真实渲染后标题仍停在首页
    - `documentFailureRoutes=[]`、`emptyBodyRoutes=[]`，说明并发版在这轮网络状态下拿到了完整文档和正文
    - `resourceFailureRoutes` 覆盖全部路由，主要来自主站和支付域 API 持续 `502`
    - `certificateErrorRoutes=pay-root`，支付域仍触发证书错误，忽略证书后仍渲染主站首页
  - 最新线上慢速浏览器复核（2026-06-08）显示：
    - 多数 history/hash 路由已能拿到 `documentStatus=200`
    - 但正文为空、路由关键内容未出现，并继续显示静态首页标题 `千服联灯 - Minecraft 服务器发现与发布平台`
    - 这更像是线上旧入口 JS `/assets/index-D8ePUst4.js` 加载/执行不稳定，或被边缘资源耗尽问题阻断；不是当前仓库 `SeoHead` 的源码回归
    - 其中 `servers-history` 捕获到 `request_failures=1`，目标是 `/assets/index-D8ePUst4.js`，错误为 `net::ERR_INSUFFICIENT_RESOURCES`
- 已补 `scripts/linux/deploy-bt-oneclick.sh` 的严格失败留证：
  - 当 `--strict-public-smoke` 因公网烟测失败、无法推导公网入口、支付域探针失败、或支付域探针脚本缺失而中断时
  - 现在会先自动执行 `scripts/linux/collect-prod-502-evidence.sh diagnostics`
  - 可以用 `RUN_FAILURE_EVIDENCE=0` 关闭
- 已补 `scripts/linux/collect-prod-502-evidence.sh` 的浏览器审计超时保护：
  - 默认 `BROWSER_AUDIT_TIMEOUT_SECONDS=180`
  - 默认向 `prod:audit:browser:public` 传入较短的 `commit` / DOM / route-ready 超时参数，并设置 `BROWSER_AUDIT_CONCURRENCY=3`
  - 即使浏览器审计被外层 `timeout` 中断，`browser-audit/report.json` 也会尽量保留 partial report
- 已于 2026-06-08 再次复核现网：
  - `npm run probe:frontend-deploy -- --report-only --kv` 结果仍未变，主站首页保持 `remote_root_status=200`
  - 但线上仍引用旧 bundle `/assets/index-D8ePUst4.js`，本地当前构建仍是 `/assets/index-CHZmvcH-.js`
  - `remote_legacy_hash_markers` 与 `search_target_match=false` 仍证明主站静态前端没有部署到当前仓库版本
  - `QIANFU_BASE_URL=https://mc-u.top PAY_DOMAIN_HOST=pay.star-web.top npm run prod:healthcheck:public` 仍报 `11` 项失败
  - 失败项仍覆盖主站 `/api/health`、`/api/ready` 的 `502`，以及支付域证书错绑、主站 HTML 回落、`/health`/`/api/health` 异常
  - `npm run prod:diagnose:win` 已在当前 Windows 环境跑通，能稳定输出：
    - `public-web -> 200`
    - `public-api-health -> 502`
    - `public-pay-root -> 200`
    - `public-pay-health -> 502`
    - `public-pay-api-health -> 502`
    - 以及前端旧 bundle / 旧 hash 路由 SEO 标记 / `search_target_match=false`
  - 最新诊断结论现在还会直接点明：
    - 主站是“静态 HTML 还活着，但 `/api` 边缘已坏”
    - 支付域几乎可以确定命中了主站 TLS/vhost，而不是独立支付站点
    - 因此主站先查 `/api` upstream / app process，支付域先查 `server_name` / 证书 / 站点绑定，优先级已经被自动分开
- 已补 `npm run prod:diagnose:win`，方便在 Windows 环境直接跑“公网优先”的 `scripts/windows/diagnose-prod-502.ps1 -Summary`
- 已补 `npm run prod:diagnose:win:local`，仅在这台 Windows 机器本身就是目标主机时才连同本机 PM2 / 端口 / local health 一起看
- 已补 `scripts/linux/collect-prod-502-evidence.sh`，可在生产机一次性打包：
  - PM2 / `ss` / `ps`
  - 本地 `3000/3001/8889` 探测
  - 主站/支付域公网 `curl` 结果
  - nginx 配置快照
  - `openssl` 证书信息
  - 现有 `diagnose-prod-502` / `prod-healthcheck --public-only` / 前端探针输出
- `scripts/linux/repair-prod-edge.sh` 现已默认在修前先跑这份证据采集，避免边修边丢现场
- `scripts/linux/repair-prod-edge.sh` 现已默认重建 server/frontend 产物，并在替换 Nginx 前检查前端 `dist/index.html`、主站证书和支付域证书是否存在，避免继续把旧 bundle 或错证书状态 reload 出去
- `scripts/linux/repair-prod-edge.sh` 现已默认在修后执行 `prod:diagnose:public --report-only --kv` 做公网验收；设置 `STRICT_PUBLIC_VERIFY=1` 时，如果主站 API、前端 freshness 或支付域 TLS/vhost 仍未恢复，会先再打包一份失败证据，然后退出非零
- `scripts/linux/repair-prod-edge.sh` 现已支持 `VERIFY_ONLY=1`，可只读复用同一套公网验收逻辑，不改 Nginx、不重启 PM2、不要求 root；本机已验证非严格模式会复现三类现网问题并 warning，严格模式会退出非零
- `scripts/linux/repair-prod-edge.sh` 现会把公网诊断的 `recommended_actions` 拆成多行 `[NEXT]`，生产机日志会直接提示三条下一步：主站 API/upstream、前端 dist 部署、支付域证书与 `server_name`
- 已补 `npm run prod:verify:public` 和 `npm run prod:verify:public:strict`，分别对应只读公网验收和严格只读门禁；当前坏现网下普通模式输出 `[NEXT]` 后退出 0，严格模式输出 `[NEXT]` 后退出 1
- 已于 2026-06-07 再次复核现网：
  - `QIANFU_BASE_URL=https://mc-u.top PAY_DOMAIN_HOST=pay.star-web.top npm run prod:healthcheck:public` 现会同时检查主站 API、主站前端 freshness 与支付域
  - 当前仍报 `11` 项失败，覆盖主站 `/api/health`、`/api/ready` 的 `502`
  - 主站前端根页虽然仍是 `200`，但远端 bundle 依旧不是当前本地构建，且仍残留旧 hash 路由 SEO 标记
  - `pay.star-web.top` 仍返回主站 HTML、`/health` 与 `/api/health` 仍 `502`，证书也仍错绑到 `mc-u.top`
- 已把 `scripts/linux/diagnose-prod-502.sh` 与 `scripts/windows/diagnose-prod-502.ps1` 补到会输出前端根页 HTTP 状态，便于区分“主站首页自身坏了”和“首页还能打开但部署物已陈旧”
- 已于 2026-06-07 02:45 +08:00 再次复核现网：
  - `npm run probe:pay-domain` 结果未变，`pay.star-web.top` 仍返回 `mc-u.top` 证书与主站 HTML
  - `npm run probe:frontend-deploy -- --report-only --kv` 结果未变，线上首页仍引用旧 bundle `/assets/index-D8ePUst4.js`
  - 本地最新构建仍是 `/assets/index-CHZmvcH-.js`
  - `remote_last_modified` 仍为 `Sat, 23 May 2026 02:20:23 GMT`
  - 说明线上不只是 API `502` 未修，静态前端也还没有重新部署到当前仓库版本
- 已于 2026-06-07 01:55 +08:00 再次复核现网：
  - `https://mc-u.top/` 仍正常
  - `https://mc-u.top/api/health` 仍返回 `502`
  - `https://mc-u.top/api/ready` 仍返回 `502`
  - `npm run probe:pay-domain` 仍返回 `tls_status=wrong_principal`
  - `pay.star-web.top` 仍回落到 `mc-u.top` 主站 HTML，而不是 `qianfu-pay-gateway`
  - 主站首页页脚仍显示旧文案 `服务状态正常`，说明最新前端降级态修正尚未部署到线上
  - `npm run probe:frontend-deploy` 已确认线上首页仍引用旧 bundle `/assets/index-D8ePUst4.js`
  - 本地最新构建已切到 `/assets/index-CHZmvcH-.js`
  - 线上首页 HTML 仍残留 `#/search`、`#/servers`、`#/resources` 旧 hash 路由 SEO 标记
- 已确认现网问题：
  - `https://mc-u.top/` 正常
  - `https://mc-u.top/api/health` 返回 `502`
  - `https://mc-u.top/api/ready` 返回 `502`
  - `https://pay.star-web.top` 对严格 TLS 客户端证书校验失败
  - `pay.star-web.top` 当前对外更像是误挂到了 `mc-u.top` 的证书/站点
  - 主站静态前端本身也还没有更新到当前仓库的最新构建
- 已完成本地验证：
  - `npm audit --omit=dev` 通过
  - `npm ls tinymce --omit=dev` -> `8.6.0`
  - `npm run typecheck` 通过
  - `npm run typecheck:server` 通过
  - `npm --prefix qianfu-liandeng run build` 通过
  - `npm run guard:structure` 通过
  - `npm run guard:api-contract` 通过
  - `npm run guard:openapi-sync` 通过
  - `npm run guard:style-tokens` 通过
  - `npm run test:coverage:critical` 通过
- 已完成仓库修正：
  - TinyMCE 锁定到安全版本 `8.6.0`
  - 支付域模板/脚本/运行手册从旧 `3001` 收敛到 `3000`
  - 生产默认端口改为严格模式，避免 API 进程静默漂移端口
  - `.env.example` 里的默认端口和回调 URL 已收敛到 `3000`
  - 前端标题改由 `SeoHead` 统一接管，避免 `/login` 等页面标题被“首页”品牌逻辑覆盖
  - 静态结构化数据已移除 `#/search`、`#/servers`、`#/resources` 旧 hash 路由
  - 首页、找服页、桌面页脚已统一接入更诚实的降级态文案，API 不可用时不再继续宣称“服务状态正常”
- 已补充恢复资产：
  - 审计文档：`docs/PROJECT-AUDIT-2026-06-06.md`
  - 恢复手册：`docs/PROD-502-RECOVERY-RUNBOOK-2026-06-06.md`
  - 一键诊断脚本：`scripts/linux/diagnose-prod-502.sh`
  - 域名证书/回站探测脚本：`scripts/utils/domain-cert-probe.mjs`
  - 前端部署新鲜度探针：`scripts/probe-frontend-deploy.ts`
  - `smoke:deploy` 已默认并入前端 freshness 检查
  - Linux / Windows 的 `diagnose-prod-502` 脚本现在也会输出主站前端根页状态、bundle 与旧 hash 路由 SEO 标记状态
  - `probe:frontend-deploy` 已升级为入口资源级部署门禁：除 HTML bundle 名称外，还会比对入口 JS/CSS/modulepreload 清单，并对公网对应资源做 SHA-256 内容一致性检查
  - `prod:diagnose:public` / `qianfu-prod-healthcheck.sh --public-only` 现在会继承入口资源清单与内容一致性信号，能直接暴露 `asset_reference_match=false`、`asset_content_match=false`、`missing_or_mismatched_assets=...`
  - 已新增 `scripts/frontend-dist-manifest.mjs`，根 `npm run build` 会自动在 `qianfu-liandeng/dist/qianfu-dist-manifest.json` 写入完整 dist 文件数、总字节数、整体 hash、入口资源和逐文件 SHA-256
  - 已新增 `npm run prod:verify:frontend:manifest` / `npm run prod:verify:frontend:files` / `npm run prod:verify:frontend:files:sample`，用于发布后分别验证远端 manifest、全量公网文件内容和快速抽样
  - `smoke:deploy` 的前端 freshness 检查已改为调用同一个 `probe:frontend-deploy`，严格发布烟测也会继承入口 assets 一致性检查
  - 已新增 `scripts/linux/deploy-frontend-dist.sh` 与 `npm run prod:deploy:frontend`，生产机可用 staging dist 原子替换 `WEB_ROOT`，自动生成 manifest、备份旧 dist、reload Nginx 并做公网静态验收
  - `repair-prod-edge.sh` 的前端构建已改为调用 `deploy-frontend-dist.sh`，避免在 live `dist` 里直接 Vite build
  - `repair-prod-edge.sh` 现在支持 `REPAIR_SCOPE=web|pay|all`，并新增 `npm run prod:repair:web` / `npm run prod:repair:pay` 与 `prod:verify:public:web` / `prod:verify:public:pay`；主站恢复可以不再被支付域证书缺失或错绑阻塞，pay-only 也不会替换主站 Nginx 配置或 SPA headers include
  - 已新增 `scripts/linux/restore-prod-public.sh` 与 `npm run prod:restore:public` / `prod:restore:public:dry` / `prod:restore:preflight`，用于生产机终端一键串起“初始公网诊断 -> web scoped repair -> pay scoped repair -> all-scope 严格公网验收”，并把日志写入 `logs/prod-restore/`
  - 已新增 `scripts/linux/package-prod-restore-bundle.sh` 与 `npm run prod:restore:bundle` / `prod:restore:bundle:dry`，用于 SSH 不通但宝塔文件管理可上传时打包恢复脚本、Nginx 模板、诊断工具和当前 `qianfu-liandeng/dist`
  - `prod:diagnose:public`、`qianfu-prod-healthcheck.sh`、`diagnose-prod-502.sh`、`diagnose-prod-502.ps1` 已接入远端 manifest 信号，输出 `frontend_manifest_match` / `frontend_manifest_error` / `frontend_manifest_dist_hash`，一条公网诊断即可判断 `/qianfu-dist-manifest.json` 是否真实部署到站点根
  - `repair-prod-edge.sh` 现在会在边缘修复后顺手检查主站前端是否仍是旧 bundle
  - `deploy-bt-oneclick.sh` 现在支持 `--strict-public-smoke` / `STRICT_PUBLIC_SMOKE=1`，可把公网烟测失败直接升级为部署失败
  - `deploy-bt-oneclick.sh` 现在还能在可推导出独立支付域时自动复用 `probe:pay-domain`，提前发现支付域证书错绑、主站 HTML 回落、或 `qianfu-pay-gateway` 根标记缺失
  - `setup-bt-cron.sh` 现在也支持生成带 `--strict-public-smoke` 的宝塔计划任务命令
  - `qianfu-prod-healthcheck.sh` 现在在配置了独立支付域时也会检查支付域根标记、`/health`、`/api/health`、证书命中与主站 HTML 回落
  - `qianfu-prod-healthcheck.sh` 现在支持 `--public-only`，可从任意联网环境直接复核主站 API、主站前端 freshness 与支付域已部署状态，不再混入 PM2/MySQL/内存噪音
  - 已补 `npm run prod:healthcheck:public` 作为公网复核别名，方便在非生产机环境直接复核主站 API、前端 freshness 与支付域
  - `prod:healthcheck` / `prod:healthcheck:public` 现已改走 Node wrapper，在当前 Windows 环境会优先使用 Git Bash，避免误落到坏掉的 WSL `bash`
  - 支付域部署脚本现在会做证书/站点回落验收：`scripts/linux/setup-pay-domain.sh`
  - 主站/支付域模板 upstream 已拆分命名，避免 nginx `duplicate upstream` 阻断修复脚本

## 高概率根因

- 主站 API 502：
  - 很可能是生产 Nginx upstream 仍指向 `127.0.0.1:3001`
  - 而当前 `qianfu-api` 默认已回到 `3000`
- 支付域异常：
  - 可能仍使用旧端口
  - 也很可能独立叠加了证书 / `server_name` / 站点回落问题
  - 当前外部证据指向：`pay.star-web.top` 实际发出的是 `mc-u.top` 证书
  - 当前仓库已经补充防呆：支付域根路径应返回 `qianfu-pay-gateway`，部署脚本会主动检查这一点
- 页面级问题：
  - 仓库内已修正标题与 hash 路由 SEO 问题，但线上站点要等下一次前端部署后才会体现
  - 仓库内已修正首页、找服页、页脚的降级态提示，但线上站点要等下一次前端部署后才会体现
  - 当前还可以明确证明线上首页静态资源本身是旧包，不只是后端 API 在报 `502`
  - 2026-06-08 新增资产级验证后，公网输出为 `frontend_asset_reference_match=false`、`frontend_asset_content_match=false`，且当前本地入口 `/assets/index-CHZmvcH-.js` 在线上返回 `404`，进一步证明现网没有完整部署当前 `qianfu-liandeng/dist`
  - 2026-06-08 新增 manifest 验证后，本地 dist 清单为 `file_count=1862`、`total_bytes=34578127`、`dist_hash=3062911fd997413f5aa818e2e0aeed049d166fb1a63634fca18f575edb80e007`；公网 `/qianfu-dist-manifest.json` 返回的是 SPA HTML 而不是 JSON，抽样 25 个文件时多个当前 dist chunk 返回 `404`
  - 2026-06-08 最新公网总诊断已能直接输出 `frontend_manifest_match=false` 与 JSON 解析错误，后续无需单独跑 manifest 命令也能识别“manifest 未发布 / SPA fallback 接管 manifest URL”
  - 2026-06-09 早间复核：`prod:verify:public:web` / `prod:verify:public:pay` 均只读跑完并保留红灯，`prod:verify:public:web:strict` 按预期退出非零；公网仍是主站 `/api/health` 与 `/api/ready` 返回 `502`、主站旧 bundle、`qianfu-dist-manifest.json` 返回 HTML、支付域证书错绑到 `mc-u.top`
  - 2026-06-09 早间也确认当前本机没有可用的非交互 SSH 通道：`ssh -o BatchMode=yes root@103.236.92.10 "hostname"` 返回 `Connection closed by 103.236.92.10 port 22`，因此真实生产修复仍需要在宝塔/生产机终端执行仓库内脚本
  - 2026-06-09 继续补了生产机总恢复入口；当前首选真实操作是登录宝塔/生产机终端后执行 `cd /www/wwwroot/qianfu-app && sudo bash scripts/linux/restore-prod-public.sh`，需要预览时先跑 `bash scripts/linux/restore-prod-public.sh --dry-run`
  - 2026-06-09 07:42 复核：`prod:restore:public:dry` 已能打印完整阶段命令且不会执行真实变更；`prod:diagnose:public --report-only --kv` 仍显示 `finding_count=4`，主站 API 502、旧 bundle、manifest HTML 回落、支付域 TLS/vhost 回落均未恢复；`prod:verify:public:web:strict` 继续按预期退出非零
  - 2026-06-09 继续补 `restore-prod-public.sh --preflight-only`，用于生产机真实修复前只读检查核心仓库文件、命令、Nginx 模板、Let’s Encrypt 证书路径和 vhost 配置路径；本机入口为 `npm run prod:restore:preflight`
  - 2026-06-09 08:11 复核：`npm run prod:restore:preflight` 通过核心仓库文件、`bash`/`node`/`npm` 检查，并按预期对本机缺少的 `pm2`、`nginx`、`systemctl`、Let’s Encrypt 证书和宝塔 vhost 给 warning；`prod:restore:public:dry` 与 `restore-prod-public.sh --help` 正常；`prod:diagnose:public` 仍为 `finding_count=4`，`prod:verify:public:web:strict` 继续非零退出
  - 2026-06-09 继续补恢复包生成路径：本地 `npm run prod:restore:bundle` 会产出 `output/prod-restore-bundles/qianfu-prod-restore-<timestamp>.tar.gz`，生产机解包后可执行 `sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/restore-prod-public.sh`
  - 2026-06-09 09:07 已生成并验证恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-090718.tar.gz`，SHA-256 为 `dc543524654e927117e7d97f913d781a76b3d04cdcc57450754f4b3f86daefda`；包内包含 `restore-prod-public.sh`、`repair-prod-edge.sh`、Nginx 模板、`qianfu-dist-manifest.json`、当前入口 `/assets/index-CHZmvcH-.js` 和无需 `tsx` 的 `scripts/prod-restore-runners/*.mjs`，解包到 `.runtime/prod-restore-runner-verify-final` 后 preflight 通过，runner 直接诊断得到 `finding_count=4`，严格 web 门禁继续按预期非零退出
  - 2026-06-09 09:33 继续复核：新会话按 AGENTS 先执行 `auto-pull-codex-stack.ps1`，因已有同步进程返回 `[SKIP]`；CodeGraph 查询命中生成产物后改用 `rg` 和仓库脚本定位。当前生产 DNS 为 `mc-u.top -> 103.236.92.10`、`pay.star-web.top -> 103.236.92.10`。TCP 探针显示 `103.236.92.10:80/443` 开放、`:22` 超时，`ssh root@103.236.92.10` 仍无法进入生产机，因此本机不能直接发布，只能准备恢复包或等待宝塔/生产机终端。
  - 2026-06-09 09:33 本机重新执行 `npm run build` 成功，当前前端入口仍为 `/assets/index-CHZmvcH-.js`，本地 `qianfu-liandeng/dist/qianfu-dist-manifest.json` 为 `file_count=1862`、`total_bytes=34578127`、`dist_hash=3062911fd997413f5aa818e2e0aeed049d166fb1a63634fca18f575edb80e007`。公网诊断报告写入 `output/prod-public-verify/continue-20260609-01.json`，结论仍是 `finding_count=4`：主站 `/api/health` 与 `/api/ready` 均 `502`，线上入口仍是 `/assets/index-D8ePUst4.js`，`/qianfu-dist-manifest.json` 返回 HTML，支付域证书 CN/SAN 仍是 `mc-u.top` 且根页回落主站。
  - 2026-06-09 09:33 已重新生成恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-093359.tar.gz`，SHA-256 为 `7d6cb35ef0547f0af89a832c73c226ebff4bc288087de678d9e6f7ce67938277`；`tar -tzf` 抽查确认包含 `scripts/linux/restore-prod-public.sh`、`scripts/linux/deploy-frontend-dist.sh`、`scripts/prod-restore-runners/diagnose-public-prod.mjs`、`deploy/nginx/pay.star-web.top.conf.example`、`qianfu-liandeng/dist/qianfu-dist-manifest.json` 与当前入口 `/assets/index-CHZmvcH-.js`。若只能走宝塔文件管理，上传该包到生产机后在 `/www/wwwroot/qianfu-app` 解包，再依次执行 `bash scripts/linux/restore-prod-public.sh --preflight-only`、`bash scripts/linux/restore-prod-public.sh --dry-run`、`sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/restore-prod-public.sh`。
  - 2026-06-09 09:38 浏览器层公网审计完成，报告目录为 `output/playwright/live-public-audit-2026-06-09T01-37-21-407Z/report.json`；`planned_routes=12`、`completed_routes=12`、`failed_routes=12`，`common_error_responses` 仍包含主站 `/api/health` 与多条业务 API 的 `502`。支付域 `pay-root` 触发 `certificate_error=true`，最终标题为 `千服联灯 · 首页`，canonical 与 og:url 均为 `https://mc-u.top/`，说明浏览器用户视角也确认 pay 域回落主站，而不是独立支付网关。
  - 2026-06-09 09:42 继续复核：`auto-pull-codex-stack.ps1` 本轮完整同步 GSAP skills、CodeGraph 和 graphify；公网诊断再次写入 `output/prod-public-verify/continue-20260609-02.json`，结论仍是 `finding_count=4`。端口探针显示 `103.236.92.10:80/443/21` 开放，但 `22/2222/22022/10022/3000/3001/7800/8888/8889/10000` 不可用或超时；`curl.exe ftp://103.236.92.10/` 20 秒超时，本地环境变量和 `.env` 未发现 `QF_DEPLOY_PASSWORD`、FTP 或宝塔凭据，因此当前机器仍不能直接 SSH/FTP/宝塔发布。
  - 2026-06-09 09:45 已新增前端静态专用包 `output/frontend-dist-bundles/qianfu-liandeng-dist-20260609-0945.zip`，SHA-256 为 `3833e77e03fe4cef0876741d8e05d89a1345d38ed1496dd049f7acb2c8789ce6`；zip 内容抽查确认根目录直接包含 `index.html`、`qianfu-dist-manifest.json`、`assets/index-CHZmvcH-.js`、`assets/index-CIUYiekq.css`。该包适合只能通过宝塔文件管理或 FTP 替换 `/www/wwwroot/qianfu-app/qianfu-liandeng/dist` 的场景，只能修旧 bundle / manifest，不能修主站 API `502` 或支付域证书/vhost。
  - 2026-06-09 09:45 已新增 `docs/PROD-RESTORE-UPLOAD-GUIDE-2026-06-09.md`，把全量恢复包、前端静态 zip、上传位置、生产机执行命令和发布后验收指标拆开记录；后续恢复优先按该文档和本文件继续，不要重新摸索路径。
  - 2026-06-09 09:48 已新增 `scripts/windows/upload-frontend-dist-ftp.ps1`，用于拿到 FTP 凭据后从本机递归上传当前 `qianfu-liandeng/dist` 到 `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`；脚本依赖 `QF_FTP_USER` / `QF_FTP_PASSWORD`，默认不删除远端旧文件。已执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/upload-frontend-dist-ftp.ps1 -DryRun -PreviewLimit 8`，成功枚举 `1863` 个 dist 文件并正确映射远端路径；真实上传仍等待 FTP 凭据或其他管理通道。
  - 2026-06-09 10:01 已给 `scripts/windows/upload-frontend-dist-ftp.ps1` 增加 `-VerifyAfterUpload`，真实上传后可自动执行远端 manifest 比对和 80 个文件抽样比对；dry-run 已验证会正确预览上传路径和验收动作。
  - 2026-06-09 10:03 已新增 `scripts/windows/verify-public-production.ps1` 与 npm 别名 `npm run prod:verify:public:win`，用于恢复后统一跑公网总诊断、前端 manifest、前端文件抽样、支付域探针。首次 report-only 抓到 summary 输出污染后已修复；复测完整 4 项得到 `failed_count=4`，其中支付域探针会解析 `tls_status=ok`、`root_marker_match=true`、`looks_like_main_site=false`，不再被工具的 0 退出码误判为通过。精简别名复测 `npm run prod:verify:public:win -- -ReportOnly -SkipFrontendFiles -SkipPayDomain` 可正常输出 `failed_count=2`。
  - 2026-06-09 11:10 已新增生产机终端最小修复入口 `scripts/linux/prod-terminal-minimal-repair.sh`，默认流程是固定 `qianfu-api` 到 `PORT=3000`/`PORT_STRICT=true`、复用现有 `repair-prod-edge.sh` 分别修 web/pay、最后跑严格公网验收；默认 `RUN_BUILD_ARTIFACTS=0`，适合已经上传恢复包或当前 dist 的场景。新增 npm 别名 `prod:repair:terminal:preflight` / `prod:repair:terminal:dry`，本机 preflight 与 dry-run 通过，dry-run 不再执行本地 curl 状态探针。
  - 2026-06-09 11:11 已将 `prod-terminal-minimal-repair.sh` 纳入 `scripts/linux/package-prod-restore-bundle.sh`；`npm run prod:restore:bundle:dry` 确认会包含该脚本。已生成新版恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-111116.tar.gz`，SHA-256 为 `b1c9055ee2fbf06e73c9e3edc41a855272726214b951490a22736ee4a7efaba6`；`tar -tzf` 抽查确认包含 `scripts/linux/prod-terminal-minimal-repair.sh`、`scripts/linux/restore-prod-public.sh`、`qianfu-liandeng/dist/qianfu-dist-manifest.json` 与 `/assets/index-CHZmvcH-.js`。`docs/PROD-RESTORE-UPLOAD-GUIDE-2026-06-09.md` 已更新为优先使用该新版包。
  - 2026-06-09 11:21 已新增生产机只读快照脚本 `scripts/linux/prod-terminal-snapshot.sh`，一条命令输出基础信息、关键文件、PM2、监听端口、本机 API、Nginx conf 摘要、Let’s Encrypt 证书、公网探针和 bundled `diagnose-public-prod.mjs` 诊断；本机 `APP_ROOT=.` 测试通过，输出确认公网仍为 `/api/health=502`、`/api/ready=502`、`/qianfu-dist-manifest.json=200 text/html`、`/assets/index-CHZmvcH-.js=404`、支付域根页 `200 text/html`。
  - 2026-06-09 11:23 已将 `prod-terminal-snapshot.sh` 纳入恢复包生成脚本，`npm run prod:restore:bundle:dry` 确认包含该脚本。已生成最终新版恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-112300.tar.gz`，SHA-256 为 `5329f4caad44556f91be3a6c1ee541ee95b9ac60aa7c30cd51c6bc09eaa58d86`；抽查确认包含 `prod-terminal-snapshot.sh`、`prod-terminal-minimal-repair.sh`、`scripts/prod-restore-runners/diagnose-public-prod.mjs`、`qianfu-dist-manifest.json` 和当前入口 `/assets/index-CHZmvcH-.js`。`docs/PROD-RESTORE-UPLOAD-GUIDE-2026-06-09.md` 与新建 `docs/PROD-OPERATOR-CHECKLIST-2026-06-09.md` 均已指向该最终包。
  - 2026-06-09 11:31 发现上一版恢复包虽包含 snapshot 和最小修复脚本，但包内 README 未包含新入口，且操作单只在本地文档中。已更新 `scripts/linux/package-prod-restore-bundle.sh`：包内 README 现在首推 `prod-terminal-snapshot.sh` + `prod-terminal-minimal-repair.sh`，并把 `docs/PROD-OPERATOR-CHECKLIST-2026-06-09.md`、`docs/PROD-RESTORE-UPLOAD-GUIDE-2026-06-09.md` 一起打包。已生成真正自带操作单的最终包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-113153.tar.gz`，SHA-256 为 `94e7dfa8f7cfa34c88f50068628c3a2d296141707a4962557936cd274b7259a4`；`tar -tzf` 抽查确认包含 `README-PROD-RESTORE.txt`、两份 docs、`prod-terminal-snapshot.sh`、`prod-terminal-minimal-repair.sh`、`qianfu-dist-manifest.json` 和当前入口 `/assets/index-CHZmvcH-.js`，并已抽取 README 验证其中命令正确。两份操作文档已更新为优先使用该 `113153` 包。
  - 2026-06-09 11:43 继续复核：新会话按 AGENTS 先执行 `auto-pull-codex-stack.ps1`，当前返回 `[SKIP] Another Codex auto-pull is already running`。`ssh -o BatchMode=yes -o ConnectTimeout=12 starbot-103 "hostname; whoami"` 以及严格指定 `-o IdentitiesOnly=yes -i C:/Users/l/.ssh/starbot_103_ed25519 root@103.236.92.10` 均返回 `Permission denied (password)`；说明 `103.236.92.10:22` 已开放但当前本机 key 未被服务器接受。随后已用本机 `.ssh` 现有私钥逐个测试 `root`，并测试 `www`、`ubuntu`、`admin`、`deploy`、`qianfu` 等常见用户，均为 `Permission denied (password)`；可排除“alias 绑定旧 key”或“只是不知道用户名”的情况。公网完整验收 `npm run prod:verify:public:win` 写入 `output/prod-public-verify/verify-public-20260609-114332.json`，仍为 `failed_count=4`：主站 `/api/health`、`/api/ready` 均 `502`，线上入口仍是 `/assets/index-D8ePUst4.js`，当前本地入口 `/assets/index-CHZmvcH-.js` 在线上 `404`，`/qianfu-dist-manifest.json` 返回 HTML，支付域证书 CN/SAN 仍是 `mc-u.top` 且根页回落主站。已检查本机环境变量、SSH alias、常见 FileZilla/WinSCP/rclone 配置，未发现可直接使用的 FTP/面板/部署凭据；当前可执行下一步仍是拿到 SSH 密码/宝塔终端/FTP 凭据后上传并执行 `output/prod-restore-bundles/qianfu-prod-restore-20260609-113153.tar.gz` 内操作单。
  - 2026-06-09 12:04 继续完善凭据到位后的闭环入口：新增 `scripts/windows/invoke-prod-restore-ssh.ps1` 和 npm 别名 `prod:restore:ssh:win`，支持自动选择最新恢复包、`scp` 上传、远端解包、执行 `prod-terminal-snapshot.sh`、`prod-terminal-minimal-repair.sh --preflight-only`、`--dry-run --no-strict`、正式修复，并在本机回跑 `npm run prod:verify:public:win`；脚本不接收或打印明文密码，密码登录交给 OpenSSH 交互提示。本机 `npm run prod:restore:ssh:win -- -DryRun` 通过，输出会上传 `qianfu-prod-restore-20260609-ssh-ready.tar.gz` 到 `/www/wwwroot/` 并在 `/www/wwwroot/qianfu-app` 执行修复命令。已将该脚本、`upload-frontend-dist-ftp.ps1`、`verify-public-production.ps1` 纳入恢复包生成脚本，并生成固定名恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-ssh-ready.tar.gz`，SHA-256 为 `bfce56fa7de96edf21d81d5d84aa2b59d5dbf2e04913e7e5cd0f8d8a3e1a5094`；`tar -tzf` 抽查确认包含 `README-PROD-RESTORE.txt`、两份 docs、新 SSH 执行器、FTP 上传器、统一公网验收器、`prod-terminal-snapshot.sh`、`prod-terminal-minimal-repair.sh`、`scripts/prod-restore-runners/diagnose-public-prod.mjs`、`qianfu-dist-manifest.json` 和当前入口 `/assets/index-CHZmvcH-.js`。同步新增运维消息 `output/prod-restore-bundles/OPERATOR-MESSAGE-20260609-ssh-ready.txt`。公网复核 `npm run prod:verify:public:win` 写入 `output/prod-public-verify/verify-public-20260609-115409.json`，仍为 `failed_count=4`；DNS 未发现 `bt.mc-u.top`、`panel.mc-u.top`、`admin.mc-u.top` 等隐藏面板子域名，常见面板端口未开放，补扫也确认 `3000/3001/8080/8443/9000` 不开放。
  - 2026-06-09 14:05 恢复目标被用户继续唤醒后重新复核：`npm run prod:verify:public:win` 写入 `output/prod-public-verify/verify-public-20260609-140547.json`，仍是 `failed_count=4`，主站 API 502、旧 bundle、manifest HTML 回落、支付域证书/vhost 回落均未恢复；端口复核仍只有 `21/22/80/443` 开放，`3000/3001/8080/8443/888/8888/8889/7800/10000/20000/39000` 不开放或未完成开放确认；DNS 仍未发现 `bt.mc-u.top`、`panel.mc-u.top`、`admin.mc-u.top`、`api.mc-u.top` 等隐藏子域。已增强 `scripts/windows/invoke-prod-restore-ssh.ps1`，新增 `-WebOnly` / `-PayOnly` 作用域参数，默认全量恢复不变；本机 dry-run 已验证默认、`-WebOnly`、`-PayOnly` 三条路径会生成正确远端命令，同时传两个作用域会失败防误操作。已更新两份恢复文档和运维消息，并重新生成固定名恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-ssh-ready.tar.gz`，当前 SHA-256 为 `fabc6f469b13533298fa2e21f7d38b08b7bf2a137fc735e5b1e675cccf27e3fc`；包内抽查确认新 SSH 执行器和文档均包含 `WebOnly` / `PayOnly`。
  - 2026-06-09 14:24 用户提供一组密码后继续尝试：为避免明文落盘，新增 `scripts/remote_restore_password.py`，通过 `QF_SSH_PASSWORD` 或 `QF_SSH_PASSWORD_B64` 读取密码，配合已本地安装到 `.runtime/python-ssh` 的 Paramiko 做非交互 SSH 上传/执行；新增 npm 别名 `prod:restore:ssh:password`。该脚本 dry-run 现不需要密码，`npm run prod:restore:ssh:password -- --dry-run --web-only` 与 `--pay-only` 均已通过。实际 SSH 探测中，该密码对 `root/www/admin/add/ubuntu/deploy/qianfu` 均返回认证失败；FTP 端口虽开放，但 Pure-FTPd 在登录前返回 `421 Unable to read the indexed puredb file (or old format detected) - Try pure-pw mkdb`，说明 FTP 服务端用户库损坏或未生成，不能作为当前恢复通道。已将密码版执行器纳入恢复包，重新生成固定名恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-ssh-ready.tar.gz`，当前 SHA-256 为 `3eeb2983bd794c9e6e7c422f7007cf76527c5aa542ce0f54a33c855c803f595c`，并验证实际文件哈希与 `.sha256` 一致。
  - 2026-06-09 15:08 最终恢复完成：使用密码版 Paramiko SSH 通道登录 `root@103.236.92.10` 后，主站已恢复到当前前端 dist 与 `127.0.0.1:3000` 上的既有 `starmc-web-next` API；冲突/崩溃的 `qianfu-api` PM2 进程已删除并 `pm2 save`，不要再用它抢占 `3000`。主站公网 `/api/health=200`、`/api/ready=200`、`/qianfu-dist-manifest.json=200 JSON`、`/assets/index-CHZmvcH-.js=200`，manifest 与本地 dist hash `3062911fd997413f5aa818e2e0aeed049d166fb1a63634fca18f575edb80e007` 匹配。
  - 2026-06-09 15:08 支付域最终修复：`pay.star-web.top` 缺少独立 vhost 和证书，实际命中默认 `mail.0st.top` 证书。已在生产机写入 `/www/server/panel/vhost/nginx/pay.star-web.top.conf`，并建立 `/etc/nginx/sites-enabled/pay.star-web.top.conf -> /www/server/panel/vhost/nginx/pay.star-web.top.conf`；用 webroot ACME 签发 `/etc/letsencrypt/live/pay.star-web.top/`，证书 CN/SAN 均为 `pay.star-web.top`，到期日为 `2026-09-07`。`https://pay.star-web.top/` 当前返回 `qianfu-pay-gateway`。
  - 2026-06-09 15:08 公网总验收通过：`npm run prod:verify:public:win` 写入 `output/prod-public-verify/verify-public-20260609-150833.json`，summary 为 `failed_count=0`；`public diagnosis`、`frontend manifest`、`frontend file sample`、`pay domain probe` 全部 PASS。修复后已把脚本经验固化到 `scripts/linux/setup-pay-domain.sh` 与 `scripts/linux/repair-prod-edge.sh`：以后 pay vhost 会自动启用 `sites-enabled` symlink，pay 证书改走 webroot ACME。
  - 2026-06-09 15:18 已重新生成包含 symlink 修复和最新操作文档的恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-151807.tar.gz`，SHA-256 为 `a70c612962fd4014ba2d6868d3c73492cc642270b55dd171804582a9555982d9`；固定名 `output/prod-restore-bundles/qianfu-prod-restore-20260609-ssh-ready.tar.gz` 已同步到同一内容和同一 SHA-256。
  - 2026-06-09 15:19 最终复核：`npm run prod:verify:public:win` 再次通过，写入 `output/prod-public-verify/verify-public-20260609-151938.json`，`failed_count=0`，四个阶段均 PASS。
  - 2026-06-09 15:24 用户继续唤醒后的完成审计再次复核：`npm run prod:verify:public:win` 写入 `output/prod-public-verify/verify-public-20260609-152455.json`，`failed_count=0`；公网诊断、frontend manifest、frontend file sample、pay domain probe 全部 PASS。单项 curl 也确认 `https://mc-u.top/api/health=200`、`https://mc-u.top/api/ready=200`、`https://pay.star-web.top/` 返回 `qianfu-pay-gateway`。
  - 2026-06-09 18:06 继续执行“除了支付全面修复”：确认旧公网验收虽绿但浏览器运行期存在 `/api/v1/*` 业务 404。已在生产机将 `qianfu-api` 以 PM2 运行到 `127.0.0.1:3001`，主站 Nginx `/api/` upstream 从 `127.0.0.1:3000` 切到 `127.0.0.1:3001`，移除 `/api/ready` 静态假绿，并补齐 `/health` 的 `X-Forwarded-*` 代理头；远端 `ecosystem.config.cjs` 已补 `PORT_STRICT=true` 并 `pm2 save`。`scripts/public-live-browser-audit.cjs` 已补匿名 `/api/v1/profile` 会话探测豁免、文档导航一次重试、late-ready warning 规则。最终非支付浏览器审计 `node scripts/public-live-browser-audit.cjs --report-only --kv --skip-pay --out-dir output/playwright/live-public-audit-nonpay-final-lateready-20260609-1806` 通过：`planned_routes=11`、`completed_routes=11`、`failed_routes=0`、`common_error_responses=none`；`npm run prod:verify:public:win` 报告 `output/prod-public-verify/verify-public-20260609-175753.json` 仍为 `failed_count=0`。本地已同步 `ecosystem.config.cjs`、`deploy/nginx/mc-u.top.conf.example`、`repair-prod-edge.sh`、`prod-terminal-minimal-repair.sh`、`prod-terminal-snapshot.sh` 的 3001 防回归配置，并记录到 `docs/PROD-ISSUES-2026-06-09.md`。
  - 2026-06-09 18:21 继续查剩余非支付问题：公网确认找回密码/重置密码和资料页改密契约仍坏，`/api/v1/auth/forgot-password`、`/api/v1/auth/reset-password`、`/api/v1/auth/password-reset`、`/api/v1/profile/password` 均为 404；`/api/v1/change-password` 存在但前端未调用且旧实现依赖 SuperTokens。源码已补本地密码体系下的 forgot/reset/password-reset/profile-password 路由，`changePassword` 优先校验/更新 Prisma `password_hash`，并给注册、验证码验证、GitHub OAuth 回调补写 `qf_auth_token` httpOnly cookie。`scripts/windows/verify-public-production.ps1` 已默认加入非支付浏览器审计步骤。待构建部署后复测线上 404 是否消失。
  - 2026-06-09 18:36 已部署认证链路修复：本地 `npm --prefix qianfu-liandeng run build`、`npx tsc --noEmit --project tsconfig.server.build.json`、`npm run server:build` 均通过；恢复包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-authfix.tar.gz` 带前端 dist 和 dist-server，已上传生产并用 `prod-terminal-minimal-repair.sh --web-only` 重启 `qianfu-api`/刷新主站 edge。公网总验收 `npm run prod:verify:public:win` 写入 `output/prod-public-verify/verify-public-20260609-183610.json`，`failed_count=0`，新增 `non-payment browser audit` PASS，线上入口 `/assets/index-BeHZzuik.js`，manifest hash `5982da2007b1a481f5d7670c4bbdcb81bd48d8db4189fdcca177c03fdddfba33`。认证接口复测：forgot-password 200，错误 reset code/token 均 400，未登录 profile/password 为 401；Playwright 交互确认 `/forgot-password` 提交邮箱后进入验证码步骤。
  - 2026-06-09 19:32 继续执行“找出还有什么问题”：修复公开登录/注册/忘记密码/重置密码页被 `INITIALIZING_SESSION...` 阻塞的路由守卫；修复前端 dist 旧 chunk 累积，新增 `scripts/clean-frontend-dist.mjs` 并让部署器在 web/full 恢复前安全清理远端 `qianfu-liandeng/dist`；修复生产恢复脚本本机健康检查 Host 白名单误报、PM2 重启后未等待 API 就绪、snapshot 硬编码旧入口，以及密码部署器 Windows `npm.cmd` 查找问题。最终包 `output/prod-restore-bundles/qianfu-prod-restore-20260609-cleanops.tar.gz` 已部署；生产机 manifest 为 `file_count=379`、`dist_hash=86d9baa11e23ccbd5e87511146e7c23c545104f0f170b30cc5d4e9ecfc04180e`，只剩当前入口 `index-CXHPtwrK.js`。完整公网验收 `npm run prod:verify:public:win` 写入 `output/prod-public-verify/verify-public-20260609-193046.json`，`failed_count=0`；非支付浏览器审计 PASS。剩余非阻断风险：`test:preload` 目标 5 个测试文件缺失但返回 0，`test:coverage:critical` 仍有 6 个目标缺失且覆盖率 0/0；lint 仍有 45 个 warning；生产 Redis 服务 failed 但应用配置禁用，SuperTokens 服务 inactive 但当前本地密码链路已兜底，CMS 未配置导致同步禁用。
  - 2026-06-09 20:02 继续补齐“还剩什么问题”的验证面：新增 `scripts/browser-nonpay-auth-validation.cjs` 与 `npm run smoke:browser-auth:nonpay`，只测非支付登录态路径，覆盖桌面用户、移动用户和管理员非支付页面，排除旧脚本里的 `/admin-qianfu` 支付配置页。生产实跑报告 `output/prod-auth-nonpay-verify/current/auth-nonpay-2026-06-09T11-58-28-196Z.json`，`plannedRoutes=26`、`passedRoutes=26`、`failedRoutes=0`。同时修复测试门禁空跑：`test:preload` 现在真实跑 5 个测试文件并通过 `23` 条测试，`test:coverage:critical` 真实跑 14 个测试文件并通过 `91` 条测试，关键覆盖率为 Statements `87.73%`、Branches `71.65%`、Functions `96.55%`、Lines `89.96%`。`npm run typecheck`、`npm run typecheck:server`、`npm run prod:verify:public:win` 也均通过，最新公网验收报告为 `output/prod-public-verify/verify-public-20260609-195930.json`。当前剩余非阻断风险收敛为：45 个 lint warning、生产 `redis-server=failed`、`supertokens=inactive`、Nginx 443 protocol options warning、邮件真实到达率未做端到端收件箱验证。

## 必须在生产机验证

- `pm2 status qianfu-api --no-color`
- `pm2 describe qianfu-api`
- `ss -lntp | grep -E ':3000|:3001|:8889|:443|:80'`
- `curl http://127.0.0.1:3001/api/health`
- `/www/server/panel/vhost/nginx/mc-u.top.conf`
- `/www/server/panel/vhost/nginx/pay.star-web.top.conf`
- `/etc/letsencrypt/live/pay.star-web.top/`
- `openssl s_client -connect pay.star-web.top:443 -servername pay.star-web.top`

## 最短下一步

在生产机执行：

```bash
bash scripts/linux/diagnose-prod-502.sh
```

若只先修复主站前端静态目录，执行：

```bash
sudo WEB_DOMAIN=mc-u.top bash scripts/linux/deploy-frontend-dist.sh
```

如果本地 `3001` 健康但公网 API 仍 502，优先把 nginx upstream 改到 `127.0.0.1:3001`，然后：

```bash
nginx -t && systemctl reload nginx
```

之后再跑：

```bash
QIANFU_BASE_URL=https://mc-u.top bash scripts/linux/qianfu-prod-healthcheck.sh
```

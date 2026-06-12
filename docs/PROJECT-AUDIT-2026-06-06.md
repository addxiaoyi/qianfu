# 千服项目检测记录 - 2026-06-06

检测时间：2026-06-06 19:33 +08:00

## 范围

- 本地仓库：`D:\qwq\项目\千服`
- 前端主应用：`qianfu-liandeng`
- 服务端：`server`
- 已部署主站：`https://mc-u.top`
- 支付域名线索：`https://pay.star-web.top`

## 结论

当前源码的基础质量门禁大多通过，前端生产构建可用，主站静态页面也能正常打开；但已部署环境存在高优先级故障：主站 API 网关返回 `502`，支付域名存在证书/站点绑定错误。仓库内已顺手完成 TinyMCE 安全升级、把支付域模板/脚本里的旧端口配置从 `3001` 收敛到当前主流 `3000`，并加固了生产环境的固定端口策略，避免进程静默漂移到 `3001/3002` 后把 Nginx upstream 打成 `502`。

## 已确认问题

### P0：线上主站 API 返回 502

复现：

```powershell
curl.exe -k -I -L --max-time 20 https://mc-u.top/api/health
curl.exe -k -I -L --max-time 20 https://mc-u.top/api/ready
```

结果：

- `https://mc-u.top/` 返回 `200 OK`
- `https://mc-u.top/api/health` 返回 `502 Bad Gateway`
- `https://mc-u.top/api/ready` 返回 `502 Bad Gateway`

浏览器影响：

- 首页可渲染，标题为 `千服联灯 · 首页`
- 浏览器控制台未看到前端 error/warn
- 首页“实时状态”指标显示 `—`
- `/servers` 页面显示 `目前共有 0 个已公开的服务器可浏览`

判断：静态前端由 nginx 正常提供，但 nginx 到 Node API 的上游链路不可用。结合当前仓库状态，`server/index.ts`、`ecosystem.config.cjs`、`deploy/nginx/qianfu.same-domain.conf.example`、`scripts/linux/deploy-bt-oneclick.sh` 都以 `3000` 为默认 API 端口；而部分旧生产文档仍保留 `3001`。现网最可疑根因是 nginx upstream 仍在转发 `127.0.0.1:3001`，但 `qianfu-api` 已按 `3000` 启动，或 PM2 / `.env` 与反代端口不一致。优先检查生产机上的 `qianfu-api` PM2 进程、Node 监听端口、nginx upstream、`.env` 数据库连接、MySQL 服务。

### P0：支付域名证书与站点绑定错误

复现：

```powershell
Invoke-WebRequest -Uri https://pay.star-web.top/ -TimeoutSec 20 -UseBasicParsing
Invoke-WebRequest -Uri https://pay.star-web.top/api/health -TimeoutSec 20 -UseBasicParsing
```

结果：

- Windows / schannel 客户端会直接报 TLS 主机名校验失败
- Node TLS 探测显示：
  - `subject CN = mc-u.top`
  - `subjectAltName = DNS:mc-u.top`
  - 对 `pay.star-web.top` 返回 `ERR_TLS_CERT_ALTNAME_INVALID`
- 忽略证书校验访问 `https://pay.star-web.top/` 时，返回的还是主站首页 HTML，且 `canonical` 指向 `https://mc-u.top/`

判断：支付域名当前不可作为可靠生产入口。优先检查 DNS 解析、443 站点绑定、证书路径、nginx server_name、Let’s Encrypt 证书状态，以及 `deploy/nginx/pay.star-web.top.conf.example` 对应的生产配置是否真正启用。仓库内模板和 `scripts/linux/setup-pay-domain.sh` 已改为反代 `127.0.0.1:3000`，避免继续沿用旧的 `3001` 端口说明。

更具体地说，当前外部证据更像是：

- `pay.star-web.top` 仍落到了 `mc-u.top` 的证书
- 或者 `pay.star-web.top` 的 443 vhost / `server_name` 没有正确命中，回落到了主站站点块

### P1：生产依赖 TinyMCE 高危 XSS 漏洞已在仓库内修复

复现：

```powershell
npm audit --omit=dev --audit-level=moderate
npm audit --omit=dev --json
npm ls tinymce --omit=dev
npm view tinymce version
```

修复前结果：

- `tinymce@8.5.0` 命中 1 个 high severity vulnerability
- 公告范围：`>=8.0.0 <8.5.1`
- 最新可用版本：`8.6.0`
- `npm audit fix` 可修复

当前状态：

- 已将锁文件收敛到 `tinymce@8.6.0`
- `npm audit --omit=dev` 返回 `found 0 vulnerabilities`
- `npm ls tinymce --omit=dev` 确认生产依赖为 `8.6.0`
- `npm run typecheck` 通过
- `npm --prefix qianfu-liandeng run build` 通过

### P2：Lint 警告仍较多

复现：

```powershell
npm run lint
```

结果：0 errors，46 warnings。

主要类别：

- 未使用 import/变量
- React Hook dependency 警告
- `@ts-ignore` 应替换为 `@ts-expect-error`

建议：不阻塞当前构建，但应作为发布前清理项，优先处理 Hook dependency 与 `@ts-ignore`。

### P2：生产健康检查脚本在当前 Windows 环境不可运行

复现：

```powershell
npm run prod:healthcheck
```

结果：WSL 无法执行 `/bin/bash`，报 `execvpe(/bin/bash) failed: No such file or directory`。

判断：这是当前检测机的 bash/WSL 环境问题，不代表生产脚本逻辑失败。脚本本身适合在 Linux 生产机运行，因为它会检查 HTTP、MySQL、PM2、内存和 swap。

### P2：前端标题与静态 SEO 元数据曾存在冲突，仓库内已修正待部署

复现：

```powershell
https://mc-u.top/login
https://mc-u.top/servers
https://mc-u.top/#/servers
```

结果：

- 已确认问题根因：`DynamicBranding` 会覆盖 `SeoHead` 写入的标题
- 已确认静态结构化数据曾残留 `https://mc-u.top/#/search`、`https://mc-u.top/#/servers`、`https://mc-u.top/#/resources`
- 本轮浏览器巡检里，直接访问 `https://mc-u.top/#/servers` 时没有稳定落到服务器列表页，因此不应继续对外输出 hash 路由

当前仓库状态：

- `DynamicBranding` 已不再写页面标题
- `SeoHead` 已补充 `/dashboard/*`、`/me/*`、`/tickets/*`、`/payment/*`、`/editor/*`、`/admin*` 等路由标题兜底
- `index.html` 的结构化数据已切回正式路径 `/search`、`/servers`、`/resources`
- 本地最新预览已验证：
  - `/login` 标题为 `登录 - 千服联灯`
  - `/servers` 标题为 `服务器列表 - 千服联灯`
  - 首页 `SearchAction.target` 已使用 `https://mc-u.top/search?...`

判断：这部分仓库修正已经完成，但线上主站当前仍主要受 API `502` 影响；SEO 与标题修正需要随下一次前端部署一起上线。

补充验证：

- `npm run probe:frontend-deploy` 已确认线上首页当前仍引用旧 bundle `/assets/index-D8ePUst4.js`
- 本地最新构建引用的是 `/assets/index-CHZmvcH-.js`
- 线上首页 HTML 里仍保留 `https://mc-u.top/#/search`、`https://mc-u.top/#/servers`、`https://mc-u.top/#/resources`

判断补充：线上现在不是“仓库修了但还不确定有没有部署”，而是已经可以明确证明主站前端静态资源仍停留在旧版本。

### P2：前端降级态文案曾不够诚实，仓库内已修正待部署

结果：

- API 不可用时，首页此前缺少足够醒目的降级说明
- 找服页在公开目录不可用时，部分状态位此前仍容易让人误读为“正常”
- 页脚此前固定显示 `服务状态正常`

当前仓库状态：

- 首页新增公开 API 降级提示条与状态徽标切换
- `/servers` 页面在 `isLoading` / `isError` 下会明确显示“检测中”或“降级”
- 页脚已接入全局 `/api/health` 探针，状态会在“公开 API 正常 / 检测中 / 降级”之间切换

判断：这类修正不解决线上 `502` 本身，但能避免前端在后端故障时继续向用户传达错误的“正常”信号。

## 已通过检查

```powershell
npm --prefix qianfu-liandeng run build
npm run typecheck
npm run typecheck:server
npm audit --omit=dev
npm ls tinymce --omit=dev
npm run guard:structure
npm run guard:api-contract
npm run guard:openapi-sync
npm run guard:style-tokens
npm run test:coverage:critical
```

结果：

- 前端生产构建通过
- 根 TypeScript 检查通过
- 服务端 TypeScript 检查通过
- 生产依赖审计通过，0 vulnerabilities
- `tinymce` 已解析到 `8.6.0`
- 结构守卫通过
- API 合约守卫通过
- OpenAPI 同步守卫通过
- Style token 守卫通过
- critical vitest 子集通过：4 files / 13 tests

注意：`test:preload` 当前因为目标测试文件不存在而跳过，不提供实际覆盖证明。

## 本轮新增仓库修正

- `server/index.ts`
  - 生产环境默认改为严格使用 `PORT`
  - 避免 `EADDRINUSE` 后自动顺延到 `3001/3002...`，导致固定指向 `3000` 的 Nginx upstream 变成 `502`
- `ecosystem.config.cjs`
  - PM2 默认补充 `PORT_STRICT=true`
- `.env.example`
  - 默认端口及相关回调 URL 从陈旧的 `3001` 改为 `3000`
- `scripts/simulate-hupijiao-notify.cjs`
  - 本地默认回调地址改到 `127.0.0.1:3000`
- `scripts/utils/domain-cert-probe.mjs`
  - 新增共享域名探测脚本
  - 可直接识别“支付域名证书实际是 `mc-u.top`”和“支付域名页面回落到了主站 HTML”
- `scripts/linux/diagnose-prod-502.sh`
  - 新增支付域证书/页面探测
  - 新增对 `server_name` 与证书路径是否匹配支付域名的自检
- `deploy/nginx/mc-u.top.conf.example`
- `deploy/nginx/pay.star-web.top.conf.example`
  - upstream 名称已拆分为站点级别，避免两个 conf 同时加载时触发 nginx `duplicate upstream`
- `qianfu-liandeng/src/components/DynamicBranding.tsx`
  - 不再覆盖 `SeoHead` 已经写入的页面标题，避免 `/login`、`/register` 等页面标题错误回退到“首页”
- `qianfu-liandeng/src/components/SeoHead.tsx`
  - 补充私有/嵌套路由标题兜底，统一由一处控制页面标题与 robots
- `qianfu-liandeng/index.html`
  - 移除静态结构化数据里的 `#/search`、`#/servers`、`#/resources` 历史 hash 路径
- `qianfu-liandeng/src/App.tsx`
  - 将根级 `/api/health` 探针状态下传到桌面页脚，避免页脚额外维护一套独立健康状态
- `qianfu-liandeng/src/components/Footer.tsx`
  - 页脚服务状态改为基于真实健康状态显示“公开 API 正常 / 检测中 / 降级”
- `qianfu-liandeng/src/store/uiStore.ts`
  - 补充页脚公开 API 状态的中英文文案
- `qianfu-liandeng/src/hooks/useBackendHealth.ts`
  - 新增共享后端健康探针，避免首页、找服页、页脚各自等待不同接口超时后才承认降级
- `qianfu-liandeng/src/pages/Home.tsx`
  - 首页优先复用共享健康探针，在 `/api/health` 已确认异常时立即展示降级提示
- `qianfu-liandeng/src/pages/ServerList.tsx`
  - 找服页优先复用共享健康探针，在公开接口整体异常时更快切到降级态
- `scripts/probe-frontend-deploy.ts`
  - 新增线上前端部署新鲜度探针，可直接比对远端 bundle、旧 hash 路由 SEO 标记和 `SearchAction.target`
- `scripts/smoke-deploy.ts`
  - 生产 smoke 现在默认也会检查主站前端是否仍停留在旧 bundle / 旧 hash 路由 SEO 标记
- `scripts/windows/diagnose-prod-502.ps1`
  - PowerShell 诊断脚本现在也会输出主站前端 freshness 信号，便于无 WSL 环境排查
- `scripts/linux/repair-prod-edge.sh`
  - 边缘修复完成后会顺手执行前端部署新鲜度探针，减少“API 已修但主站静态前端仍旧”的漏检
- `scripts/linux/setup-pay-domain.sh`
  - 新增部署后验收：校验支付域证书、页面、`server_name`、证书路径
- `deploy/nginx/pay.star-web.top.conf.example`
  - 根路径 `/` 现在返回纯文本标记 `qianfu-pay-gateway`
  - 方便快速区分“命中了支付站点”还是“错误回到了主站”

## 浏览器证据

使用 Codex in-app Browser 验证：

- `https://mc-u.top/`
  - URL 正确
  - 标题：`千服联灯 · 首页`
  - 页面非空
  - 无框架错误覆盖层
  - console 无相关 error/warn
  - 页脚当前仍显示旧文案 `服务状态正常`，说明这轮前端降级态修正尚未部署到现网
- `https://mc-u.top/servers`
  - 标题：`千服联灯 · 服务器`
  - 页面非空
  - 显示 0 个公开服务器
  - console 无相关 error/warn
- `https://mc-u.top/login`
  - 登录页可渲染
  - console 无相关 error/warn

本地最新预览验证：

- `http://127.0.0.1:4173/`
  - 标题：`千服联灯 - Minecraft 服务器发现与发布平台`
  - 可见降级提示条：`公开 API 状态`
  - 可见状态徽标：`平台状态 已降级`、`数据同步 同步异常`
- `http://127.0.0.1:4173/servers`
  - 标题：`服务器列表 - 千服联灯`
  - 可见降级文案：`公开索引异常`、`公开 API 未就绪`、`列表状态: 降级`
- `http://127.0.0.1:4173/login`
  - 标题：`登录 - 千服联灯`
  - `robots`：`noindex,nofollow`

截图：

- `tmp/qianfu-prod-audit-20260606/home.png`
- `tmp/qianfu-prod-audit-20260606/login.png`

## 建议修复顺序

1. 先修生产 API 502：登录服务器检查 PM2、端口、nginx upstream 和数据库连接。
2. 修支付域名 HTTPS：确认 `pay.star-web.top` 是否错误命中 `mc-u.top` 证书/站点块，核对 `server_name`、443 证书绑定、DNS 解析，并以仓库当前 `3000` 端口模板为准。
3. 在生产机核对 `mc-u.top` 与 `pay.star-web.top` 的 nginx upstream 是否仍写 `127.0.0.1:3001`，必要时改为 `127.0.0.1:3000` 后 reload。
4. 清理 lint warning，尤其是 Hook dependency 和 `@ts-ignore`。
5. 在 Linux/生产机运行 `scripts/linux/qianfu-prod-healthcheck.sh`，把 HTTP、MySQL、PM2、内存检查作为部署后门禁。

## 已补充的恢复材料

- 生产恢复 Runbook：
  - `docs/PROD-502-RECOVERY-RUNBOOK-2026-06-06.md`
- 当前状态面板：
  - `docs/PROGRESS-STATUS-2026-06-06.md`
- 生产 502 一键诊断脚本：
  - `scripts/linux/diagnose-prod-502.sh`
  - 当前会同时输出原始检测结果和保守的归因建议
- 已收敛到 `3000` 的文件：
  - `deploy/nginx/pay.star-web.top.conf.example`
  - `scripts/linux/setup-pay-domain.sh`
  - `docs/PAY-DOMAIN-RUNBOOK-2026-05-15.md`

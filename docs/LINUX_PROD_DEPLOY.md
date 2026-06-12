# Linux 生产部署说明

本文档面向正式 Linux 生产环境。当前仓库的生产主路径应以 `scripts/linux/deploy-bt-oneclick.sh + PM2 + Nginx + 公网烟测` 为准；`start-fullstack-auto.sh` 更适合单机迁移验证或临时联调，不应替代正式发布验收。

## 1. 推荐入口

- 正式部署：`bash scripts/linux/deploy-bt-oneclick.sh`
- 线上 502 诊断：`bash scripts/linux/diagnose-prod-502.sh`
- 跨平台公网诊断：`npm run prod:diagnose:public`
- 边缘修复后复核：`bash scripts/linux/repair-prod-edge.sh`
- 支付域上线：`bash scripts/linux/setup-pay-domain.sh`
- 迁移/单机联调补充：`docs/LINUX_AUTO_START_GUIDE.md`

## 2. `deploy-bt-oneclick.sh` 现在会做什么

默认流程：

1. `npm ci`
2. `npx prisma generate`
3. `npx prisma migrate deploy`
4. `npm run release:preflight`（或按参数跳过）
5. 用 `pm2` 启动/重启 `qianfu-api`
6. 本机健康检查：`http://127.0.0.1:${PORT}/api/health` 或 `/health`
7. 公网烟测：`npm run smoke:deploy`
8. 如果能推导出独立支付域，再跑支付域证书/站点探针

其中第 7 步已经默认并入：

- `health`
- `ready`
- `public-servers`
- 多个未登录只读接口
- 主站前端新鲜度检查

如果部署机能从这些位置推导出独立支付域：

- `PAY_DOMAIN_HOST`
- `XPAY_PUBLIC_URL`
- `XPAY_API_URL`
- `XPAY_NOTIFY_URL`

脚本还会顺手执行支付域探针，检查：

- TLS 证书是不是命中了支付域自己
- 支付域首页有没有错误回落到主站 HTML
- 支付域根路径是否仍返回 `qianfu-pay-gateway`

前端新鲜度检查会额外发现两类已在现网出现过的问题：

- 远端首页仍在引用旧 bundle
- 远端 HTML 仍残留 `#/search`、`#/servers`、`#/resources` 旧 hash 路由 SEO 标记

当你使用 `--strict-public-smoke` 时，脚本现在还会在失败前默认自动执行：

```bash
bash scripts/linux/collect-prod-502-evidence.sh diagnostics
```

也就是把当下主机的 PM2 / 监听端口 / Nginx / TLS / 公网探测 / 前端 freshness 结果一并打包，避免“严格拦截了发布，但现场没留住”。
如果 Playwright 浏览器依赖在部署机可用，证据包里还会顺手附带一份浏览器层的公网站点审计。

## 3. 关键环境变量

生产最少应明确这些值：

- `NODE_ENV=production`
- `PORT=3000`
- `PORT_STRICT=true`
- `FRONTEND_URL=https://mc-u.top`
- `API_PUBLIC_URL=https://mc-u.top/api`（同域时也建议显式写明）
- `DATABASE_URL=...`

与公网验收直接相关的开关：

- `RUN_PUBLIC_SMOKE=1`
  - 默认开启。部署结束后自动跑 `smoke:deploy`。
- `PUBLIC_SMOKE_BASE_URL=https://mc-u.top`
  - 优先使用它作为公网验收入口。
  - 如果未设置，脚本会尝试从 `.env` 的 `API_PUBLIC_URL` 或 `FRONTEND_URL` 推导。
- `PAY_DOMAIN_HOST=pay.star-web.top`
  - 可显式指定独立支付域，给部署脚本做证书 / 主站回落 / 根路径标记探测。
  - 如果未设置，脚本会尝试从 `XPAY_PUBLIC_URL`、`XPAY_API_URL`、`XPAY_NOTIFY_URL` 推导。
- `SMOKE_STRICT_READY=1`
  - 让 `smoke:deploy` 把 `/api/ready` 视为必须返回 `200`，而不是允许 `503`。
- `STRICT_PUBLIC_SMOKE=1`
  - 当公网烟测无法运行，或烟测存在失败项时，直接让部署脚本退出非零。
- `RUN_FAILURE_EVIDENCE=1`
  - 默认开启。
  - 当 `--strict-public-smoke` 因公网烟测或支付域探针失败而中断部署时，自动先采集一份诊断证据。
- `FAILURE_EVIDENCE_DIR=diagnostics`
  - 严格模式失败时，诊断包输出目录。
- `RUN_PAY_DOMAIN_PROBE=0`
  - 显式关闭支付域探针。

## 4. 推荐执行方式

### 4.1 首次部署但域名还没切好

```bash
bash scripts/linux/deploy-bt-oneclick.sh --skip-public-smoke
```

适合：

- 站点文件刚上传
- Nginx / 证书 / 域名解析尚未完成
- 先把本机服务、构建与迁移跑通

### 4.2 域名已经可访问，做标准发布

```bash
PUBLIC_SMOKE_BASE_URL=https://mc-u.top \
bash scripts/linux/deploy-bt-oneclick.sh
```

这会在部署尾声自动检查公网域名，而不只是本机端口。

### 4.3 把公网验收作为硬门禁

```bash
PUBLIC_SMOKE_BASE_URL=https://mc-u.top \
bash scripts/linux/deploy-bt-oneclick.sh --strict-public-smoke
```

适合：

- 已有稳定域名和证书
- 不希望出现“构建成功，但线上仍是 502 / 旧前端 / 支付域证书错绑”的假完成

如果还希望把 `/api/ready=200` 也作为硬条件：

```bash
PUBLIC_SMOKE_BASE_URL=https://mc-u.top \
SMOKE_STRICT_READY=1 \
bash scripts/linux/deploy-bt-oneclick.sh --strict-public-smoke
```

如果这次只是想拦截发布，不想在失败前自动打包现场，可显式关闭：

```bash
PUBLIC_SMOKE_BASE_URL=https://mc-u.top \
RUN_FAILURE_EVIDENCE=0 \
bash scripts/linux/deploy-bt-oneclick.sh --strict-public-smoke
```

## 5. `smoke:deploy` 失败时该怎么理解

常见失败项含义：

- `health`
  - API 入口不可达，或 Nginx 到 Node upstream 有问题。
- `ready`
  - 服务还没真正 ready；若开启严格模式则会直接拦截发布。
- `public-servers`
  - 公共目录接口异常，通常要查数据库、缓存或服务逻辑。
- `frontend-freshness`
  - 已部署首页还是旧 bundle，或者旧 hash 路由 SEO 标记没有被新的前端构建替换掉。

注意：`smoke:deploy` 目前主要覆盖主站，不替代支付域专项验收。支付域仍应单独执行：

```bash
npm run probe:pay-domain
```

或在生产机上直接执行：

```bash
bash scripts/linux/setup-pay-domain.sh
```

如果严格模式是因为以下情况失败：

- 公网烟测本身报错
- 严格模式下无法推导公网入口
- 支付域证书 / 主站回落 / 根标记探针失败
- 严格模式下支付域探针脚本缺失

部署脚本现在都会先自动调用证据采集脚本，再退出非零。

如果 `deploy-bt-oneclick.sh` 已经能从 `.env` 推导出支付域，它会自动把这条探针接进发布尾声；但手工复核仍然建议保留，尤其是在首次上线支付域时。

## 6. 生产机必须复核的配置点

### 6.1 PM2 / Node

```bash
pm2 status qianfu-api --no-color
pm2 describe qianfu-api
ss -lntp | grep -E ':3000|:3001|:443|:80'
curl http://127.0.0.1:3000/api/health
```

重点确认：

- `qianfu-api` 确实在运行
- API 实际监听的是 `3000`
- 没有继续漂移到旧的 `3001`

### 6.2 Nginx

重点确认：

- `mc-u.top` 的 `/api` upstream 指向 `127.0.0.1:3000`
- `pay.star-web.top` 的 `server_name` 和证书命中自己的站点块
- 变更后执行：

```bash
nginx -t && systemctl reload nginx
```

仓库模板位于：

- `deploy/nginx/mc-u.top.conf.example`
- `deploy/nginx/pay.star-web.top.conf.example`

## 7. 现网故障排查顺序

当公网出现 502、旧前端、或支付域回落到主站时，建议按这个顺序：

```bash
bash scripts/linux/diagnose-prod-502.sh --summary
QIANFU_BASE_URL=https://mc-u.top bash scripts/linux/qianfu-prod-healthcheck.sh
npm run probe:frontend-deploy
npm run probe:pay-domain
```

如果你当前不在生产机上，只是从另一台能联网的机器复核已部署站点，改用：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
npm run prod:diagnose:public
```

这个命令会把以下信息汇总成一份跨平台诊断结论：

- 主站 `/api/health`、`/api/ready`
- 主站前端 root 状态、bundle 是否与本地 `dist` 对齐
- 主站 HTML 是否仍残留旧 hash 路由 SEO 标记
- 支付域根路径、`/health`、`/api/health`
- 支付域证书命中情况
- 支付域是否错误回落到主站 HTML

如果你还想保留现有逐项 healthcheck 风格输出，再执行：

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

如果你想进一步检查“页面真正渲染给用户的内容”，而不只是接口状态，再执行：

```bash
QIANFU_BASE_URL=https://mc-u.top \
PAY_DOMAIN_HOST=pay.star-web.top \
npm run prod:audit:browser:public
```

这个浏览器审计会补充：

- 关键公共页面是否真实打开
- 页面标题是否仍错误停留在“首页”
- 页面加载时是否出现控制台错误
- 页面加载时是否直接命中 `502` 的接口响应
- 支付域在浏览器里是否直接触发证书错误，或忽略证书后仍渲染出主站页面

这个模式会跳过 MySQL / PM2 / 内存等宿主机检查，只保留：

- 主站 `/api/health`、`/api/ready`
- 主站前端首页 HTTP 状态、bundle 是否与本地 `qianfu-liandeng/dist` 对齐
- 主站前端 HTML 是否仍残留 `#/search`、`#/servers`、`#/resources` 旧 hash 路由 SEO 标记
- 主站 `SearchAction target` 是否仍错误指向 hash 路由
- 支付域根标记、`/health`、`/api/health`
- 支付域证书是否命中自己
- 支付域是否错误回落到主站 HTML

如果诊断显示：

- 本机 `3000` 健康
- 公网 `/api/health` 仍然 `502`

优先怀疑：

- Nginx upstream 仍指向旧端口
- PM2 环境变量未刷新
- 域名站点块没命中正确 `server_name`

## 8. 宝塔计划任务

可用下面的辅助脚本生成宝塔计划任务命令：

```bash
bash scripts/linux/setup-bt-cron.sh
```

如果希望计划任务里的自动部署也把公网烟测视为硬门禁：

```bash
bash scripts/linux/setup-bt-cron.sh --strict-public-smoke
```

前提是部署机 `.env` 中已经具备可推导的公网地址，或者你明确设置了 `PUBLIC_SMOKE_BASE_URL`。
如果还部署了独立支付域，最好同时设置 `PAY_DOMAIN_HOST` 或 `XPAY_PUBLIC_URL`。

## 9. 迁移/联调用途的补充入口

以下脚本仍然有用，但定位是“迁移验证 / 临时联调”而不是正式生产发布：

- `scripts/linux/start-fullstack-auto.sh`
- `scripts/linux/stop-fullstack-auto.sh`

相关说明：

- `docs/LINUX_AUTO_START_GUIDE.md`
- `docs/WINDOWS_AUTO_START_GUIDE.md`

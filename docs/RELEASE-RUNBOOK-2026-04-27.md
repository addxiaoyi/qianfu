# 千服发布摘要与上线检查单（2026-04-27）

## 1. 本次发布结论

- 发布门禁状态：通过
- 关键命令结果：
  - `npm run validate`：通过
  - `npm run release:preflight`：通过

本次可进入上线执行阶段。

## 2. 本次主要变更（面向上线）

### 2.1 数据层与迁移

- Prisma schema 已修复为可在 SQLite 下稳定工作（JSON 字段兼容为字符串存储）。
- 已补充并应用查询性能索引迁移（F10 查询稳健性相关）。
- `prisma generate`、`prisma migrate deploy` 路径已验证可用。

### 2.2 服务端稳定性

- 清理并修复 `typecheck:server` 全量错误，服务端 TS 检查已清零通过。
- 修复中间件注册类型不匹配、权限更新字段类型、认证缓存参数类型等高频阻塞问题。
- 修复本地 smoke 过程中 API 探测路径兼容性（兼容 `/api/*` 与 `/api/v1/*`）。

### 2.3 质量门禁与测试

- `validate` 全链路通过：
  - `typecheck`
  - `typecheck:server`
  - `lint`
  - `guard:structure`
  - `guard:api-contract`
  - `guard:openapi-sync`
  - `guard:style-tokens`
  - `test:preload`
  - `test:coverage:critical`
- `guard:style-tokens:strict` 已通过。
- Vitest 配置已去除测试阶段不必要的 React 插件注入，消除 Vite `esbuild/oxc` 弃用告警噪音。

### 2.4 风险留痕（不阻塞本次发布）

- 样式 token 历史存量违规已通过 allowlist 收敛，当前策略是“新增违规继续拦截、存量后续治理”。

## 3. 上线执行清单（建议按顺序）

### 3.1 上线前（Pre-check）

- [ ] 核对 `.env`（生产）关键变量：
  - `NODE_ENV=production`
  - `FRONTEND_URL`
  - `API_PUBLIC_URL`（分域场景）
  - `TRUST_PROXY=true`（反代场景）
  - `FORCE_HTTPS`（按证书终止位置决定）
  - `DATABASE_URL`
- [ ] 核对密钥完整性：
  - `JWT_SECRET`
  - `ADMIN_TOKEN`
  - `WALLET_SECRET`
  - `MODERATION_ENCRYPTION_KEY`
- [ ] 如使用个人收款二维码（PayPro），核对：
  - `PAYPRO_ENABLED=true`
  - `PAYPRO_API_URL`
  - `PAYPRO_OPENAPI_SECRET`
  - `PAYPRO_NOTIFY_URL`（公网可回调，建议 `/api/v1/payment/paypro/notify`）
- [ ] 如启用 SuperTokens API Key，确认 Core 与 Node 双端一致。

### 3.2 发布步骤（Deploy）

1. 安装依赖：
   - `npm ci`
2. 数据库迁移：
   - `npx prisma migrate deploy`
   - `npx prisma generate`
3. 构建前端：
   - `npm run build`
4. 启动/重启服务（按现网方式 pm2/systemd/docker）。
5. 反向代理 reload（如 Nginx）。

### 3.3 上线后冒烟（Smoke）

- [ ] 健康检查：
  - `GET /health`
  - `GET /api/health`
  - `GET /api/ready`
- [ ] 公共列表：
  - `GET /api/v1/public/servers?page=1&limit=5`
- [ ] 鉴权链路：
  - 登录、登出、会话保持
- [ ] 核心业务链路：
  - 用户资料更新
  - 关键写接口（验证 CSRF/权限）
  - 支付关键路径（若本次窗口覆盖）

#### 可自动化执行（新增）

- 生产/预发一键检查：
  - `SMOKE_API_BASE_URL=https://your-domain.example npm run smoke:deploy`
- 就绪探针严格模式（要求 `ready=200`）：
  - `SMOKE_API_BASE_URL=https://your-domain.example npm run smoke:deploy -- --strict-ready`
- 前端新鲜度已默认并入 `smoke:deploy`：
  - 会顺带检查远端首页 bundle 是否与本地 `qianfu-liandeng/dist/index.html` 一致
  - 也会检查远端 HTML 是否还残留 `#/search`、`#/servers`、`#/resources` 旧 hash 路由 SEO 标记
- 如只想临时跳过前端新鲜度检查：
  - `SMOKE_API_BASE_URL=https://your-domain.example npm run smoke:deploy -- --skip-frontend-freshness`
- 如生产还带独立支付域，额外执行：
  - `npm run probe:pay-domain`
  - 若部署脚本走 `scripts/linux/deploy-bt-oneclick.sh`，建议在 `.env` 中补 `PAY_DOMAIN_HOST=pay.star-web.top` 或至少写明 `XPAY_PUBLIC_URL`
  - 这样发布尾声也会自动检查支付域证书是否命中自己、是否误回落到主站 HTML，以及根路径是否仍返回 `qianfu-pay-gateway`
- 如需从非生产机环境复核已部署站点：
  - `QIANFU_BASE_URL=https://your-domain.example PAY_DOMAIN_HOST=pay.star-web.top bash scripts/linux/qianfu-prod-healthcheck.sh --public-only`
  - 或 `QIANFU_BASE_URL=https://your-domain.example PAY_DOMAIN_HOST=pay.star-web.top npm run prod:healthcheck:public`
  - 该检查现会同时覆盖主站 API、主站前端 freshness，以及支付域证书/回站状态
- 检查报告默认输出到 `logs/`，可用 `SMOKE_REPORT_PATH` 自定义路径。

## 4. 回滚预案（最小化）

### 4.1 应用回滚

1. 回滚到上一稳定版本应用包。
2. 重启服务并验证 `/health`、`/api/health`。

### 4.2 数据回滚

- 本次新增迁移以索引增强为主，回滚优先策略建议“先回滚应用，不立刻回滚数据”。
- 若必须回滚数据库，按 DBA 审批流程执行（避免在线误删索引影响查询计划）。

## 5. 发布后 30 分钟观察项

- [ ] API 5xx/4xx 异常峰值
- [ ] 登录失败率与会话异常
- [ ] 慢查询日志（Prisma SlowQuery）
- [ ] Redis 连接与缓存命中异常
- [ ] 支付/回调失败告警

## 6. 后续优化建议（发布后任务）

1. 分批清理 `style-token-guard.allowlist` 存量，逐步还原为严格风格门禁。
2. 将 smoke 流程接入 CI 产物归档（记录健康探测与关键接口响应样本）。
3. 增补一份“生产故障快速排查单页”并绑定告警项到值班流程。

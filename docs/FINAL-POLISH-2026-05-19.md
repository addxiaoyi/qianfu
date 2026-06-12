# 千服收口记录 2026-05-19

## 当前目标

- 清理主路径残留演示文案与假术语
- 保留真实功能，移除误导性入口
- 补齐自动化验收脚本，减少后续靠手工记忆验证
- 准备生产浏览器实测与再次部署

## 已完成

- 首页、移动首页、登录、注册、忘记密码、控制台、发服页、支付页、用户中心文案做了第一轮产品化替换
- 支付待支付页增加“重新生成订单”按钮
- 支付轮询在本地订单过期、格式无效、429 或连续失败时会清理 pending 状态，避免用户卡在旧订单
- 后台高曝光页面做了第一轮去演示术语：
  - 支付配置
  - 审计统计
  - 用户管理
  - 审计日志
  - 邮件配置
  - Footer
- 第三轮长尾文案继续清理：
  - 管理总览
  - 举报管理
  - 服务器审核
  - 推广领取审核详情
  - 推广任务列表 / 草稿区
  - 推广任务创建页
  - 商城详情 / 编辑 / 订单详情
  - 移动设置页
- 第四轮继续清理长尾可见英文：
  - 邮件配置页主要操作区
  - 推广任务确认弹窗
  - 推广动作标签
  - 店铺页认证标签
  - 推广草稿空态与按钮文案
- 第五轮终清：
  - 邮件配置剩余可见标签与按钮
  - 推广领取表格表头与空态
  - 推广任务详情页剩余英文状态与分页
  - 商城店铺页精选标签
- 生产数据库修复：
  - 发现 `https://mc-u.top/api/v1/auth/register` 返回 `500`
  - 根因确认：生产 SQLite 主库 `/www/wwwroot/qianfu-app/prisma/dev.db` 损坏，`PrismaClientUnknownRequestError` -> `SqliteError: database disk image is malformed`
  - 已在 `103.236.92.10` 上执行停服快照、逻辑重建、坏行隔离、原子替换、PM2 重启
  - 修复后生产库 `PRAGMA quick_check` 与 `PRAGMA integrity_check` 均返回 `ok`
- 线上前端已重新部署，当前入口为 `index-Cxg89i1r.js`
- 自动化验证已通过：
  - `npm run typecheck`
  - `npm run build`
  - `npm run server:build`
  - `npx tsx scripts/smoke-web-flows.ts`
  - `npx tsx scripts/smoke-auth-register-mail.ts`
  - `npm run scan:copy`
  - `node scripts/browser-auth-validation.cjs`
  - `npm run smoke:wallet-listing`
  - 生产修库后再次复跑：
    - `npx tsx scripts/smoke-auth-register-mail.ts`
    - `npm run smoke:wallet-listing`
    - `npx tsx scripts/smoke-web-flows.ts`
    - `npm run scan:copy`
    - `SMOKE_LOGIN_IDENTIFIER=dev_local SMOKE_LOGIN_PASSWORD=dev123456 node scripts/browser-auth-validation.cjs`

## 浏览器验证结果

- 桌面登录后可进入真实 `/editor`，并看到：
  - 宣传图封面
  - 发布套餐
  - 提交审核
- 移动端登录后同样可进入 `/editor` 真实发服页
- `/rules` 未再跳转 `/team`
- `/admin-qianfu` 页面内未发现 `Simulate Success`
- `/promotion/tasks` 页面内未发现 `CREATE_SAMPLE_TASK`
- 第三轮前端上线后，浏览器验收再次通过
- 第四轮前端上线后，浏览器验收再次通过
- 第五轮前端上线后，浏览器验收再次通过
- 生产数据库修复后再次验收通过：
  - 桌面 `/editor` 正常
  - 移动 `/editor` 正常
  - `/rules` 正常
  - `/admin-qianfu` 无 `Simulate Success`
  - `/promotion/tasks` 无 `CREATE_SAMPLE_TASK`

## 自动化闭环结果

- 注册 -> 邮件验证码发送 API -> 密码登录：通过
- 钱包充值 -> 管理员完成订单 -> 钱包到账：通过
- 发服扣余额 -> 审核通过 -> 公开列表可见 -> 删除后前后台清理：通过
- 第三轮上线后再次复跑钱包闭环：通过
- 第四轮上线后再次复跑钱包闭环：通过
- 第五轮上线后再次复跑钱包闭环：通过
- 生产数据库修复后再次复跑：
  - 注册 -> 邮件验证码发送 API -> 密码登录：通过
  - 钱包充值 -> 发服扣余额 -> 审核通过 -> 公共列表可见 -> 删除清理：通过

## 当前线上状态

- 站点：`https://mc-u.top`
- 健康检查：`/api/health` 返回 `healthy`
- 注册：恢复正常
- 登录：正常
- 邮件配置测试发送：正常
- 钱包充值：正常
- 发服扣费与审核：正常
- 主要前端页面未扫出高频假文案关键词

## 残余风险

- 当前生产仍使用 SQLite，虽然已修复并验证通过，但它仍不是长期高并发/高频写入下的理想生产库；后续应迁移到 PostgreSQL
- 本次修库过程中对 `ReviewHistory` 中不满足非空约束的坏记录做了隔离处理，主业务不受影响，但如果后续要做完整审计追溯，建议再单独导出检查修复前坏库快照

## 本轮新增能力

- 新增 `PATCH /api/v1/admin/users/:userId/email-verification`
  - 仅 `manage_users` 管理员可用
  - 用于自动化测试自举普通已验证用户

## 待继续

- 如需真正“长期稳定生产”，下一步应把生产数据库从 SQLite 迁移到 PostgreSQL
- 如需继续提升交付把握，可以再补一轮人工真邮箱收件箱验收与真实支付渠道验收

## 注意

- 当前仓库脏改动很多，继续编辑时只动目标文件，不回滚其他历史修改
- `@browser` 插件只作为备用；生产最终验收优先用真实 Playwright 会话
- `smoke:wallet-listing` 当前仍需要显式提供普通用户测试账号：
  - `SMOKE_LISTING_USER_EMAIL`
  - `SMOKE_LISTING_USER_PASSWORD`

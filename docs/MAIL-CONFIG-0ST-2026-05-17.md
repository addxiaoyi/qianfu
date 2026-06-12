# 2026-05-17 邮件登录与发信配置

## 本次完成

### 1. 超管侧栏新增邮件配置入口

- 路由：`/admin-mail`
- 已接入：
  - 超管个人中心左侧 `Super Admin / Config`
  - 管理后台侧栏
  - `AdminSettings` 配置总览页

### 2. 后端新增真实邮件配置接口

- `GET /api/v1/admin/mail-config`
- `PUT /api/v1/admin/mail-config`
- `POST /api/v1/admin/mail-config/test`
- `POST /api/v1/admin/mail-config/broadcast`
- `GET /api/v1/admin/mail-config/library`
- `POST /api/v1/admin/mail-config/import`
- `PUT /api/v1/admin/mail-config/templates/:key`
- `DELETE /api/v1/admin/mail-config/templates/:key`
- `PUT /api/v1/admin/mail-config/recipient-groups/:key`
- `DELETE /api/v1/admin/mail-config/recipient-groups/:key`
- `PUT /api/v1/admin/mail-config/schedules/:key`
- `DELETE /api/v1/admin/mail-config/schedules/:key`

配置写入 `SystemConfig`，不再只是依赖 `.env`。

### 3. 邮件发送运行时已改为动态配置

验证码、密码重置、工单通知等发信链路现在会优先读取数据库中的邮件配置。

### 4. 新增 TLS 放宽配置

新增字段：

- `smtpAllowInvalidCert`

用于 `mail.0st.top` 使用自签名或当前系统不信任证书时，允许应用层正常走 `STARTTLS / SSL`。

### 5. 已支持业务群发动作

超管邮件页现已支持：

- 产品推广邮件
- 系统维护通知
- 自定义批量通知
- 模板库
- 收件组
- 发送历史
- 定时发送任务
- JSON 导入 / 导出
- 收件组 CSV 导入
- 定时任务下次执行预览
- 顶部统计摘要

服务端会自动：

- 去重收件人
- 按批次 BCC 发送
- 限制单次最多 200 个收件人
- 保存模板与收件组
- 保存一次性 / 每日定时任务
- 记录最近发送历史

### 6. 已验证定时调度器可自动执行

本次已创建并验证：

- 一次性任务：`instant_probe`
- 每日任务：`night_maintenance`

调度结果：

- 调度器自动执行成功
- 历史记录中出现 `operator = scheduler:instant_probe`
- 一次性任务执行后自动写入 `lastRunAt`
- 一次性任务执行后自动禁用

### 7. 已修复超管邮件后台字段脱敏问题

此前 `sendSuccess()` 默认对所有响应做 `maskData()`，导致超管邮件后台里：

- 模板 `key`
- 收件组 `key`
- 收件人邮箱
- `smtpUser`
- `emailFrom`

等本应可编辑的字段也被错误脱敏。

现已修复：

- 邮件配置接口改为使用 `mask: false`
- 仅真正敏感字段保留受控脱敏：
  - `config.smtpPass` 固定返回空字符串
  - `maskedSecrets.smtpPass` 返回掩码
  - `effective.transport.pass` 返回 `***MASKED***`

## 线上验证

服务器：`103.236.92.10`

已确认：

- `25` 监听
- `587` 监听
- `465` 监听
- `993` 监听
- `995` 监听

认证验证：

- `doveadm auth test testuser Test1234` 成功

应用层探针：

- `mail.0st.top:587` + `STARTTLS` + `testuser@0st.top` 登录成功
- `mail.0st.top:465` + `SSL/TLS` + `testuser@0st.top` 登录成功

## 当前主站已生效配置

- `enabled = true`
- `smtpHost = mail.0st.top`
- `smtpPort = 587`
- `smtpSecure = false`
- `smtpAllowInvalidCert = true`
- `smtpUser = testuser@0st.top`
- `emailFrom = testuser@0st.top`
- `contactEmail = support@0st.top`
- `emailBaseUrl = http://mc-u.top`

## 最终验证结果

项目内测试接口：

- `POST /api/v1/admin/mail-config/test`
- `POST /api/v1/admin/mail-config/broadcast`
- `POST /api/v1/admin/mail-config/import`

已返回成功：

- `message = Test email sent`
- `message = Broadcast email sent`
- `message = Mail library imported`

Postfix 日志已出现：

- `sasl_method=PLAIN`
- `sasl_username=testuser`
- `status=sent`

说明当前千服项目已经可以通过 `mail.0st.top:587` 正常发送系统邮件。

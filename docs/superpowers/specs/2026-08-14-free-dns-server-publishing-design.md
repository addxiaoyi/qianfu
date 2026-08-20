# 免费服务器域名配置设计

## 目标

允许没有域名的服务器服主在发布服务器时申请平台免费域名。域名后缀由管理员配置并绑定阿里云 DNS 或 Cloudflare。申请只随服务器提交进入审核，服务器审核通过后才创建 DNS 记录。

## 产品边界

- 仅支持免费展示和免费 DNS 解析，不恢复支付、钱包、商城或推广能力。
- 用户只能使用管理员启用的域名后缀，并且只能填写安全的单标签前缀。
- 未审核、审核拒绝或服务器删除时，不创建新的 DNS 记录。
- 审核通过后由后台任务幂等执行 DNS 下发，失败状态可由管理员重试。
- 平台只删除自己创建且保存了 provider record id 的 DNS 记录，不触碰其他记录。

## 数据模型

`DnsDomainPool` 保存可用后缀、DNS provider、zone 标识、TTL、启用状态和前缀规则。

`ServerDomainBinding` 关联用户、服务器和域名池，保存完整域名、解析类型、目标、DNS 任务状态、provider record id、错误信息和时间戳。服务器审核状态仍是唯一的公开发布门槛。

状态：`PENDING_REVIEW`、`WAITING_PROVISION`、`PROVISIONING`、`ACTIVE`、`FAILED`、`REVOKED`。只有 `ACTIVE` 表示 DNS 已成功配置。

## DNS 适配器

统一接口支持 `aliyun` 和 `cloudflare`：创建、查询、删除记录均返回 provider record id。A/AAAA 目标使用 IP，域名目标使用 CNAME；非默认 Minecraft 端口额外创建 SRV。所有输入在平台侧先校验，禁止内网、环回、元数据地址和跨 zone 目标。

## 业务流

1. 管理员创建并启用域名后缀。
2. 用户发布服务器时选择后缀和前缀，后端锁定后缀配置并创建绑定。
3. 普通用户创建的服务器进入 `PENDING`，绑定保持 `PENDING_REVIEW`，不调用 provider。
4. 审核拒绝时绑定保持未配置状态。
5. 审核通过后，在同一业务动作中将绑定置为 `WAITING_PROVISION`，队列任务执行 DNS 下发。
6. 下发成功保存记录 id 并置为 `ACTIVE`；失败保存可读错误并置为 `FAILED`。
7. 管理员可以重试失败任务或撤销活动绑定。
8. 删除服务器时撤销并清理平台创建的记录，清理失败保留失败状态和审计信息。

## 安全与权限

- provider 凭据仅从环境变量读取，不进入数据库和管理员响应。
- 域名池管理、重试和撤销需要管理权限；用户只能查看自己的绑定。
- 创建和删除使用幂等键、唯一域名约束和 provider record id。
- 审核、下发、重试、撤销全部写入审计日志。

## 验收标准

- 审核前 provider mock 调用次数为 0。
- 拒绝审核 provider mock 调用次数为 0。
- 通过审核后只产生一次幂等创建调用，并保存 provider record id。
- provider 失败后状态为 `FAILED`，重试可以恢复为 `ACTIVE`。
- 阿里云与 Cloudflare 适配器都能处理 A/CNAME/SRV 记录。
- 用户、管理员和删除流程均有权限测试。

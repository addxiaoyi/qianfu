# 免费域名 DNS 自动配置设计

## 目标

用户发布服务器时可以申请平台管理的免费域名。服务器审核通过后，系统把 DNS 下发写入任务队列，由后台 worker 幂等执行；DNS 超时或服务商故障不阻塞审核，管理员可以查看状态、重试和撤销平台创建的解析记录。

## 约束与边界

- 每个免费域名后缀只绑定一个 DNS 服务商，例如 `example.com` 绑定 Cloudflare、`example.cn` 绑定阿里云 DNS。
- Cloudflare Token、Zone ID 和阿里云 AccessKey ID/Secret、Region ID 可由管理员后台录入；服务端使用现有 `SystemConfig` 的 secret 加密存储，明文不进入普通数据库字段、响应、日志或页面回显。
- 用户只能申请已启用后缀，前缀必须符合管理员配置的规则，并且不能命中保留词。
- 申请阶段只做格式、配额、重复占用、目标地址和后缀状态校验；不调用外部 DNS。
- 审核事务结束后才创建 DNS 任务。审核失败不创建任务；审核通过后任务创建失败必须让审核请求失败并回滚，避免出现“已通过但没有可追踪任务”的不可见状态。
- worker 只删除数据库中保存了 provider 记录 ID 且标记为平台创建的记录，不删除同名的外部记录。

## 数据模型

新增以下模型，并同步 SQLite、PostgreSQL、MySQL schema 与 migration：

- `FreeDomainSuffix`：后缀、服务商、启用状态、前缀正则、TTL、每用户配额、保留词 JSON、绑定配置标识。
- `ServerDomain`：服务器与完整域名的唯一绑定、申请状态、目标地址快照、端口、审核时间。
- `DnsRecord`：解析类型、名称、内容、TTL、provider 记录 ID、是否平台创建、下发状态、失败原因和时间。
- `DnsTask`：以 `server_domain_id + action` 做幂等键，记录待处理、处理中、成功、失败、重试次数和下次执行时间。

申请状态与下发状态分离。服务器可以是 `APPROVED`，同时 DNS 为 `PENDING` 或 `FAILED`，前端显示“审核通过，解析待配置”。

## 下发流程

1. 用户提交 `freeDomainEnabled`、后缀 ID 和前缀。
2. API 读取后缀配置，规范化域名并校验保留词、规则、重复占用、用户配额和目标地址。
3. API 在服务器创建事务中写入 `ServerDomain`，状态为 `PENDING_REVIEW`，不访问 DNS provider。
4. 审核通过事务内创建 `APPLY` 任务；worker 之后再调用 provider。
5. worker 根据目标地址选择记录：IPv4 为 A，IPv6 为 AAAA，域名为 CNAME；端口不是默认端口时追加 Minecraft SRV。
6. provider 返回记录 ID 后写入 `DnsRecord`，任务标记成功；失败保留审核结果，记录错误并按退避策略重试。
7. 管理员重试会复用同一个幂等任务；撤销会创建 `DELETE` 任务，只处理 `created_by_platform = true` 的记录。

## Provider 接口

```ts
interface DnsProvider {
  createRecord(input: DnsRecordInput): Promise<{ recordId: string }>;
  deleteRecord(input: { zone: string; recordId: string }): Promise<void>;
}
```

Cloudflare 和阿里云实现只接收服务端解密后的后缀绑定配置。管理员保存凭证时，输入值写入 `SystemConfig` 的 `is_secret=true` 配置项；列表接口只返回 provider 名称和“已配置/未配置”状态，不能读取或回显 Token、AccessKey 或 Secret。后台表单留空表示保持现有值。

## API 与后台

- 用户发布接口扩展免费域名字段，返回完整域名预览和申请/下发状态。
- 管理员新增后缀列表、创建/编辑/启停、任务列表、重试和撤销接口。
- 管理员状态接口返回 `provider`, `credentialConfigured` 和统计信息，不返回凭据值。
- 审核详情显示完整域名、后缀服务商、申请状态、DNS 下发状态和最近失败原因。

## 错误与可靠性

- Redis 可用时使用独立 DNS 队列；数据库任务状态是最终事实来源，worker 启动时扫描待处理和过期处理中任务恢复执行。
- provider 调用必须设置超时；错误消息截断后落库，不包含请求头、Token 或 Secret。
- 任务按固定上限重试，超过上限进入 `FAILED`，管理员可以重新置为 `PENDING`。
- provider 成功而数据库更新失败时，后续幂等执行先按 provider 记录 ID 查询/更新，禁止无条件创建重复记录。

## 验收测试

- 申请待审核时 provider 调用次数为 0。
- 审核拒绝时没有 DNS 任务；审核通过只创建一个幂等任务。
- A、AAAA、CNAME、Minecraft SRV 记录推导正确。
- provider 失败后任务进入可重试状态，重试不会重复创建记录。
- 删除只删除 `created_by_platform = true` 且有记录 ID 的记录。
- 管理员接口和页面不包含 Token、AccessKey、Secret 字段或值。
- 用户超配额、后缀停用、前缀非法、保留词和重复域名均 fail fast。

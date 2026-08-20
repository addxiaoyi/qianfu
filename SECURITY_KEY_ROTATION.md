# 千服平台密钥轮换计划

> 文档版本: 1.0
> 更新日期: 2026-07-06
> 状态: 安全修复

---

## 1. 背景与风险评估

### 1.1 发现的安全问题

在 `.env` 文件中发现以下暴露的敏感信息:

| 密钥名称 | 风险等级 | 暴露风险 | 影响范围 |
|---------|---------|---------|---------|
| JWT_SECRET | **严重** | 已硬编码在 .env | 所有用户认证会话 |
| ADMIN_TOKEN | **严重** | 已硬编码在 .env | 管理员 API 访问 |
| QIANFU_SECRET_KEY | **高危** | 已硬编码在 .env | 千服集成 API |
| PAYPRO_OPENAPI_SECRET | **高危** | 已硬编码在 .env | 支付回调验证 |
| WALLET_SECRET | **高危** | 已硬编码在 .env | 钱包余额操作 |
| XPAY 通知密钥 | **中危** | 已硬编码在 .env | 支付通知验证 |
| Supabase 密钥 | **高危** | 已硬编码在 .env | 数据库访问 |

### 1.2 潜在攻击场景

1. **凭证盗用**: 攻击者使用暴露的 ADMIN_TOKEN 获得管理员权限
2. **会话劫持**: JWT_SECRET 泄露可导致伪造有效用户会话
3. **支付欺诈**: 支付相关密钥泄露可导致伪造支付回调
4. **数据泄露**: Supabase 密钥泄露可导致未授权数据库访问

---

## 2. 新生成的安全密钥

### 2.1 立即使用的密钥 (生产环境)

```bash
# JWT_SECRET - 用于 JWT 令牌签名
JWT_SECRET=c90b2ab2e64b0e4371ca7b226f0c8ca7f43afac54cd1ecef1ae1b51fb4f33a0ff6029fc6d9efc4cdd936e7f38ce3e5473aefea326c04ef4f19fb190d3b626200

# ADMIN_TOKEN - 管理员 API 令牌
ADMIN_TOKEN=29cbbcefbc4c099b548b9cebd52dd60ea7facaeb6e2519baf20e8b8e34af68797fe656ee28302e177004ecd5c3118ec1d5afdde1e1ea28f0bd6389e2679f28c3

# QIANFU_SECRET_KEY - 千服集成密钥
QIANFU_SECRET_KEY=607bf14f197d98c6894ab95a787e06bdcc884ec695784afb237186f2e267fac8bc921a48000c0ce6ffb2067a5c2109131cedf23bd2806ba4c60902d4f798e097

# PAYPRO_OPENAPI_SECRET - PayPro API 密钥
PAYPRO_OPENAPI_SECRET=0c88947e902c72c20e114a709ab73e746e1c8fe608a2cb27929db440649ec3bd250e660a30439cbcf71d7ae9c129b413eb966c00cef10007fe91cae06b8b6c0b

# WALLET_SECRET - 钱包操作密钥
WALLET_SECRET=97fc31d9ce7e8af9d8fa879446a5831dac67e56fc8caab4d97203274166b6c16b605cc23aaae37481e1ab6c8a111e38be52d1e32cf2102702ee81d6963ce804f

# XPAY_GATEWAY_NOTIFY_SECRET - XPay 网关通知密钥
XPAY_GATEWAY_NOTIFY_SECRET=b47fd627b3ff0c6dfc5f858701181e85ee5322d253c3fdfb8ef064b45e252b72e7629760ff6ef630a394274387d0863d10c0cc340c175f0d4a9517df3571099e

# XPAY_BRIDGE_NOTIFY_SECRET - XPay 桥接通知密钥
XPAY_BRIDGE_NOTIFY_SECRET=da264a9155624b1403b8fd7d71e6bb6fce7da9798d8bc13ef2c673d40dc96caeba97fa8ddff6bb68446eedd7c63062bb326399598e664d19e988c35327489626

# PERSONAL_QR_LISTENER_SECRET - 个人二维码监听密钥
PERSONAL_QR_LISTENER_SECRET=115055d7c6286e63dba04ad5515577595e26c9a2b9a51b69cc906a6acd6421cd0f06e4932b7e8e1fc727403ebbf89f0ab8da483eccd6c77d74f115d7a8c2192f
```

> **安全警告**: 以上密钥仅用于说明目的，实际部署时请使用新生成的密钥

---

## 3. 密钥轮换步骤清单

### 阶段一: 准备工作 (执行前)

- [ ] 1.1 备份当前 `.env` 文件
  ```bash
  cp .env .env.backup.$(date +%Y%m%d)
  ```

- [ ] 1.2 确保数据库已备份
  ```bash
  # PostgreSQL
  pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql
  
  # 或 SQLite
  cp dev.db dev.db.backup.$(date +%Y%m%d)
  ```

- [ ] 1.3 创建密钥更新维护窗口通知用户

- [ ] 1.4 准备回滚计划

### 阶段二: 生成新密钥

- [ ] 2.1 生成 JWT_SECRET (64 字符)
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

- [ ] 2.2 生成 ADMIN_TOKEN (64 字符)
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

- [ ] 2.3 生成所有其他必要密钥 (重复 2.1 命令)

- [ ] 2.4 记录新密钥到安全的密码管理器 (如 1Password, Bitwarden)

### 阶段三: 部署新密钥

- [ ] 3.1 在所有环境更新 `.env` 文件

  **开发环境**:
  ```bash
  # 直接编辑 .env 文件
  nano .env
  # 或使用 sed
  sed -i 's/JWT_SECRET=.*/JWT_SECRET=<NEW_SECRET>/g' .env
  ```

  **生产环境** (推荐使用环境变量或密钥管理服务):
  ```bash
  # 如果使用容器
  docker secret create qianfu_jwt_secret <(echo "<NEW_SECRET>")
  
  # 如果使用 Kubernetes
  kubectl create secret generic qianfu-secrets \
    --from-literal=JWT_SECRET=<NEW_SECRET> \
    --from-literal=ADMIN_TOKEN=<NEW_SECRET>
  ```

- [ ] 3.2 重启所有应用实例
  ```bash
  # 如果使用 PM2
  pm2 restart all
  
  # 如果使用 Docker
  docker-compose restart
  
  # 如果使用 Kubernetes
  kubectl rollout restart deployment/qianfu-platform
  ```

- [ ] 3.3 验证服务正常运行
  ```bash
  curl -f http://localhost:3000/api/health
  ```

### 阶段四: JWT 密钥轮换 (可选 - 无停机)

- [ ] 4.1 支持双密钥验证 (可选，减少停机时间)
  - 在 JWT 验证逻辑中添加对旧密钥的支持
  - 使用新密钥签发所有新令牌
  - 旧令牌在过期前仍可使用

- [ ] 4.2 通知用户重新登录
  ```javascript
  // 可选: 强制所有用户重新登录
  // 在下次登录时清除旧会话
  ```

### 阶段五: 验证与清理

- [ ] 5.1 验证所有认证流程正常
  - [ ] 用户登录
  - [ ] 用户登出
  - [ ] Token 刷新
  - [ ] 管理员 API 访问

- [ ] 5.2 验证支付回调正常
  ```bash
  # 发送测试支付回调
  curl -X POST http://localhost:3000/api/v1/payment/xpay/notify \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```

- [ ] 5.3 确认旧密钥已从所有地方移除

- [ ] 5.4 更新文档和密码管理器

- [ ] 5.5 安全删除备份文件中的旧密钥
  ```bash
  # 安全删除备份
  shred -u .env.backup.*
  ```

---

## 4. 定期轮换计划

### 4.1 轮换周期建议

| 密钥类型 | 轮换周期 | 触发条件 |
|---------|---------|---------|
| JWT_SECRET | 90 天 | 定期轮换 |
| ADMIN_TOKEN | 90 天 | 定期轮换 |
| 支付密钥 | 180 天 | 定期轮换 |
| 数据库密钥 | 365 天 | 定期轮换 |
| 任何密钥 | **立即** | 发现泄露 |

### 4.2 自动轮换提醒

建议在密码管理器或日历中设置提醒:

```
- 每 90 天: 提醒轮换认证密钥
- 每 180 天: 提醒轮换支付密钥
- 每次安全事件后: 立即轮换所有密钥
```

---

## 5. 密钥管理最佳实践

### 5.1 密钥存储

1. **永远不要提交到 Git**
   ```gitignore
   # .gitignore
   .env
   .env.local
   .env.production
   ```

2. **使用密钥管理服务**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - 1Password / Bitwarden (开发环境)

3. **环境变量注入**
   - Docker Secrets
   - Kubernetes Secrets
   - CI/CD 环境变量

### 5.2 密钥强度要求

| 密钥类型 | 最小长度 | 算法 |
|---------|---------|------|
| 对称密钥 (AES) | 256 位 | 随机生成 |
| HMAC 密钥 | 256 位 | 随机生成 |
| JWT 密钥 | 256 位 | 随机生成 |
| API 密钥 | 256 位 | 随机生成 |

### 5.3 密钥使用原则

1. **最小权限**: 每个密钥只用于其预期目的
2. **密钥分离**: 不同环境使用不同密钥
3. **定期审计**: 定期检查密钥使用情况
4. **泄露响应**: 制定泄露响应计划

---

## 6. 紧急响应流程

如果发现密钥泄露:

1. **立即**: 停止使用泄露的密钥
2. **1 小时内**: 生成并部署新密钥
3. **24 小时内**:
   - 检查日志中的异常访问
   - 撤销可能受影响的会话
   - 通知受影响的用户
4. **7 天内**:
   - 完成安全审计
   - 更新安全文档
   - 评估是否需要进一步行动

---

## 7. 相关资源

- `.env.example` - 安全的环境变量模板
- 项目安全策略文档
- 密码管理器访问 (联系管理员)

---

*本文档由 Claude Code 安全审查生成 - 2026-07-06*

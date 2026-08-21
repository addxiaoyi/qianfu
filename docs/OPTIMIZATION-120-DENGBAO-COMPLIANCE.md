# 等保2.0 合规文档

**优化项 120: 等级保护 - 等保合规**

## 一、等保2.0概述

等保2.0 (GB/T 22239-2019) 是我国网络安全等级保护制度的最新标准，相比等保1.0新增了对云计算、大数据、物联网、移动互联等新技术的要求。

### 安全等级划分

| 等级 | 名称 | 适用系统 |
|------|------|----------|
| 第一级 | 一般保护 | 小型私营、中资企业等 |
| 第二级 | 指导保护 | 县级某些单位重要系统 |
| 第三级 | 监督保护 | 市级重要系统、金融、电力等 |
| 第四级 | 强制保护 | 省级、央企重要系统 |
| 第五级 | 专控保护 | 国家核心系统 |

---

## 二、技术架构映射

本项目按照等保2.0的技术要求进行设计：

### 2.1 安全通信网络 (第三级要求)

| 控制点 | 要求 | 实现方式 |
|--------|------|----------|
| L3-SCN-1 | 网络边界访问控制 | CORS中间件 + IP黑白名单 |
| L3-SCN-2 | 通信传输安全 | HTTPS强制 + HSTS头 |
| L3-SCN-3 | 入侵检测 | 限流中间件 + 暴力破解防护 |
| L3-SCN-4 | 集中管理 | 安全审计日志 |

**实现文件:**
- `server/middleware/security/security-center.ts` - HSTS配置、CORS控制
- `server/middleware/security/index.ts` - 安全中间件导出

### 2.2 安全区域边界 (第三级要求)

| 控制点 | 要求 | 实现方式 |
|--------|------|----------|
| L3-SAB-1 | 边界访问控制 | 访问控制中间件 |
| L3-SAB-2 | 入侵防范 | SQL注入防护、XSS防护 |
| L3-SAB-3 | 恶意代码防范 | 输入验证、内容安全策略 |
| L3-SAB-4 | 安全审计 | 集中审计日志 |

**实现文件:**
- `server/middleware/security/security-center.ts`
  - `sqlInjectionProtection()` - SQL注入检测
  - `xssProtection` - XSS防护
  - `inputValidation()` - 输入验证
  - `rateLimiter` - 请求限流

### 2.3 安全计算环境 (第三级要求)

| 控制点 | 要求 | 实现方式 |
|--------|------|----------|
| L3-SCE-1 | 身份鉴别 | 认证中间件 + 强密码策略 |
| L3-SCE-2 | 访问控制 | RBAC权限控制 |
| L3-SCE-3 | 安全审计 | 审计日志系统 |
| L3-SCE-4 | 入侵防范 | 暴力破解防护 |
| L3-SCE-5 | 数据安全 | 敏感数据加密、脱敏 |

**实现文件:**
- `server/middleware/security/security-center.ts`
  - `bruteForceProtection()` - 暴力破解防护
  - `maskSensitiveData()` - 数据脱敏
  - `encryptField()` / `decryptField()` - 字段加密
  - `securityAudit` - 审计日志

### 2.4 安全管理中心 (第三级要求)

| 控制点 | 要求 | 实现方式 |
|--------|------|----------|
| L3-SMC-1 | 系统管理 | 配置管理接口 |
| L3-SMC-2 | 审计管理 | 集中日志系统 |
| L3-SMC-3 | 安全管理 | 安全状态监控 |

---

## 三、控制项实现清单

### 3.1 网络和通信安全

#### L3-SCN-2: 通信传输安全

```typescript
// HSTS配置 (等保要求强制HTTPS)
const hstsConfig = {
  enabled: true,
  hstsMaxAge: 31536000,  // 1年
  hstsIncludeSubDomains: true,
  hstsPreload: true
};

// Content-Security-Policy
const cspConfig = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';";
```

#### L3-SCN-3: 入侵检测与防御

```typescript
// 请求限流 (防止DDoS和暴力破解)
const rateLimitConfig = {
  windowMs: 60000,        // 1分钟窗口
  maxRequests: 100,        // 普通请求限制
  maxRequestsAuth: 10     // 认证请求更严格限制
};
```

### 3.2 环境和边界安全

#### L3-SAB-2: 入侵防范

```typescript
// SQL注入防护
const sqlPatterns = [
  /\bUNION\b.*\bSELECT\b/i,
  /\bOR\b.*=.*\bOR\b/i,
  /(--|\'|\/\*)/,
  // ... 更多模式
];

// XSS防护
const xssPatterns = [
  /<script[^>]*>/i,
  /javascript:/i,
  /on\w+\s*=/i
];
```

### 3.3 主机和计算安全

#### L3-SCE-4: 暴力破解防范

```typescript
const bruteForceConfig = {
  maxAttempts: 5,           // 5次失败后锁定
  lockoutDuration: 900000,   // 锁定15分钟
  ipTracking: true
};
```

### 3.4 数据和安全

#### L3-SCE-5: 敏感数据保护

```typescript
// 数据分类
enum DataClassificationLevel {
  PUBLIC = 'public',           // 公开
  INTERNAL = 'internal',       // 内部
  CONFIDENTIAL = 'confidential', // 机密
  RESTRICTED = 'restricted'   // 绝密
}

// 脱敏规则
const maskRules = [
  { field: 'phone', type: 'partial', prefixLength: 3, suffixLength: 4 },
  { field: 'idCard', type: 'partial', prefixLength: 6, suffixLength: 4 },
  { field: 'password', type: 'full' }
];
```

---

## 四、审计日志规范

### 4.1 必须记录的审计事件

根据等保要求，以下事件必须记录：

| 事件类型 | 记录内容 | 保留时间 |
|----------|----------|----------|
| 登录/登出 | 用户、时间、IP、结果 | 6个月 |
| 敏感操作 | 用户、操作、时间、结果 | 6个月 |
| 权限变更 | 变更人、被变更人、变更内容 | 6个月 |
| 数据访问 | 访问者、数据、时间 | 6个月 |
| 安全告警 | 告警类型、触发条件、处置 | 6个月 |

### 4.2 审计日志格式

```typescript
interface AuditLog {
  eventId: string;           // 事件唯一标识
  eventType: string;        // 事件类型
  timestamp: string;        // ISO8601时间
  userId?: string;          // 用户ID
  userName?: string;        // 用户名
  ip: string;               // 客户端IP
  userAgent?: string;       // 浏览器标识
  resource?: string;        // 资源类型
  resourceId?: string;      // 资源ID
  action: string;           // 操作描述
  result: 'success'|'failure'|'warning';  // 操作结果
  details?: object;          // 额外详情
}
```

---

## 五、配置参考

### 5.1 生产环境安全配置

```typescript
const productionSecurityConfig: SecurityConfig = {
  https: {
    enabled: true,
    hsts: true,
    hstsMaxAge: 31536000,
    hstsIncludeSubDomains: true,
    hstsPreload: true
  },
  cors: {
    enabled: true,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true
  },
  csrf: {
    enabled: true,
    tokenExpiry: 86400000  // 24小时
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    maxRequestsAuth: 5
  },
  bruteForce: {
    enabled: true,
    maxAttempts: 3,
    lockoutDuration: 1800000  // 30分钟
  }
};
```

### 5.2 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `ALLOWED_ORIGINS` | 允许的跨域源 | `https://example.com` |
| `DATA_ENCRYPTION_KEY` | 数据加密密钥 | 32位十六进制字符串 |
| `SESSION_SECRET` | 会话密钥 | 随机字符串 |
| `LOG_LEVEL` | 日志级别 | `info`, `warn`, `error` |

---

## 六、合规检查清单

### 日常检查项

- [ ] 安全日志是否正常写入
- [ ] 限流配置是否生效
- [ ] 暴力破解告警是否正常
- [ ] 敏感数据是否正确脱敏
- [ ] HTTPS是否强制启用
- [ ] HSTS头是否正确设置

### 定期检查项 (季度)

- [ ] 安全中间件版本更新
- [ ] 加密密钥轮换
- [ ] 审计日志归档检查
- [ ] IP黑白名单更新
- [ ] 渗透测试
- [ ] 合规自评估

### 年度检查项

- [ ] 等保测评
- [ ] 安全培训
- [ ] 应急预案演练
- [ ] 供应商安全评估

---

## 七、相关文档

- `OPTIMIZATION-119-SOC2-COMPLIANCE.md` - SOC2合规文档
- `server/middleware/security/security-center.ts` - 安全中间件实现
- `server/middleware/security/soc2-compliance.ts` - SOC2合规模块

---

## 八、更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-07-06 | 1.0 | 初始版本，实现等保2.0第三级基本要求 |

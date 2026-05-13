# Auth 模块安全审计报告

**审计日期**: 2026-05-11
**审计范围**: `server/controllers/authController.ts`, `server/controllers/authCodeController.ts`, `server/controllers/registerController.ts`, `server/routes/auth.ts`, `server/middleware/auth.ts`, `server/services/devAuth.ts`

---

## 一、P0 致命问题

### 1.1 Dev Auth 默认凭据可预测

**文件**: `server/services/devAuth.ts`
**行号**: L55-L56

```typescript
const DEFAULT_DEV_USERNAME = 'devadmin';
const DEFAULT_DEV_PASSWORD = 'devpass123';
```

**问题**: 默认开发凭据是硬编码的弱密码。如果 `.env` 未覆盖，任何知道默认值的人可以直接登录并获得完整管理员权限。

**影响**: 完整管理员权限绕过，包括 `hasPermission(['manage_users'])` 等路由。

**修复建议**:
- 强制要求在 `.env` 中配置 `DEV_AUTH_USERNAME` 和 `DEV_AUTH_PASSWORD`
- 启动时校验，若使用默认值则拒绝启动并报错

---

### 1.2 Dev Auth 用户创建字段类型错误

**文件**: `server/services/devAuth.ts`
**行号**: L108

```typescript
user = await prisma.user.create({
    data: {
        email: devEmail,
        role: 'ADMIN',
        email_verified: true,
        last_login_at: new Date(),
        last_login_at: '127.0.0.1',  // ← 重复字段，且类型错误！
    },
});
```

**问题**: `last_login_at` 被赋值两次，第二次赋值字符串 `'127.0.0.1'` 给 Date 类型字段。这会在运行时产生 Prisma 错误或在某些配置下静默失败。

**修复建议**: 删除重复行，保留 `last_login_at: new Date()`。

---

### 1.3 注册流程中新用户跳过验证码

**文件**: `server/controllers/registerController.ts`
**行号**: L140-158

```typescript
if (!user) {
    // 新用户注册：直接创建用户
    // ...
    // 不验证 code，直接创建新用户！
}
```

**问题**: 当用户不存在时（即完全新注册），代码直接创建用户而不验证 `code` 字段。这意味着任何人可以通过发送任意 `code` 值来注册用户，无需经过短信/邮箱验证码流程。

**影响**: 验证码机制被完全绕过，攻击者可以批量注册账号。

**修复建议**: 新用户注册也应该验证 `code` 或重新设计流程确保验证码是注册的前提条件。

---

## 二、P1 高危问题

### 2.1 验证码密钥默认值弱

**文件**: `server/controllers/authCodeController.ts` L60
**文件**: `server/controllers/registerController.ts` L43

```typescript
const secret = process.env.JWT_SECRET || 'change-me';
```

**问题**: HMAC 验证码签名使用 `JWT_SECRET` 作为密钥，默认值为 `'change-me'`。如果生产环境未正确配置，攻击者可以伪造验证码。

**修复建议**: 启动时校验 `JWT_SECRET` 不为默认值，否则拒绝启动。

---

### 2.2 登录锁存使用 Prisma 存储导致竞态

**文件**: `server/controllers/authCodeController.ts` L178-L193

**问题**: 登录计数 (`login_count`) 和锁存时间 (`login_lockout_at`) 存储在 Prisma 数据库而非 Redis。在高并发暴力破解场景下，可能出现竞态条件导致锁存被绕过。

**修复建议**: 使用 Redis 原子操作存储登录计数和锁存时间。

---

### 2.3 Dev Auth Cookie 缺少 secure 标记

**文件**: `server/services/devAuth.ts` L72-L75

**问题**: `createDevAuthToken` 生成了 JWT token 但 token 的传递机制未在 devAuth.ts 中体现。在 `authController.ts` 的 `devLogin` 中 cookie 设置了 `secure` 条件，但如果 Dev Auth 有其他传递路径（如 URL 参数），则可能在 HTTP 上传输。

**修复建议**: 确认 token 仅通过 HTTP-only cookie 传递，并在生产环境禁用 Dev Auth。

---

### 2.4 Change Password 不校验新密码强度

**文件**: `server/controllers/authController.ts` L165-L168

```typescript
const validation = changePasswordSchema.safeParse(req.body);
```

**问题**: 密码修改仅通过 schema 验证，如果 schema 未强制新密码与旧密码不同、未强制复杂度要求，则攻击者可以设置极弱密码。

**修复建议**: 
- 在 `changePasswordSchema` 中添加复杂度验证
- 添加逻辑检查新密码是否与旧密码相同

---

## 三、P2 中等问题

### 3.1 验证码生成安全性

**文件**: `server/controllers/authCodeController.ts` L55

```typescript
function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
```

**问题**: 使用 `Math.random()` 生成验证码。`Math.random()` 不是加密安全的随机数生成器，理论上可以被预测。

**修复建议**: 使用 `crypto.randomInt(100000, 999999)` 替代。

---

### 3.2 权限检查使用 JSON 字段解析

**文件**: `server/middleware/auth.ts` L98-L103

```typescript
const permissions = parseJsonArray(devUser.permissions);
req.isAdmin = devUser.role === 'ADMIN' || devUser.role === 'OWNER' || permissions.includes('admin');
```

**问题**: `parseJsonArray` 从 JSON 字符串解析权限，存在注入风险。如果 `permissions` 字段被恶意修改，可能导致意外权限提升。

**修复建议**: 使用严格白名单校验解析后的权限值。

---

### 3.3 注册接口无验证码验证（已存在用户场景）

**文件**: `server/controllers/registerController.ts` L176-L185

**问题**: 已存在用户的注册场景（即用户已有账号但需要设置密码/用户名）依赖验证码验证，但验证逻辑中 `generateCodeHash` 使用的是 `require('crypto')` 动态导入而非顶部导入。

**修复建议**: 改为顶部静态导入 `import crypto from 'crypto'`。

---

### 3.4 会话列表可枚举

**文件**: `server/controllers/authController.ts` L241-L262

```typescript
export const getSessions = async (req, res, next) => {
    // 返回所有会话的 handle、创建时间、过期时间
    // 任何人都可以枚举自己的所有会话
};
```

**问题**: 用户可以查看所有会话详情（包括 handle），虽然不泄露完整 token，但为会话枚举攻击提供信息。

**修复建议**: 对会话 ID 进行哈希处理后再返回。

---

## 四、安全最佳实践检查

| 检查项 | 状态 | 备注 |
|--------|------|------|
| CSRF 保护 | ✓ | 所有认证路由都有 `csrfProtection` |
| Rate Limiting | ✓ | `authLimiter`、`authBruteForceLimiter` 已应用 |
| HTTP-only Cookies | ✓ | Session cookie 标记为 httpOnly |
| Secure Cookies (prod) | ✓ | 生产环境启用 secure 标记 |
| SameSite Cookie | ✓ | 生产环境设为 strict |
| 密码哈希 | ✓ | bcrypt cost=12 |
| 会话撤销 | ✓ | 密码修改后撤销其他会话 |
| 审计日志 | ✓ | 关键操作记录 `logAction` |
| 验证码 TTL | ✓ | 10 分钟过期 |
| 输入验证 | ✓ | Zod schema 校验 |
| CSP 头部 | ? | 需检查中间件配置 |
| HSTS | ? | 需检查中间件配置 |
| 敏感日志脱敏 | ? | 验证码不应出现在日志中 |

---

## 五、修复优先级

| 优先级 | 问题 | 估计修复时间 |
|--------|------|-------------|
| P0-1 | Dev Auth 默认凭据 | 30 分钟 |
| P0-2 | Dev Auth 字段类型错误 | 5 分钟 |
| P0-3 | 注册跳过验证码 | 1 小时 |
| P1-1 | 验证码密钥弱 | 30 分钟 |
| P1-2 | 登录锁存竞态 | 2 小时 |
| P1-3 | Password 强度检查 | 1 小时 |
| P2-1 | Math.random 替代 | 30 分钟 |
| P2-2 | JSON 权限注入 | 1 小时 |
| P2-3 | 动态 crypto 导入 | 5 分钟 |
| P2-4 | 会话枚举 | 30 分钟 |

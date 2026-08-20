# Auth 模块安全审计报告

**审计日期**: 2026-05-11
**最近复核**: 2026-07-31
**审计范围**: `server/controllers/authController.ts`, `server/controllers/authCodeController.ts`, `server/controllers/registerController.ts`, `server/routes/auth.ts`, `server/middleware/auth.ts`, `server/services/devAuth.ts`

## 复核状态（2026-07-31）

| 编号 | 状态 | 当前实现与证据 |
|------|------|----------------|
| P0-1 Dev Auth 默认凭据 | 已修复 | 启用开发绕过时强制配置显式用户名和至少 12 位强密码；缺失或弱凭据 fail-closed |
| P0-2 Dev Auth 字段类型错误 | 已修复 | 用户创建不再重复写入 `last_login_at` |
| P0-3 注册跳过验证码 | 已修复 | 新用户与已有用户注册路径均要求验证码验证 |
| P1-1 验证码密钥弱 | 已修复 | 统一通过安全配置读取 JWT 密钥，不保留 `change-me` 回退 |
| P1-2 登录锁存竞态 | 已修复 | 验证失败次数迁移到 Redis 原子 `INCR` + 15 分钟 TTL；成功后删除计数键 |
| P1-4 修改密码强度 | 已修复 | 新密码执行 12 位复杂度策略，并拒绝与当前密码相同 |
| P2-1 验证码随机数 | 已修复 | 邮箱、手机和注册验证码统一使用 `crypto.randomInt` |
| P2-3 动态 crypto 导入 | 已修复 | 控制器统一使用顶部静态导入 |
| P2-2 JSON 权限白名单 | 已修复 | 新增统一已知权限目录；已知角色使用角色配置中的基础权限，补充权限执行白名单过滤，高权限权限必须匹配明确角色 |
| P2-4 会话标识枚举 | 已修复 | 会话列表仅返回用户绑定的 HMAC 不透明引用；撤销接口拒绝原始 handle，并且响应和审计日志均不再记录原始 handle |

本轮回归证据：

- 权限与 Auth 定向测试：6 个文件、21 个测试通过
- 会话与 Auth 定向测试：4 个文件、28 个测试通过
- 全量 Vitest：136 个文件、651 个测试通过
- 原始用户权限 JSON 授权旁路静态扫描：通过
- 原始 SuperTokens session handle 响应与审计泄露静态扫描：通过
- `npm run typecheck`：通过
- `npm run typecheck:server`：通过
- `npm run build`：通过

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

**复核结果（2026-07-31）**: 已实现 `session-reference:v1` HMAC 不透明引用，输入按上下文、用户 ID 和 session handle 分段编码。列表接口只返回 `sess_` 引用；撤销接口只接受严格格式的引用并在当前用户会话集合内以常量时间比较解析。原始 handle 不再出现在 API 响应或撤销审计记录中。

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

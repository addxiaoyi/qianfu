# 优化项 52: Register表单zod验证

## 概述

为注册页面实现完整的 Zod 表单验证，使用 React Hook Form 的 `zodResolver` 进行类型安全的表单验证。

## 实现内容

### 1. Zod Schema 验证

使用 `@/forms/schemas` 中预定义的 `registerSchema`：

```typescript
import { registerSchema, type RegisterFormData } from '@/forms/schemas'

export const registerSchema = z.object({
  email: emailSchema,           // z.string().email('请输入有效的邮箱地址')
  password: strongPasswordSchema, // 强密码验证
  confirmPassword: z.string(),   // 确认密码
  username: usernameSchema,      // 用户名验证
  agreeTerms: z.boolean().refine(val => val === true, {
    message: '请同意服务条款',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: '两次密码输入不一致',
  path: ['confirmPassword'],
})
```

### 2. 表单配置

```typescript
const {
  register,
  handleSubmit,
  watch,
  formState: { errors, isValid },
} = useForm<RegisterFormData>({
  resolver: zodResolver(registerSchema),
  mode: 'onBlur',  // 失去焦点时验证
  defaultValues: {
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  },
})
```

### 3. 验证规则

| 字段 | 验证规则 | 错误消息 |
|------|----------|----------|
| email | 必填，有效邮箱格式 | "请输入有效的邮箱地址" |
| username | 必填，3-20字符，字母数字下划线 | "用户名至少3个字符" 等 |
| password | 必填，强密码规则 | 至少8位、含大小写数字特殊字符 |
| confirmPassword | 必填，与密码一致 | "两次密码输入不一致" |
| agreeTerms | 必填，需同意 | "请同意服务条款" |

### 4. 密码强度指示器

```typescript
const checks = [
  { regex: /.{8,}/, label: '至少8个字符' },
  { regex: /[A-Z]/, label: '大写字母' },
  { regex: /[a-z]/, label: '小写字母' },
  { regex: /[0-9]/, label: '数字' },
  { regex: /[^A-Za-z0-9]/, label: '特殊字符' },
]
```

### 5. UI/UX 特性

- **实时错误提示**: 失焦时显示验证错误
- **密码可见性切换**: Eye/EyeOff 图标
- **密码强度指示器**: 实时显示密码强度等级和检查项
- **加载状态**: 提交时禁用按钮并显示加载动画
- **成功状态**: 注册成功后显示确认页面
- **响应式设计**: 移动端友好的表单布局

### 6. 组件结构

```
Register.tsx
├── Input             # 基础输入框组件
├── InputWithIcon     # 带图标的输入框
├── FormField         # 表单字段包装器
├── PasswordStrengthIndicator  # 密码强度指示器
└── Register          # 主组件
```

## 文件结构

```
src/pages/Register.tsx    # 注册页面组件
src/forms/schemas.ts     # 预定义的 Zod schemas
```

## 依赖

- `react-hook-form` - 表单状态管理
- `@hookform/resolvers` - Zod 解析器
- `zod` - 模式验证
- `lucide-react` - 图标 (Eye, EyeOff, Mail, Lock, User, ShieldCheck, Loader2)
- `@/lib/tailwind-merge` - Tailwind 类名合并

## 使用示例

```tsx
import Register from '@/pages/Register'

// 在路由中使用
<Route path="/register" element={<Register />} />

// 带成功回调
<Register onSuccess={() => navigate('/login')} />
```

## 验证流程

1. 用户输入邮箱、用户名、密码
2. 密码输入时实时显示强度指示器
3. 失焦时触发单个字段验证
4. 点击提交时触发完整验证（包括密码一致性）
5. 验证失败显示错误消息，阻止提交
6. 验证通过显示成功状态

## 与 Login 页面的区别

| 特性 | Login | Register |
|------|-------|----------|
| 字段数量 | 2-3 | 5 |
| 密码强度验证 | 基础 | 完整强度指示器 |
| 密码确认 | 无 | 有 |
| 条款同意 | 无 | 有 |
| 成功页面 | 无 | 有 |

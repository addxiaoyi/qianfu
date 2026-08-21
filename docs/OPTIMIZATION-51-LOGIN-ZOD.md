# 优化项 51: Login表单zod验证

## 概述

为登录页面实现完整的 Zod 表单验证，使用 React Hook Form 的 `zodResolver` 进行类型安全的表单验证。

## 实现内容

### 1. Zod Schema 验证

使用 `@/forms/schemas` 中预定义的 `loginSchema`：

```typescript
import { loginSchema, type LoginFormData } from '@/forms/schemas'

export const loginSchema = z.object({
  email: emailSchema,                    // z.string().email('请输入有效的邮箱地址')
  password: passwordSchema,              // z.string().min(8, '密码至少8个字符').max(128, ...)
  remember: z.boolean().optional(),
})
```

### 2. 表单配置

```typescript
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema),
  defaultValues: {
    email: '',
    password: '',
    remember: false,
  },
  mode: 'onBlur',  // 失去焦点时验证
})
```

### 3. 验证规则

| 字段 | 验证规则 | 错误消息 |
|------|----------|----------|
| email | 必填，有效邮箱格式 | "请输入有效的邮箱地址" |
| password | 必填，8-128字符 | "密码至少8个字符" / "密码最多128个字符" |
| remember | 可选布尔值 | - |

### 4. UI/UX 特性

- **实时错误提示**: 失焦时显示验证错误
- **密码可见性切换**: Eye/EyeOff 图标
- **加载状态**: 提交时禁用按钮并显示加载动画
- **动画效果**: Framer Motion 入场动画
- **响应式设计**: 移动端友好的表单布局

### 5. 错误样式

```typescript
className={`
  ...
  ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
`}
```

## 文件结构

```
src/pages/Login.tsx    # 登录页面组件
src/forms/schemas.ts   # 预定义的 Zod schemas
```

## 依赖

- `react-hook-form` - 表单状态管理
- `@hookform/resolvers` - Zod 解析器
- `zod` - 模式验证
- `framer-motion` - 动画
- `lucide-react` - 图标

## 使用示例

```tsx
import LoginPage from '@/pages/Login'

// 在路由中使用
<Route path="/login" element={<LoginPage />} />
```

## 验证流程

1. 用户输入邮箱和密码
2. 失焦时触发 `onBlur` 验证
3. 点击提交时触发完整验证
4. 验证失败显示错误消息，阻止提交
5. 验证通过调用 `login()` 方法

## 相关的注册页面

参考 `src/pages/Register.tsx` (优化项 52) 获取更复杂的表单验证示例，包括：
- 密码强度指示器
- 确认密码验证
- 服务条款同意复选框

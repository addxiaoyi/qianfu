/**
 * 性能表单验证 schemas
 * 优化项 16: React Hook Form - 性能表单
 *
 * 提供常用的表单验证 schemas，用于快速创建表单
 */
import { z } from 'zod'

// ============================================================
// 基础验证 schemas
// ============================================================

/** 邮箱验证 */
export const emailSchema = z.string().email('请输入有效的邮箱地址')

/** 密码验证 (最少8位) */
export const passwordSchema = z
  .string()
  .min(8, '密码至少8个字符')
  .max(128, '密码最多128个字符')

/** 强密码验证 */
export const strongPasswordSchema = z
  .string()
  .min(6, '密码至少6个字符')
  .max(128, '密码最多128个字符')
  .regex(/[A-Z]/, '密码必须包含大写字母')
  .regex(/[a-z]/, '密码必须包含小写字母')
  .regex(/[0-9]/, '密码必须包含数字')
  .regex(/[^A-Za-z0-9]/, '密码必须包含特殊字符')

/** URL 验证 */
export const urlSchema = z.string().url('请输入有效的URL')

/** 手机号验证 (中国) */
export const phoneSchema = z
  .string()
  .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号')

/** 验证码验证 */
export const otpSchema = z
  .string()
  .length(6, '验证码必须是6位')
  .regex(/^\d+$/, '验证码必须是数字')

/** 用户名验证 */
export const usernameSchema = z
  .string()
  .min(3, '用户名至少3个字符')
  .max(20, '用户名最多20个字符')
  .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线')

// ============================================================
// 业务验证 schemas
// ============================================================

/** 登录表单 */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  remember: z.boolean().optional(),
})
export type LoginFormData = z.infer<typeof loginSchema>

/** 注册表单 */
export const registerSchema = z
  .object({
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string(),
    username: usernameSchema,
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: '请同意服务条款',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次密码输入不一致',
    path: ['confirmPassword'],
  })
export type RegisterFormData = z.infer<typeof registerSchema>

/** 邮箱验证 */
export const emailVerifySchema = z.object({
  email: emailSchema,
  code: otpSchema,
})
export type EmailVerifyFormData = z.infer<typeof emailVerifySchema>

/** 找回密码表单 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
})
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

/** 重置密码表单 */
export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次密码输入不一致',
    path: ['confirmPassword'],
  })
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

/** 修改密码表单 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次密码输入不一致',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.password, {
    message: '新密码不能与当前密码相同',
    path: ['password'],
  })
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

/** 个人资料表单 */
export const profileSchema = z.object({
  username: usernameSchema,
  displayName: z.string().min(1, '请输入显示名称').max(50, '显示名称最多50个字符'),
  bio: z.string().max(200, '简介最多200个字符').optional(),
  website: urlSchema.optional().or(z.literal('')),
  location: z.string().max(100, '位置最多100个字符').optional(),
})
export type ProfileFormData = z.infer<typeof profileSchema>

/** 服务器表单 */
export const serverSchema = z.object({
  name: z
    .string()
    .min(3, '服务器名称至少3个字符')
    .max(50, '服务器名称最多50个字符'),
  description: z.string().max(500, '描述最多500个字符').optional(),
  ip: z.string().regex(/^[\d.]+$|^\[[\w:]+]$/, '请输入有效的IP地址'),
  port: z.coerce.number().min(1, '端口至少1').max(65535, '端口最大65535'),
})
export type ServerFormData = z.infer<typeof serverSchema>

/** 反馈表单 */
export const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'other'], {
    message: '请选择反馈类型',
  }),
  title: z.string().min(5, '标题至少5个字符').max(100, '标题最多100个字符'),
  content: z.string().min(20, '内容至少20个字符').max(2000, '内容最多2000个字符'),
  contact: z.string().max(100, '联系方式最多100个字符').optional(),
})
export type FeedbackFormData = z.infer<typeof feedbackSchema>

/** 工单表单 */
export const ticketSchema = z.object({
  title: z.string().min(5, '标题至少5个字符').max(200, '标题最多200个字符'),
  category: z.enum(['technical', 'billing', 'account', 'other'], {
    message: '请选择工单类型',
  }),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], {
    message: '请选择优先级',
  }),
  content: z.string().min(20, '内容至少20个字符').max(5000, '内容最多5000个字符'),
  attachments: z.array(z.string()).max(5, '最多上传5个附件').optional(),
})
export type TicketFormData = z.infer<typeof ticketSchema>

// ============================================================
// Schema 验证辅助函数
// ============================================================

/**
 * 异步验证 (用于需要后端验证的场景)
 *
 * @example
 * const checkEmailUnique = async (email: string) => {
 *   const response = await api.checkEmail(email)
 *   return !response.exists
 * }
 *
 * const schema = z.object({
 *   email: z.string().superRefine(async (email, ctx) => {
 *     if (await checkEmailUnique(email)) {
 *       ctx.addIssue({
 *         code: z.ZodIssueCode.custom,
 *         message: '该邮箱已被注册',
 *       })
 *     }
 *   })
 * })
 */
export async function validateField<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string> }> {
  const result = schema.safeParse(value)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) {
      errors[path] = issue.message
    }
  }

  return { success: false, errors }
}

/**
 * 创建带异步验证的 schema
 *
 * @example
 * const uniqueEmailSchema = createAsyncSchema(
 *   emailSchema,
 *   async (email) => {
 *     const exists = await checkEmailExists(email)
 *     return exists ? '该邮箱已被注册' : undefined
 *   }
 * )
 */
export function createAsyncSchema<T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  asyncValidator: (values: z.infer<typeof baseSchema>) => Promise<string | undefined>
): z.ZodType<z.infer<typeof baseSchema>> {
  return baseSchema.extend({
    _asyncValidator: z.string().optional(),
  }).superRefine(async (values, ctx) => {
    const error = await asyncValidator(values as z.infer<typeof baseSchema>)
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      })
    }
  }).transform((data) => {
    // 移除内部字段
    const { _asyncValidator, ...rest } = data as typeof data & { _asyncValidator?: string }
    return rest
  }) as unknown as z.ZodType<z.infer<typeof baseSchema>>
}

// ============================================================
// 导出
// ============================================================

export * from 'zod'

/**
 * 性能表单配置
 * 优化项 16: React Hook Form - 性能表单
 *
 * 全局表单配置和常量
 */

// ============================================================
// 表单配置
// ============================================================

/** 默认表单配置 */
export const DEFAULT_FORM_CONFIG = {
  /** 验证模式 */
  mode: 'onBlur' as const,
  /** 提交时验证模式 */
  reValidateMode: 'onChange' as const,
  /** 是否自动聚焦错误 */
  shouldFocusError: true,
  /** 错误滚动偏移 */
  errorOffset: { top: -50 },
  /** 成功提示持续时间 */
  successDuration: 2000,
}

// ============================================================
// 字段配置
// ============================================================

/** 默认字段尺寸 */
export const DEFAULT_FIELD_SIZE = 'md' as const

/** 字段尺寸映射 */
export const FIELD_SIZES = {
  sm: {
    input: 'px-2 py-1 text-xs',
    label: 'text-xs',
    error: 'text-[10px]',
  },
  md: {
    input: 'px-3 py-2 text-sm',
    label: 'text-sm',
    error: 'text-xs',
  },
  lg: {
    input: 'px-4 py-3 text-base',
    label: 'text-base',
    error: 'text-sm',
  },
}

// ============================================================
// 按钮配置
// ============================================================

/** 按钮变体 */
export const BUTTON_VARIANTS = {
  primary: 'bg-black text-white hover:bg-zinc-800 active:bg-zinc-900',
  secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300',
  outline: 'border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100',
  ghost: 'text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

/** 按钮尺寸 */
export const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

// ============================================================
// 验证消息
// ============================================================

/** 中文验证消息 */
export const VALIDATION_MESSAGES = {
  required: '此字段为必填项',
  email: '请输入有效的邮箱地址',
  minLength: '输入内容过短',
  maxLength: '输入内容过长',
  pattern: '格式不正确',
  min: '数值过小',
  max: '数值过大',
  // 业务相关
  passwordMismatch: '两次密码输入不一致',
  passwordWeak: '密码强度不足，需包含大小写字母、数字和特殊字符',
  usernameExists: '该用户名已被使用',
  emailExists: '该邮箱已被注册',
  emailNotFound: '该邮箱未注册',
  invalidCredentials: '邮箱或密码错误',
  // 服务器相关
  serverNameTooShort: '服务器名称至少3个字符',
  serverNameTooLong: '服务器名称最多50个字符',
  serverPortInvalid: '端口号无效',
  serverIpInvalid: 'IP地址格式不正确',
}

// ============================================================
// 导出
// ============================================================

export * from './schemas'

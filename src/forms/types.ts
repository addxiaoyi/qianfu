/**
 * 性能表单类型定义
 * 优化项 16: React Hook Form - 性能表单
 */
import type {
  UseFormProps,
  UseFormReturn,
  FieldErrors,
  Control,
  FieldPath,
  RegisterOptions,
} from 'react-hook-form'
import type { z } from 'zod'

// ============================================================
// 表单字段变体
// ============================================================

export type FormFieldVariant = 'default' | 'filled' | 'outline'

export type FormFieldSize = 'sm' | 'md' | 'lg'

// ============================================================
// 表单验证规则
// ============================================================

/** 表单字段验证选项扩展 */
export interface FormFieldRules<T extends z.ZodType> {
  /** 自定义错误消息 */
  message?: string
  /** 是否必填 */
  required?: boolean | string
  /** 最小长度 */
  minLength?: number | { value: number; message: string }
  /** 最大长度 */
  maxLength?: number | { value: number; message: string }
  /** 最小值 */
  min?: number | { value: number; message: string }
  /** 最大值 */
  max?: number | { value: number; message: string }
  /** 正则表达式 */
  pattern?: { value: RegExp; message: string }
  /** 自定义验证函数 */
  validate?: Record<string, string | ((value: unknown) => boolean | string)>
  /** Zod 验证 schema */
  zod?: T
}

// ============================================================
// 表单上下文
// ============================================================

/** 表单配置上下文 */
export interface FormContextValue<T extends Record<string, unknown>> {
  /** 表单方法 */
  formState: UseFormReturn<T>['formState']
  /** 注册字段 */
  register: UseFormReturn<T>['register']
  /** 控制字段 */
  control: Control<T>
  /** 设置值 */
  setValue: UseFormReturn<T>['setValue']
  /** 获取值 */
  getValues: UseFormReturn<T>['getValues']
  /** 重置表单 */
  reset: UseFormReturn<T>['reset']
  /** 触发验证 */
  trigger: UseFormReturn<T>['trigger']
  /** 表单默认值 */
  defaultValues: T
  /** 表单变体 */
  variant?: FormFieldVariant
  /** 表单尺寸 */
  size?: FormFieldSize
}

// ============================================================
// 字段组件 Props
// ============================================================

/** 基础字段组件 Props */
export interface BaseFieldProps<T extends Record<string, unknown>> {
  /** 字段名称 */
  name: FieldPath<T>
  /** React Hook Form 控制器 */
  control: Control<T>
  /** 标签 */
  label?: string
  /** 占位符 */
  placeholder?: string
  /** 描述文本 */
  description?: string
  /** 禁用状态 */
  disabled?: boolean
  /** 只读状态 */
  readOnly?: boolean
  /** 样式变体 */
  variant?: FormFieldVariant
  /** 尺寸 */
  size?: FormFieldSize
  /** 自定义类名 */
  className?: string
  /** 标签自定义类名 */
  labelClassName?: string
  /** 输入框自定义类名 */
  inputClassName?: string
  /** 错误消息自定义类名 */
  errorClassName?: string
  /** 是否显示必填标识 */
  required?: boolean
}

/** 输入字段 Props */
export interface FormInputProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  /** 输入类型 */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  /** 前置图标 */
  leftIcon?: React.ReactNode
  /** 后置图标 */
  rightIcon?: React.ReactNode
  /** 前置文本 */
  prefix?: string
  /** 后置文本 */
  suffix?: string
  /** 自动完成 */
  autoComplete?: string
  /** 自动聚焦 */
  autoFocus?: boolean
  /** 最大字符数 */
  maxLength?: number
  /** 最小字符数 */
  minLength?: number
  /** 步进值 */
  step?: number
  /** 输入模式 */
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
}

/** 文本域 Props */
export interface FormTextareaProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  /** 行数 */
  rows?: number
  /** 最大字符数 */
  maxLength?: number
  /** 是否显示字符计数 */
  showCount?: boolean
  /** 是否可调整大小 */
  resize?: boolean | 'none' | 'vertical' | 'horizontal'
  /** 自动高度 */
  autoSize?: boolean
}

/** 选择字段 Props */
export interface FormSelectProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  /** 选项列表 */
  options: { label: string; value: string | number; disabled?: boolean }[]
  /** 是否可清除 */
  clearable?: boolean
  /** 是否可搜索 */
  searchable?: boolean
  /** 空选项文本 */
  emptyText?: string
  /** 多选 */
  multiple?: boolean
  /** 占位符（用于可搜索选择器） */
  searchPlaceholder?: string
}

/** 复选框 Props */
export interface FormCheckboxProps<T extends Record<string, unknown>>
  extends Omit<BaseFieldProps<T>, 'size'> {
  /** 复选框值 */
  value?: string | number
  /** 是否不确定 */
  indeterminate?: boolean
  /** 复选框尺寸 */
  checkboxSize?: 'sm' | 'md' | 'lg'
}

/** 单选组 Props */
export interface FormRadioGroupProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  /** 选项列表 */
  options: { label: string; value: string | number; disabled?: boolean; description?: string }[]
  /** 布局方向 */
  direction?: 'vertical' | 'horizontal'
}

/** 开关 Props */
export interface FormSwitchProps<T extends Record<string, unknown>>
  extends Omit<BaseFieldProps<T>, 'size'> {
  /** 开关尺寸 */
  switchSize?: 'sm' | 'md' | 'lg'
}

// ============================================================
// 表单提交状态
// ============================================================

/** 表单提交状态 */
export interface FormSubmitState {
  /** 是否正在提交 */
  isSubmitting: boolean
  /** 是否提交成功 */
  isSuccess: boolean
  /** 是否提交失败 */
  isError: boolean
  /** 错误消息 */
  error?: string
  /** 重置提交状态 */
  reset: () => void
}

// ============================================================
// 高性能表单配置
// ============================================================

/** 高性能表单配置选项 */
export interface PerformanceFormOptions<T extends Record<string, unknown>> {
  /** 启用字段级更新 */
  enableNativeValidation?: boolean
  /** 禁用默认值的深层相等检查 */
  disableDeepCheck?: boolean
  /** 字段更新节流 (ms) */
  fieldUpdateThrottle?: number
  /** 提交前清理数据 */
  sanitizeOnSubmit?: (data: T) => T
  /** 错误焦点滚动 */
  scrollToError?: boolean
  /** 错误偏移量 */
  errorOffset?: { x: number; y: number }
  /** 聚焦第一个错误 */
  focusFirstError?: boolean
}

/** usePerformanceForm 返回类型 */
export interface UsePerformanceFormReturn<T extends Record<string, unknown>>
  extends Pick<UseFormReturn<T>, 'setValue' | 'getValues' | 'reset' | 'trigger' | 'watch'> {
  /** 表单状态 (优化版本) */
  formState: Pick<
    UseFormReturn<T>['formState'],
    'isDirty' | 'isValid' | 'errors' | 'isSubmitting' | 'isSubmitted'
  > & {
    /** 优化：字段错误计数 */
    errorCount: number
    /** 优化：第一个错误字段名 */
    firstErrorField: FieldPath<T> | null
  }
  /** 注册字段 (缓存优化版本) */
  register: (
    name: FieldPath<T>,
    options?: RegisterOptions<T, FieldPath<T>>
  ) => ReturnType<UseFormReturn<T>['register']>
  /** 控制字段 */
  control: Control<T>
  /** 提交状态 */
  submitState: FormSubmitState
  /** 提交表单 (带性能优化) */
  handleSubmit: UseFormReturn<T>['handleSubmit']
  /** 重置提交状态 */
  resetSubmitState: () => void
  /** 聚焦错误字段 */
  focusError: () => void
}

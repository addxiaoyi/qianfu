/**
 * 性能表单字段组件
 * 优化项 16: React Hook Form - 性能表单
 *
 * 性能优化策略：
 * 1. React.memo 避免不必要的重渲染
 * 2. 精确的错误消息提取
 * 3. 统一的样式系统
 * 4. Controller 模式优化
 */
import { forwardRef, useMemo, useCallback, memo } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import type {
  Control,
  ControllerRenderProps,
  FieldPath,
  RegisterOptions,
} from 'react-hook-form'
import type { FormInputProps, FormTextareaProps, FormSelectProps } from './types'

// ============================================================
// 样式常量
// ============================================================

const VARIANT_STYLES = {
  default: {
    base: 'border border-zinc-300 bg-white',
    focus: 'focus:border-black focus:ring-1 focus:ring-black',
    error: 'border-red-500 focus:border-red-500 focus:ring-red-500',
    disabled: 'bg-zinc-100 cursor-not-allowed opacity-60',
  },
  filled: {
    base: 'border border-transparent bg-zinc-100',
    focus: 'focus:border-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-400',
    error: 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500',
    disabled: 'bg-zinc-200 cursor-not-allowed opacity-60',
  },
  outline: {
    base: 'border-2 border-zinc-200',
    focus: 'focus:border-black focus:ring-2 focus:ring-black/10',
    error: 'border-2 border-red-500 focus:ring-red-500/20',
    disabled: 'bg-zinc-50 cursor-not-allowed opacity-60',
  },
}

const SIZE_STYLES = {
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
// 工具函数
// ============================================================

/**
 * 获取字段错误消息
 */
function getFieldError(
  errors: Record<string, unknown>,
  name: string
): string | undefined {
  const fieldError = errors[name]
  if (!fieldError) return undefined

  // 处理 RHF 错误格式
  if (typeof fieldError === 'object' && fieldError !== null) {
    const errorObj = fieldError as { message?: string; types?: Record<string, string> }
    if (errorObj.message) {
      return String(errorObj.message)
    }
    if (errorObj.types) {
      const firstType = Object.values(errorObj.types)[0]
      return typeof firstType === 'string' ? firstType : undefined
    }
  }

  return String(fieldError)
}

// ============================================================
// 基础字段组件
// ============================================================

interface BaseFieldComponentProps {
  error?: string
  isInvalid?: boolean
  variant?: 'default' | 'filled' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}

/**
 * 基础字段包装器组件 (已优化)
 */
const BaseFieldWrapper = memo(function BaseFieldWrapper({
  error,
  isInvalid,
  variant = 'default',
  size = 'md',
  disabled,
  className = '',
  children,
}: BaseFieldComponentProps & { children: React.ReactNode }) {
  const styles = VARIANT_STYLES[variant]
  const sizeStyles = SIZE_STYLES[size]

  const containerClasses = useMemo(
    () => [
      'relative flex flex-col gap-1',
      className,
    ].filter(Boolean).join(' '),
    [className]
  )

  const inputClasses = useMemo(
    () => [
      'w-full rounded transition-colors outline-none',
      styles.base,
      !isInvalid && styles.focus,
      isInvalid && styles.error,
      disabled && styles.disabled,
      sizeStyles.input,
      // 禁用选中时的默认样式
      'disabled:cursor-not-allowed',
      // 平滑过渡
      'transition-all duration-150',
    ].filter(Boolean).join(' '),
    [styles, sizeStyles, isInvalid, disabled]
  )

  return (
    <div className={containerClasses}>
      {children}
      {error && (
        <p className={`${sizeStyles.error} text-red-500 mt-1`}>
          {error}
        </p>
      )}
    </div>
  )
})

/**
 * 标签组件 (已优化)
 */
const FieldLabel = memo(function FieldLabel({
  label,
  htmlFor,
  required,
  size = 'md',
  className = '',
}: {
  label?: string
  htmlFor: string
  required?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeStyles = SIZE_STYLES[size]

  if (!label) return null

  return (
    <label
      htmlFor={htmlFor}
      className={[
        'font-medium text-zinc-700 flex items-center gap-1',
        sizeStyles.label,
        className,
      ].filter(Boolean).join(' ')}
    >
      {label}
      {required && (
        <span className="text-red-500" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
})

/**
 * 描述文本组件 (已优化)
 */
const FieldDescription = memo(function FieldDescription({
  description,
  size = 'md',
}: {
  description?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeStyles = SIZE_STYLES[size]

  if (!description) return null

  return (
    <p className={`text-zinc-500 ${sizeStyles.error}`}>
      {description}
    </p>
  )
})

// ============================================================
// 优化的 FormField 组件
// ============================================================

interface OptimizedFormFieldProps {
  name: string
  control: Control<Record<string, unknown>>
  children: (props: {
    field: ControllerRenderProps<Record<string, unknown>, FieldPath<Record<string, unknown>>>
    fieldState: {
      invalid: boolean
      isTouched: boolean
      error?: string
    }
  }) => React.ReactElement
  defaultValue?: unknown
  rules?: RegisterOptions
  disabled?: boolean
  variant?: 'default' | 'filled' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * 优化的 FormField 组件
 *
 * 使用 Controller 模式，但只订阅必要的字段变化
 */
export const OptimizedFormField = memo(function OptimizedFormField({
  name,
  control,
  children,
  defaultValue,
  rules,
  disabled,
  variant = 'default',
  size = 'md',
}: OptimizedFormFieldProps) {
  return (
    <Controller
      name={name as FieldPath<Record<string, unknown>>}
      control={control}
      defaultValue={defaultValue}
      rules={rules}
      disabled={disabled}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message
        const isInvalid = !!fieldState.error

        return (
          <BaseFieldWrapper
            error={error}
            isInvalid={isInvalid}
            variant={variant}
            size={size}
            disabled={disabled}
          >
            {children({
              field,
              fieldState: {
                invalid: fieldState.invalid,
                isTouched: fieldState.isTouched,
                error,
              },
            })}
          </BaseFieldWrapper>
        )
      }}
    />
  )
})

// ============================================================
// 优化的 Input 组件
// ============================================================

/**
 * 优化的 FormInput 组件
 */
export const FormInput = memo(
  forwardRef<HTMLInputElement, FormInputProps<Record<string, unknown>>>(
    function FormInput(
      {
        name,
        control,
        label,
        placeholder,
        description,
        disabled,
        variant = 'default',
        size = 'md',
        type = 'text',
        required,
        leftIcon,
        rightIcon,
        prefix,
        suffix,
        autoComplete,
        autoFocus,
        maxLength,
        minLength,
        className,
        labelClassName,
        inputClassName,
        errorClassName,
        ...rest
      },
      ref
    ) {
      const sizeStyles = SIZE_STYLES[size]

      return (
        <OptimizedFormField
          name={name}
          control={control}
          variant={variant}
          size={size}
          disabled={disabled}
        >
          {({ field, fieldState }) => {
            const error = fieldState.error
            const isInvalid = !!fieldState.error
            const styles = VARIANT_STYLES[variant]
            const inputValue = field.value == null ? '' : String(field.value)

            return (
              <div className={className}>
                <FieldLabel
                  label={label}
                  htmlFor={name}
                  required={required}
                  size={size}
                  className={labelClassName}
                />
                <FieldDescription description={description} size={size} />

                <div className="relative">
                  {/* 前置内容 */}
                  {prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                      {prefix}
                    </span>
                  )}

                  {/* 左图标 */}
                  {leftIcon && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      {leftIcon}
                    </span>
                  )}

                  <input
                    {...rest}
                    name={field.name}
                    value={inputValue}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={(instance) => {
                      // 处理 ref
                      if (typeof ref === 'function') {
                        ref(instance)
                      } else if (ref) {
                        ref.current = instance
                      }
                      // RHF ref
                      field.ref(instance)
                    }}
                    id={name}
                    type={type}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    maxLength={maxLength}
                    minLength={minLength}
                    aria-invalid={isInvalid}
                    aria-describedby={error ? `${name}-error` : undefined}
                    className={[
                      'w-full rounded transition-colors outline-none',
                      styles.base,
                      !isInvalid && styles.focus,
                      isInvalid && styles.error,
                      disabled && styles.disabled,
                      sizeStyles.input,
                      prefix && 'pl-8',
                      suffix && 'pr-8',
                      leftIcon && 'pl-10',
                      rightIcon && 'pr-10',
                      inputClassName,
                    ].filter(Boolean).join(' ')}
                  />

                  {/* 右图标 */}
                  {rightIcon && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      {rightIcon}
                    </span>
                  )}

                  {/* 后置内容 */}
                  {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                      {suffix}
                    </span>
                  )}
                </div>

                {error && (
                  <p
                    id={`${name}-error`}
                    className={`${sizeStyles.error} text-red-500 mt-1 ${errorClassName || ''}`}
                  >
                    {error}
                  </p>
                )}
              </div>
            )
          }}
        </OptimizedFormField>
      )
    }
  )
)

FormInput.displayName = 'FormInput'

// ============================================================
// 优化的 Textarea 组件
// ============================================================

/**
 * 优化的 FormTextarea 组件
 */
export const FormTextarea = memo(
  forwardRef<HTMLTextAreaElement, FormTextareaProps<Record<string, unknown>>>(
    function FormTextarea(
      {
        name,
        control,
        label,
        placeholder,
        description,
        disabled,
        variant = 'default',
        size = 'md',
        rows = 4,
        maxLength,
        showCount,
        resize = true,
        required,
        className,
        labelClassName,
        inputClassName,
        errorClassName,
        ...rest
      },
      ref
    ) {
      const sizeStyles = SIZE_STYLES[size]

      return (
        <OptimizedFormField
          name={name}
          control={control}
          variant={variant}
          size={size}
          disabled={disabled}
        >
          {({ field, fieldState }) => {
            const error = fieldState.error
            const isInvalid = !!fieldState.error
            const styles = VARIANT_STYLES[variant]
            const value = field.value == null ? '' : String(field.value)
            const currentLength = value.length

            const resizeClass = resize === true ? 'resize' : resize === false ? 'resize-none' : `resize-${resize}`

            return (
              <div className={className}>
                <FieldLabel
                  label={label}
                  htmlFor={name}
                  required={required}
                  size={size}
                  className={labelClassName}
                />
                <FieldDescription description={description} size={size} />

                  <textarea
                    {...rest}
                    name={field.name}
                    value={value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  ref={(instance) => {
                    if (typeof ref === 'function') {
                      ref(instance)
                    } else if (ref) {
                      ref.current = instance
                    }
                    field.ref(instance)
                  }}
                  id={name}
                  rows={rows}
                  placeholder={placeholder}
                  disabled={disabled}
                  maxLength={maxLength}
                  aria-invalid={isInvalid}
                  aria-describedby={error ? `${name}-error` : undefined}
                  className={[
                    'w-full rounded transition-colors outline-none',
                    styles.base,
                    !isInvalid && styles.focus,
                    isInvalid && styles.error,
                    disabled && styles.disabled,
                    sizeStyles.input,
                    resizeClass,
                    inputClassName,
                  ].filter(Boolean).join(' ')}
                />

                <div className="flex justify-between items-center mt-1">
                  {error && (
                    <p
                      id={`${name}-error`}
                      className={`${sizeStyles.error} text-red-500 ${errorClassName || ''}`}
                    >
                      {error}
                    </p>
                  )}
                  {showCount && maxLength && (
                    <p className={`${sizeStyles.error} text-zinc-400 ml-auto`}>
                      {currentLength}/{maxLength}
                    </p>
                  )}
                </div>
              </div>
            )
          }}
        </OptimizedFormField>
      )
    }
  )
)

FormTextarea.displayName = 'FormTextarea'

// ============================================================
// 优化的 Select 组件
// ============================================================

/**
 * 优化的 FormSelect 组件
 */
export const FormSelect = memo(
  forwardRef<HTMLSelectElement, FormSelectProps<Record<string, unknown>>>(
    function FormSelect(
      {
        name,
        control,
        label,
        description,
        disabled,
        variant = 'default',
        size = 'md',
        options,
        required,
        emptyText = '请选择',
        clearable,
        className,
        labelClassName,
        inputClassName,
        errorClassName,
        ...rest
      },
      ref
    ) {
      const sizeStyles = SIZE_STYLES[size]

      return (
        <OptimizedFormField
          name={name}
          control={control}
          variant={variant}
          size={size}
          disabled={disabled}
        >
          {({ field, fieldState }) => {
            const error = fieldState.error
            const isInvalid = !!fieldState.error
            const styles = VARIANT_STYLES[variant]
            const value = field.value == null ? '' : String(field.value)

            return (
              <div className={className}>
                <FieldLabel
                  label={label}
                  htmlFor={name}
                  required={required}
                  size={size}
                  className={labelClassName}
                />
                <FieldDescription description={description} size={size} />

                <div className="relative">
                  <select
                    {...rest}
                    name={field.name}
                    value={value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={(instance) => {
                      if (typeof ref === 'function') {
                        ref(instance)
                      } else if (ref) {
                        ref.current = instance
                      }
                      field.ref(instance)
                    }}
                    id={name}
                    disabled={disabled}
                    aria-invalid={isInvalid}
                    aria-describedby={error ? `${name}-error` : undefined}
                    className={[
                      'w-full rounded transition-colors outline-none appearance-none',
                      'bg-white bg-no-repeat bg-right pr-10',
                      styles.base,
                      !isInvalid && styles.focus,
                      isInvalid && styles.error,
                      disabled && styles.disabled,
                      sizeStyles.input,
                      inputClassName,
                      // 下拉箭头
                      'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M3 4.5L6 7.5L9 4.5\'/%3E%3C/svg%3E")]',
                      'bg-[length:12px] bg-[right_12px_center]',
                    ].filter(Boolean).join(' ')}
                  >
                    {emptyText && (
                      <option value="" disabled>
                        {emptyText}
                      </option>
                    )}
                    {options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {/* 下拉箭头覆盖层 */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {error && (
                  <p
                    id={`${name}-error`}
                    className={`${sizeStyles.error} text-red-500 mt-1 ${errorClassName || ''}`}
                  >
                    {error}
                  </p>
                )}
              </div>
            )
          }}
        </OptimizedFormField>
      )
    }
  )
)

FormSelect.displayName = 'FormSelect'

// ============================================================
// 导出
// ============================================================

export {
  FormInput as Input,
  FormTextarea as Textarea,
  FormSelect as Select,
  OptimizedFormField as FormField,
  BaseFieldWrapper,
  FieldLabel,
  FieldDescription,
}

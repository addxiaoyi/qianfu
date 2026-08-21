/**
 * 性能表单组件
 * 优化项 16: React Hook Form - 性能表单
 *
 * 提供完整的表单组件，包括:
 * - Form: 表单容器组件
 * - FormProvider: 表单上下文提供者
 * - SubmitButton: 优化的提交按钮
 */
import React, { forwardRef, memo, useMemo, useCallback, createContext, useContext } from 'react'
import { useForm, FormProvider, useFormContext } from 'react-hook-form'
import type { UseFormProps, SubmitHandler } from 'react-hook-form'
import type { FormSubmitState } from './types'

// ============================================================
// 表单上下文
// ============================================================

interface PerformanceFormContextValue {
  /** 表单提交状态 */
  submitState: FormSubmitState
  /** 是否显示成功提示 */
  showSuccess?: boolean
  /** 成功消息 */
  successMessage?: string
}

const PerformanceFormContext = createContext<PerformanceFormContextValue | null>(null)

/**
 * 使用性能表单上下文
 */
export function usePerformanceFormContext() {
  const context = useContext(PerformanceFormContext)
  if (!context) {
    throw new Error('usePerformanceFormContext must be used within PerformanceFormProvider')
  }
  return context
}

// ============================================================
// 样式常量
// ============================================================

const BUTTON_VARIANTS = {
  primary: 'bg-black text-white hover:bg-zinc-800 active:bg-zinc-900',
  secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300',
  outline: 'border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100',
  ghost: 'text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

// ============================================================
// SubmitButton 组件
// ============================================================

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: keyof typeof BUTTON_VARIANTS
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 加载中文本 */
  loadingText?: string
  /** 成功图标 */
  successIcon?: React.ReactNode
  /** 是否显示成功状态 */
  showSuccess?: boolean
  /** 成功持续时间 (ms) */
  successDuration?: number
  /** 是否全宽 */
  fullWidth?: boolean
}

/**
 * 优化的提交按钮组件
 */
export const SubmitButton = memo(
  forwardRef<HTMLButtonElement, SubmitButtonProps>(
    function SubmitButton(
      {
        variant = 'primary',
        size = 'md',
        loadingText,
        successIcon,
        showSuccess = true,
        successDuration = 2000,
        fullWidth = false,
        children,
        disabled,
        className = '',
        onClick,
        ...props
      },
      ref
    ) {
      const { submitState } = usePerformanceFormContext()

      const isLoading = submitState.isSubmitting
      const isSuccess = submitState.isSuccess && showSuccess
      const isDisabled = disabled || isLoading

      const buttonClasses = useMemo(
        () => [
          'inline-flex items-center justify-center gap-2 font-medium rounded transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black',
          BUTTON_VARIANTS[variant],
          BUTTON_SIZES[size],
          fullWidth && 'w-full',
          (isDisabled || isLoading) && 'opacity-60 cursor-not-allowed',
          className,
        ].filter(Boolean).join(' '),
        [variant, size, fullWidth, isDisabled, isLoading, className]
      )

      // 成功状态自动重置
      const successTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

      React.useEffect(() => {
        if (isSuccess && successDuration > 0) {
          successTimeoutRef.current = setTimeout(() => {
            submitState.reset()
          }, successDuration)
        }

        return () => {
          if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current)
          }
        }
      }, [isSuccess, successDuration, submitState])

      return (
        <button
          ref={ref}
          type="submit"
          disabled={isDisabled}
          className={buttonClasses}
          onClick={onClick}
          {...props}
        >
          {/* 加载状态 */}
          {isLoading && (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>{loadingText || '提交中...'}</span>
            </>
          )}

          {/* 成功状态 */}
          {!isLoading && isSuccess && (
            <>
              {successIcon || (
                <svg
                  className="h-4 w-4 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              <span>提交成功</span>
            </>
          )}

          {/* 默认状态 */}
          {!isLoading && !isSuccess && <>{children}</>}
        </button>
      )
    }
  )
)

SubmitButton.displayName = 'SubmitButton'

// ============================================================
// Form 组件
// ============================================================

interface FormProps<T extends Record<string, unknown>> extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** 表单默认值 */
  defaultValues?: UseFormProps<T>['defaultValues']
  /** 表单验证模式 */
  mode?: 'onBlur' | 'onChange' | 'onTouched' | 'all'
  /** 提交时验证模式 */
  reValidateMode?: 'onChange' | 'onBlur' | 'onSubmit'
  /** 是否滚动到第一个错误 */
  scrollToError?: boolean
  /** 错误滚动偏移量 */
  errorOffset?: { top?: number; left?: number }
  /** 是否聚焦第一个错误 */
  focusFirstError?: boolean
  /** 提交成功消息 */
  successMessage?: string
  /** 是否显示成功提示 */
  showSuccess?: boolean
  /** 成功提示持续时间 (ms) */
  successDuration?: number
  /** 提交处理器 */
  onSubmit?: SubmitHandler<T>
  /** 提交失败处理器 */
  onError?: (errors: unknown) => void
  /** 子元素 */
  children: React.ReactNode
}

/**
 * 优化的 Form 组件
 *
 * @example
 * <Form
 *   defaultValues={{ email: '', password: '' }}
 *   onSubmit={handleSubmit}
 * >
 *   <FormInput name="email" label="邮箱" />
 *   <FormInput name="password" type="password" label="密码" />
 *   <SubmitButton>登录</SubmitButton>
 * </Form>
 */
export function Form<T extends Record<string, unknown>>({
  defaultValues,
  mode = 'onBlur',
  reValidateMode = 'onChange',
  scrollToError = true,
  errorOffset = { top: -50 },
  focusFirstError = true,
  successMessage,
  showSuccess = true,
  successDuration = 2000,
  onSubmit,
  onError,
  children,
  className,
  ...props
}: FormProps<T>) {
  // 提交状态
  const [submitState, setSubmitState] = React.useState<FormSubmitState>({
    isSubmitting: false,
    isSuccess: false,
    isError: false,
    error: undefined,
    reset: () => {
      setSubmitState((prev) => ({
        ...prev,
        isSuccess: false,
        isError: false,
        error: undefined,
      }))
    },
  })

  // 表单方法
  const methods = useForm<T>({
    defaultValues,
    mode,
    reValidateMode,
    shouldFocusError: focusFirstError,
  })

  // 优化的提交处理
  const handleSubmit = useCallback(
    async (data: T) => {
      // 开始提交
      setSubmitState((prev) => ({
        ...prev,
        isSubmitting: true,
        isSuccess: false,
        isError: false,
        error: undefined,
      }))

      try {
        // 执行提交
        await onSubmit?.(data)

        // 提交成功
        setSubmitState({
          isSubmitting: false,
          isSuccess: true,
          isError: false,
          error: undefined,
          reset: () => {
            setSubmitState((prev) => ({
              ...prev,
              isSuccess: false,
              isError: false,
              error: undefined,
            }))
          },
        })

        // 自动重置成功状态
        if (successDuration > 0) {
          setTimeout(() => {
            setSubmitState((prev) => ({
              ...prev,
              isSuccess: false,
            }))
          }, successDuration)
        }
      } catch (error) {
        // 提交失败
        setSubmitState({
          isSubmitting: false,
          isSuccess: false,
          isError: true,
          error: error instanceof Error ? error.message : '提交失败，请重试',
          reset: () => {
            setSubmitState((prev) => ({
              ...prev,
              isError: false,
              error: undefined,
            }))
          },
        })

        onError?.(error)

        // 滚动到第一个错误
        if (scrollToError) {
          const firstErrorKey = Object.keys(methods.formState.errors || {})[0]
          if (firstErrorKey) {
            const element = document.querySelector(`[name="${firstErrorKey}"]`)
            if (element) {
              element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
                ...errorOffset,
              })
            }
          }
        }
      }
    },
    [onSubmit, onError, scrollToError, errorOffset, methods.formState.errors, successDuration]
  )

  // 表单上下文值
  const contextValue = useMemo<PerformanceFormContextValue>(
    () => ({
      submitState,
      showSuccess,
      successMessage,
    }),
    [submitState, showSuccess, successMessage]
  )

  return (
    <FormProvider {...methods}>
      <PerformanceFormContext.Provider value={contextValue}>
        <form
          onSubmit={methods.handleSubmit(handleSubmit as SubmitHandler<T>)}
          className={className}
          noValidate
          {...props}
        >
          {children}
        </form>
      </PerformanceFormContext.Provider>
    </FormProvider>
  )
}

// ============================================================
// 导出
// ============================================================

export { Form as default, FormProvider }

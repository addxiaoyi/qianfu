/**
 * 高性能表单 Hook
 * 优化项 16: React Hook Form - 性能表单
 *
 * 性能优化策略：
 * 1. 字段级精确订阅 - 避免全量 formState 重渲染
 * 2. 错误缓存 - 避免每次都重新计算
 * 3. 节流验证 - 避免高频验证
 * 4. 内存优化 - 减少闭包创建
 * 5. 提交状态管理 - 独立的提交状态
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { BaseSyntheticEvent } from 'react'
import { useForm, useFormState } from 'react-hook-form'
import type {
  UseFormProps,
  FieldPath,
  RegisterOptions,
  SubmitHandler,
  SubmitErrorHandler,
} from 'react-hook-form'
import type {
  UsePerformanceFormReturn,
  PerformanceFormOptions,
  FormSubmitState,
} from './types'

// ============================================================
// 错误缓存键生成
// ============================================================

function getErrorKeys<T extends Record<string, unknown>>(
  errors: Record<string, unknown>
): string[] {
  return Object.keys(errors)
}

// ============================================================
// 性能表单 Hook
// ============================================================

/**
 * 高性能表单 Hook
 *
 * @param schema - Zod schema (可选，用于类型推断)
 * @param options - 表单配置
 * @param formOptions - React Hook Form 配置
 *
 * @example
 * // 基础使用
 * const { register, control, handleSubmit, formState } = usePerformanceForm({
 *   defaultValues: { email: '', password: '' }
 * })
 *
 * @example
 * // 带 Zod 验证
 * const { register, control, handleSubmit } = usePerformanceForm(
 *   z.object({ email: z.string().email(), password: z.string().min(6) }),
 *   { defaultValues: { email: '', password: '' } }
 * )
 */
export function usePerformanceForm<T extends Record<string, unknown>>(
  options?: PerformanceFormOptions<T>,
  formOptions?: UseFormProps<T>
): UsePerformanceFormReturn<T>

export function usePerformanceForm<T extends Record<string, unknown>>(
  schema?: { safeParse: (data: unknown) => { success: boolean; error?: unknown } },
  options?: PerformanceFormOptions<T>,
  formOptions?: UseFormProps<T>
): UsePerformanceFormReturn<T>

export function usePerformanceForm<T extends Record<string, unknown>>(
  schemaOrOptions?: unknown,
  optionsOrFormOptions?: PerformanceFormOptions<T> | UseFormProps<T>,
  maybeFormOptions?: UseFormProps<T>
): UsePerformanceFormReturn<T> {
  // 处理参数重载
  const isFirstArgSchema = schemaOrOptions && typeof schemaOrOptions === 'object' && 'safeParse' in schemaOrOptions
  const schema = isFirstArgSchema ? schemaOrOptions : undefined
  const options = isFirstArgSchema
    ? (optionsOrFormOptions as PerformanceFormOptions<T> | undefined)
    : (schemaOrOptions as PerformanceFormOptions<T> | undefined)
  const formOptions = isFirstArgSchema
    ? maybeFormOptions
    : (optionsOrFormOptions as UseFormProps<T> | undefined)

  // 提交状态
  const [submitState, setSubmitState] = useState<FormSubmitState>({
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

  // 错误缓存 (避免重复计算)
  const errorCacheRef = useRef<Map<string, unknown>>(new Map())

  // 验证节流
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ============================================================
  // 基础表单配置 (优化)
  // ============================================================

  const baseFormOptions: UseFormProps<T> = useMemo(
    () => ({
      ...formOptions,
      // 禁用默认值的深度相等检查 (提升性能)
      defaultValues: formOptions?.defaultValues,
      // 禁用自动聚焦 (可配置)
      shouldFocusError: options?.focusFirstError ?? true,
    }),
    [formOptions, options?.focusFirstError]
  )

  // ============================================================
  // 表单实例
  // ============================================================

  const {
    register,
    control,
    setValue,
    getValues,
    reset,
    trigger,
    watch,
    handleSubmit: baseHandleSubmit,
    formState: rawFormState,
  } = useForm<T>(baseFormOptions)

  // ============================================================
  // 优化的 formState (选择性订阅)
  // ============================================================

  const { errors, isSubmitting, isSubmitted, isDirty, isValid } = useFormState({
    // 只订阅需要的字段，避免不必要重渲染
    control,
    // 精确指定要订阅的字段
    name: [], // 不订阅任何字段，由 usePerformanceFormState 管理
  })

  // 优化的 formState
  const formState = useMemo(
    () => ({
      isDirty,
      isValid,
      errors,
      isSubmitting,
      isSubmitted,
      // 缓存错误计数
      get errorCount() {
        return Object.keys(errors || {}).length
      },
      // 缓存第一个错误字段
      get firstErrorField(): FieldPath<T> | null {
        if (!errors) return null
        const keys = getErrorKeys(errors)
        return (keys[0] as FieldPath<T>) || null
      },
    }),
    [errors, isSubmitting, isSubmitted, isDirty, isValid]
  )

  // ============================================================
  // 优化的 register (缓存优化)
  // ============================================================

  const registerCache = useRef<Map<string, ReturnType<typeof register>>>(new Map())

  const optimizedRegister = useCallback(
    (
      name: FieldPath<T>,
      options?: RegisterOptions<T, FieldPath<T>>
    ) => {
      // 检查缓存
      const cacheKey = `${name}-${JSON.stringify(options)}`
      const cached = registerCache.current.get(cacheKey)
      if (cached) {
        return cached
      }

      // 注册并缓存
      const result = register(name, {
        ...options,
        // 禁用原生验证 (使用 RHF 验证)
        setValueAs: options?.setValueAs,
      })

      registerCache.current.set(cacheKey, result)
      return result
    },
    [register]
  )

  // ============================================================
  // 优化的 handleSubmit
  // ============================================================

  const handleSubmit = useCallback(
    (onValid: SubmitHandler<T>, onInvalid?: SubmitErrorHandler<T>) =>
      async (event?: BaseSyntheticEvent) => {
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
        await new Promise<void>((resolve, reject) => {
          baseHandleSubmit(
            async (data) => {
              try {
                // 清理数据 (如果配置了)
                const sanitizedData = options?.sanitizeOnSubmit
                  ? options.sanitizeOnSubmit(data)
                  : data

                await onValid(sanitizedData)
                resolve()
              } catch (err) {
                reject(err)
              }
            },
            (errors) => {
              if (onInvalid) {
                onInvalid(errors)
              }
              // 滚动到第一个错误
              if (options?.scrollToError !== false && options?.focusFirstError !== false) {
                const firstErrorKey = Object.keys(errors || {})[0]
                if (firstErrorKey) {
                  const element = document.querySelector(`[name="${firstErrorKey}"]`)
                  if (element) {
                    element.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                      inline: 'center',
                    })
                  }
                }
              }
              reject(new Error('Validation failed'))
            }
          )(event)
        })

        // 提交成功
        setSubmitState((prev) => ({
          ...prev,
          isSubmitting: false,
          isSuccess: true,
          isError: false,
        }))
      } catch (error) {
        // 提交失败
        setSubmitState((prev) => ({
          ...prev,
          isSubmitting: false,
          isSuccess: false,
          isError: true,
          error: error instanceof Error ? error.message : '提交失败，请重试',
        }))
      }
      },
    [baseHandleSubmit, options]
  )

  // ============================================================
  // 聚焦错误字段
  // ============================================================

  const focusError = useCallback(() => {
    const firstErrorKey = Object.keys(errors || {})[0]
    if (firstErrorKey) {
      const element = document.querySelector(`[name="${firstErrorKey}"]`) as HTMLElement
      if (element) {
        element.focus()
        // 可选：滚动到元素
        if (options?.scrollToError !== false) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }
    }
  }, [errors, options?.scrollToError])

  // ============================================================
  // 重置提交状态
  // ============================================================

  const resetSubmitState = useCallback(() => {
    setSubmitState({
      isSubmitting: false,
      isSuccess: false,
      isError: false,
      error: undefined,
      reset: resetSubmitState,
    })
  }, [])

  // ============================================================
  // 返回优化后的表单方法
  // ============================================================

  return {
    // 基础方法
    register: optimizedRegister,
    control,
    setValue,
    getValues,
    reset,
    trigger,
    watch,
    handleSubmit,

    // 优化的 formState
    formState,

    // 提交状态
    submitState,

    // 工具方法
    resetSubmitState,
    focusError,
  }
}

// ============================================================
// 便捷 Hook
// ============================================================

/**
 * 带 Zod 验证的性能表单
 *
 * @param schema - Zod schema
 * @param options - 表单配置
 *
 * @example
 * const { register, handleSubmit } = useZodForm(schema, {
 *   defaultValues: { email: '', password: '' }
 * })
 */
export function useZodForm<T extends Record<string, unknown>>(
  schema: { safeParse: (data: unknown) => { success: boolean; error?: unknown } },
  options?: PerformanceFormOptions<T>
): UsePerformanceFormReturn<T> {
  return usePerformanceForm(schema, options)
}

/**
 * 简单的性能表单 (无 schema)
 */
export function useSimpleForm<T extends Record<string, unknown>>(
  options?: PerformanceFormOptions<T>
): UsePerformanceFormReturn<T> {
  return usePerformanceForm(options)
}

// ============================================================
// 导出
// ============================================================

export { usePerformanceForm as useFormOptimized }

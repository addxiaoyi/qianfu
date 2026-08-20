/**
 * 性能表单开发工具
 * 优化项 16: React Hook Form - 性能表单
 *
 * 提供表单调试和开发辅助工具
 */
import { useEffect, useRef, useCallback } from 'react'
import { useFormState } from 'react-hook-form'
import type { Control, UseFormStateReturn } from 'react-hook-form'

// ============================================================
// 开发工具 Hook
// ============================================================

interface UseFormDevtoolsOptions {
  /** 是否启用调试 */
  enabled?: boolean
  /** 日志级别 */
  level?: 'info' | 'warn' | 'error'
  /** 是否在开发环境启用 */
  devOnly?: boolean
}

/**
 * 表单开发调试工具
 *
 * @param control - 表单控制
 * @param options - 调试选项
 *
 * @example
 * const { control } = useForm()
 * useFormDevtools(control)
 *
 * // 调试默认关闭；显式启用时也只记录字段名和错误数量。
 */
export function useFormDevtools<T extends Record<string, unknown>>(
  control: Control<T>,
  options: UseFormDevtoolsOptions = {}
) {
  const {
    enabled = false,
    level = 'info',
    devOnly = true,
  } = options

  // 检查是否应该启用
  const shouldEnable = enabled && (!devOnly || import.meta.env.DEV)

  const prevValuesRef = useRef<Partial<T>>({})

  // 获取表单状态
  const formState = useFormState({ control })

  // 调试日志
  const log = useCallback(
    (message: string) => {
      if (!shouldEnable) return

      const logFn = {
        info: console.info,
        warn: console.warn,
        error: console.error,
      }[level]

      logFn(`[FormDevtools] ${message}`)
    },
    [shouldEnable, level]
  )

  // 字段变化监控
  useEffect(() => {
    if (!shouldEnable) return

    const currentValues = (formState.defaultValues ?? {}) as Partial<T>
    const changedFields: string[] = []

    for (const key of Object.keys(currentValues)) {
      const prevValue = prevValuesRef.current[key as keyof T]
      const currentValue = currentValues[key as keyof T]

      if (prevValue !== currentValue) {
        changedFields.push(key)
        prevValuesRef.current[key as keyof T] = currentValue
      }
    }

    if (changedFields.length > 0) {
      log(`Fields changed: ${changedFields.join(', ')}`)
    }
  }, [formState.defaultValues, shouldEnable, log])

  // 错误变化监控
  useEffect(() => {
    if (!shouldEnable) return

    const errors = formState.errors
    const errorCount = Object.keys(errors ?? {}).length

    if (errorCount > 0) {
      const errorFields = Object.keys(errors ?? {})
      log(`Validation errors (${errorCount}): ${errorFields.join(', ')}`)
    }
  }, [formState.errors, shouldEnable, log])

  // 提交状态监控
  useEffect(() => {
    if (!shouldEnable) return

    if (formState.isSubmitting) {
      log('Form is submitting...')
    }

    if (formState.isSubmitted && !formState.isSubmitting) {
      if (Object.keys(formState.errors ?? {}).length > 0) {
        log(`Form submitted with validation errors (${Object.keys(formState.errors ?? {}).length})`)
      } else {
        log('Form submitted successfully')
      }
    }
  }, [formState.isSubmitting, formState.isSubmitted, formState.errors, shouldEnable, log])

  // 脏状态监控
  useEffect(() => {
    if (!shouldEnable) return

    if (formState.isDirty) {
      log('Form has unsaved changes')
    }
  }, [formState.isDirty, shouldEnable, log])

  return null
}

// ============================================================
// 表单性能分析器
// ============================================================

interface FormPerformanceMetrics {
  /** 渲染次数 */
  renderCount: number
  /** 最后重渲染时间 */
  lastRerenderTime: number
  /** 平均重渲染时间 */
  averageRerenderTime: number
  /** 提交次数 */
  submitCount: number
  /** 验证次数 */
  validationCount: number
  /** 错误次数 */
  errorCount: number
  /** 重置次数 */
  resetCount: number
}

/**
 * 表单性能分析 Hook
 *
 * @param control - 表单控制
 * @returns 性能指标
 *
 * @example
 * const { control } = useForm()
 * const metrics = useFormPerformance(control)
 *
 * // 定期检查性能
 * useEffect(() => {
 *   console.log('Performance:', metrics)
 * }, [metrics])
 */
export function useFormPerformance<T extends Record<string, unknown>>(
  control: Control<T>
): FormPerformanceMetrics {
  const metricsRef = useRef<FormPerformanceMetrics>({
    renderCount: 0,
    lastRerenderTime: 0,
    averageRerenderTime: 0,
    submitCount: 0,
    validationCount: 0,
    errorCount: 0,
    resetCount: 0,
  })

  const prevSubmittingRef = useRef(false)

  // 获取表单状态
  const formState = useFormState({ control })

  // 记录重渲染
  useEffect(() => {
    const now = performance.now()
    const prevTime = metricsRef.current.lastRerenderTime

    if (prevTime > 0) {
      const rerenderTime = now - prevTime
      const count = metricsRef.current.renderCount
      const avg = metricsRef.current.averageRerenderTime

      metricsRef.current.averageRerenderTime =
        (avg * count + rerenderTime) / (count + 1)
    }

    metricsRef.current.lastRerenderTime = now
    metricsRef.current.renderCount++
  })

  // 记录提交
  useEffect(() => {
    if (!prevSubmittingRef.current && formState.isSubmitting) {
      metricsRef.current.submitCount++
    }
    prevSubmittingRef.current = formState.isSubmitting
  }, [formState.isSubmitting])

  // 记录错误
  useEffect(() => {
    const errors = Object.keys(formState.errors ?? {}).length
    metricsRef.current.errorCount = errors
  }, [formState.errors])

  return metricsRef.current
}

// ============================================================
// 表单状态快照
// ============================================================

/**
 * 获取表单状态快照 (用于调试)
 *
 * @param formState - 表单状态
 * @returns 快照对象
 */
export function getFormStateSnapshot<T extends Record<string, unknown>>(
  formState: UseFormStateReturn<T>
): {
  isDirty: boolean
  isValid: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  isSubmitSuccessful: boolean
  submitCount: number
  errorCount: number
  errors: Record<string, unknown>
} {
  return {
    isDirty: formState.isDirty,
    isValid: formState.isValid,
    isSubmitting: formState.isSubmitting,
    isSubmitted: formState.isSubmitted,
    isSubmitSuccessful: formState.isSubmitSuccessful,
    submitCount: formState.submitCount,
    errorCount: Object.keys(formState.errors ?? {}).length,
    errors: formState.errors ?? {},
  }
}

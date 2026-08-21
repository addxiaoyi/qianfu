/**
 * 表单渲染器
 * 基于 Schema 动态渲染 React 表单
 * 优化项 19: 表单生成器 - 可视化
 */
import React, { useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import type { Field, FormSchema, InputField, SelectField, RadioGroupField } from './schema'
import { FieldTypes } from './schema'
import type { FormFieldVariant, FormFieldSize } from './types'
import type { Control, DefaultValues, FieldValues, SubmitErrorHandler } from 'react-hook-form'

// Unified Radix UI primitives and form theme
import {
  Checkbox,
  Label,
  SelectPrimitive,
  SliderPrimitive,
  SwitchPrimitive,
  formPrimitiveTheme,
} from '@/components/ui/formPrimitives'
import { ChevronDown, Check } from 'lucide-react'

// Tailwind Merge
import { clsxm } from '@/lib/tailwind-merge'

// ============================================================
// 字段组件映射
// ============================================================

interface FieldRendererProps {
  field: Field
  control: Control<FieldValues>
  variant?: FormFieldVariant
  size?: FormFieldSize
  disabled?: boolean
  error?: string
}

// 输入字段
const InputFieldRenderer: React.FC<FieldRendererProps & { inputType?: string }> = ({
  field,
  variant = 'outline',
  size = 'md',
  disabled,
  error,
}) => {
  const inputField = field as InputField

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  }

  const variantClasses = {
    default: 'bg-transparent border border-gray-300 focus:border-blue-500',
    filled: 'bg-gray-100 border border-transparent focus:bg-gray-50 focus:border-blue-500',
    outline: 'bg-transparent border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  }

  const baseInputClass = clsxm(
    'w-full px-3 rounded-lg transition-colors focus:outline-none',
    sizeClasses[size],
    variantClasses[variant],
    error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
    disabled && 'opacity-50 cursor-not-allowed bg-gray-100'
  )

  return (
    <div className="space-y-1.5">
      {field.label && (
        <Label.Root className={formPrimitiveTheme.label} htmlFor={field.name}>
          {field.label}
          {field.required && <span className={formPrimitiveTheme.required}>*</span>}
        </Label.Root>
      )}
      {field.description && (
        <p className={formPrimitiveTheme.description}>{field.description}</p>
      )}
      <input
        id={field.name}
        type={inputField.options?.inputType ?? 'text'}
        placeholder={field.placeholder}
        disabled={disabled || field.disabled}
        className={baseInputClass}
      />
      {error && <p className={formPrimitiveTheme.error}>{error}</p>}
    </div>
  )
}

// 文本域
const TextareaFieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  variant = 'outline',
  size = 'md',
  disabled,
  error,
}) => {
  const textareaField = field as { options?: { rows?: number; maxLength?: number; showCount?: boolean } }

  const sizeClasses = {
    sm: 'min-h-[80px]',
    md: 'min-h-[120px]',
    lg: 'min-h-[160px]',
  }

  const variantClasses = {
    default: 'bg-transparent border border-gray-300 focus:border-blue-500',
    filled: 'bg-gray-100 border border-transparent focus:bg-gray-50 focus:border-blue-500',
    outline: 'bg-transparent border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  }

  return (
    <div className="space-y-1.5">
      {field.label && (
        <Label.Root className={formPrimitiveTheme.label} htmlFor={field.name}>
          {field.label}
          {field.required && <span className={formPrimitiveTheme.required}>*</span>}
        </Label.Root>
      )}
      {field.description && (
        <p className={formPrimitiveTheme.description}>{field.description}</p>
      )}
      <div className="relative">
        <textarea
          id={field.name}
          rows={textareaField.options?.rows ?? 4}
          maxLength={textareaField.options?.maxLength}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled}
          className={clsxm(
            'w-full px-3 py-2 rounded-lg transition-colors focus:outline-none resize-y',
            sizeClasses[size],
            variantClasses[variant],
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-100'
          )}
        />
        {textareaField.options?.showCount && textareaField.options?.maxLength && (
          <span className="absolute bottom-2 right-2 text-xs text-gray-400">
            {textareaField.options.maxLength}
          </span>
        )}
      </div>
      {error && <p className={formPrimitiveTheme.error}>{error}</p>}
    </div>
  )
}

// 选择字段
const SelectFieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  control,
  variant = 'outline',
  size = 'md',
  disabled,
  error,
}) => {
  const selectField = field as SelectField
  const options = selectField.options?.options ?? []

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  }

  return (
    <div className="space-y-1.5">
      {field.label && (
        <Label.Root className={formPrimitiveTheme.label} htmlFor={field.name}>
          {field.label}
          {field.required && <span className={formPrimitiveTheme.required}>*</span>}
        </Label.Root>
      )}
      {field.description && (
        <p className={formPrimitiveTheme.description}>{field.description}</p>
      )}
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <SelectPrimitive.Root
            value={controllerField.value as string}
            onValueChange={controllerField.onChange}
            disabled={disabled || field.disabled}
          >
            <SelectPrimitive.Trigger
              className={clsxm(
                'flex items-center justify-between w-full px-3 rounded-lg border transition-colors focus:outline-none focus:ring-2',
                sizeClasses[size],
                variant === 'outline' ? 'border-gray-300 bg-transparent' : 'border-transparent bg-gray-100',
                error && 'border-red-500',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <SelectPrimitive.Value placeholder={field.placeholder ?? 'Select...'} />
              <SelectPrimitive.Icon>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>

            <SelectPrimitive.Portal>
              <SelectPrimitive.Content className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                <SelectPrimitive.Viewport className="p-1">
                  {options.map((option) => (
                    <SelectPrimitive.Item
                      key={String(option.value)}
                      value={String(option.value)}
                      disabled={option.disabled}
                      className={clsxm(
                        'flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer outline-none',
                        'data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700',
                        'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed'
                      )}
                    >
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator>
                        <Check className="w-4 h-4" />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Viewport>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
        )}
      />
      {error && <p className={formPrimitiveTheme.error}>{error}</p>}
    </div>
  )
}

// 复选框
const CheckboxFieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  control,
  disabled,
  error,
}) => {
  return (
    <div className="space-y-1.5">
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              id={field.name}
              checked={controllerField.value as boolean}
              onCheckedChange={controllerField.onChange}
              disabled={disabled || field.disabled}
              className={clsxm(
                'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600',
                'data-[state=unchecked]:border-gray-300',
                error && 'border-red-500',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Check className="w-3.5 h-3.5 text-white" />
            </Checkbox>
            <div className="flex flex-col">
              <Label.Root className="text-sm font-medium text-gray-700 cursor-pointer" htmlFor={field.name}>
                {field.label}
                {field.required && <span className={formPrimitiveTheme.required}>*</span>}
              </Label.Root>
              {field.description && (
                <p className={formPrimitiveTheme.description}>{field.description}</p>
              )}
            </div>
          </label>
        )}
      />
      {error && <p className="text-xs text-red-500 ml-8">{error}</p>}
    </div>
  )
}

// 单选组
const RadioGroupFieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  control,
  variant = 'outline',
  size = 'md',
  disabled,
  error,
}) => {
  const radioField = field as RadioGroupField
  const options = radioField.options?.options ?? []
  const direction = radioField.options?.direction ?? 'vertical'

  return (
    <div className="space-y-1.5">
      {field.label && (
        <Label.Root className={formPrimitiveTheme.label}>
          {field.label}
          {field.required && <span className={formPrimitiveTheme.required}>*</span>}
        </Label.Root>
      )}
      {field.description && (
        <p className={formPrimitiveTheme.description}>{field.description}</p>
      )}
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <div className={clsxm(
            'flex gap-4',
            direction === 'vertical' && 'flex-col'
          )}>
            {options.map((option) => (
              <label
                key={String(option.value)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <div
                  className={clsxm(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    controllerField.value === option.value
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-300',
                    error && 'border-red-500',
                    (disabled || option.disabled) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {controllerField.value === option.value && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <input
                  type="radio"
                  value={String(option.value)}
                  checked={controllerField.value === option.value}
                  onChange={() => controllerField.onChange(option.value)}
                  disabled={disabled || field.disabled || option.disabled}
                  className="sr-only"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700">{option.label}</span>
                  {option.description && (
                    <span className={formPrimitiveTheme.description}>{option.description}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      />
      {error && <p className={formPrimitiveTheme.error}>{error}</p>}
    </div>
  )
}

// 开关
const SwitchFieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  control,
  disabled,
  error,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        {field.label && (
          <Label.Root className={formPrimitiveTheme.label}>
            {field.label}
            {field.required && <span className={formPrimitiveTheme.required}>*</span>}
          </Label.Root>
        )}
        {field.description && (
          <p className={formPrimitiveTheme.description}>{field.description}</p>
        )}
      </div>
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <SwitchPrimitive.Root
            checked={controllerField.value as boolean}
            onCheckedChange={controllerField.onChange}
            disabled={disabled || field.disabled}
            className={clsxm(
              'group relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              controllerField.value ? 'bg-blue-600' : 'bg-gray-200',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <SwitchPrimitive.Thumb
              className={clsxm(
                'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform',
                'group-data-[state=checked]:translate-x-6',
                'group-data-[state=unchecked]:translate-x-1'
              )}
            />
          </SwitchPrimitive.Root>
        )}
      />
    </div>
  )
}

// 滑块
const SliderFieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  control,
  disabled,
  error,
}) => {
  const options = field.options as { min?: number; max?: number; step?: number } | undefined

  return (
    <div className="space-y-1.5">
      {field.label && (
        <Label.Root className={formPrimitiveTheme.label}>
          {field.label}
          {field.required && <span className={formPrimitiveTheme.required}>*</span>}
        </Label.Root>
      )}
      {field.description && (
        <p className={formPrimitiveTheme.description}>{field.description}</p>
      )}
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <SliderPrimitive.Root
            value={[controllerField.value as number ?? options?.min ?? 0]}
            onValueChange={([value]) => controllerField.onChange(value)}
            min={options?.min ?? 0}
            max={options?.max ?? 100}
            step={options?.step ?? 1}
            disabled={disabled || field.disabled}
            className={clsxm(
              'relative flex items-center select-none touch-none w-full h-6',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <SliderPrimitive.Track className="bg-gray-200 relative grow rounded-full h-2">
              <SliderPrimitive.Range className="absolute bg-blue-600 rounded-full h-full" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className="block w-5 h-5 bg-white border-2 border-blue-600 rounded-full hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            />
          </SliderPrimitive.Root>
        )}
      />
      {error && <p className={formPrimitiveTheme.error}>{error}</p>}
    </div>
  )
}

// 文件上传
const FileUploadFieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  control,
  variant = 'outline',
  disabled,
  error,
}) => {
  const options = field.options as { accept?: string; multiple?: boolean } | undefined

  return (
    <div className="space-y-1.5">
      {field.label && (
        <Label.Root className={formPrimitiveTheme.label}>
          {field.label}
          {field.required && <span className={formPrimitiveTheme.required}>*</span>}
        </Label.Root>
      )}
      {field.description && (
        <p className={formPrimitiveTheme.description}>{field.description}</p>
      )}
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField }) => (
          <div
            className={clsxm(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              variant === 'outline' ? 'border-gray-300 bg-transparent' : 'border-gray-200 bg-gray-50',
              'hover:border-blue-500 hover:bg-blue-50',
              error && 'border-red-500',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="file"
              accept={options?.accept}
              multiple={options?.multiple}
              disabled={disabled || field.disabled}
              onChange={(e) => {
                const files = e.target.files
                controllerField.onChange(options?.multiple ? files : files?.[0])
              }}
              className="hidden"
              id={`file-${field.name}`}
            />
            <label
              htmlFor={`file-${field.name}`}
              className="cursor-pointer"
            >
              <div className="text-gray-500 text-sm">
                <span className="text-blue-600 font-medium">Click to upload</span>
                {' '}or drag and drop
              </div>
              {options?.accept && (
                <p className="text-xs text-gray-400 mt-1">{options.accept}</p>
              )}
            </label>
            {controllerField.value && (
              <p className="text-xs text-gray-600 mt-2">
                {options?.multiple
                  ? `${(controllerField.value as FileList).length} files selected`
                  : (controllerField.value as File)?.name
                }
              </p>
            )}
          </div>
        )}
      />
      {error && <p className={formPrimitiveTheme.error}>{error}</p>}
    </div>
  )
}

// 字段渲染映射
const FIELD_RENDERERS: Record<string, React.FC<FieldRendererProps>> = {
  [FieldTypes.INPUT]: InputFieldRenderer,
  [FieldTypes.TEXTAREA]: TextareaFieldRenderer,
  [FieldTypes.SELECT]: SelectFieldRenderer,
  [FieldTypes.CHECKBOX]: CheckboxFieldRenderer,
  [FieldTypes.RADIO_GROUP]: RadioGroupFieldRenderer,
  [FieldTypes.SWITCH]: SwitchFieldRenderer,
  [FieldTypes.SLIDER]: SliderFieldRenderer,
  [FieldTypes.FILE_UPLOAD]: FileUploadFieldRenderer,
  [FieldTypes.DATE_PICKER]: InputFieldRenderer, // 简化实现，可扩展
}

// ============================================================
// FormRenderer Props
// ============================================================

export interface FormRendererProps<T extends Record<string, unknown>> {
  /** 表单 Schema */
  schema: FormSchema
  /** 默认值 */
  defaultValues?: Partial<T>
  /** 提交处理函数 */
  onSubmit: (data: T) => void | Promise<void>
  /** 提交中处理函数 */
  onSubmitting?: () => void
  /** 错误处理函数 */
  onError?: (errors: unknown) => void
  /** 表单变体 */
  variant?: FormFieldVariant
  /** 表单尺寸 */
  size?: FormFieldSize
  /** 提交按钮文本 */
  submitText?: string
  /** 提交中按钮文本 */
  submittingText?: string
  /** 是否禁用表单 */
  disabled?: boolean
  /** 是否只读模式 */
  readOnly?: boolean
  /** 自定义类名 */
  className?: string
}

// ============================================================
// FormRenderer 组件
// ============================================================

export function FormRenderer<T extends Record<string, unknown>>({
  schema,
  defaultValues,
  onSubmit,
  onSubmitting,
  onError,
  variant = 'outline',
  size = 'md',
  submitText,
  submittingText,
  disabled,
  readOnly,
  className = '',
}: FormRendererProps<T>) {
  // 表单配置
  const {
    register,
    control,
    handleSubmit,
    formState,
    reset,
  } = useForm<T>({
    defaultValues: defaultValues as DefaultValues<T>,
    mode: 'onBlur',
  })

  // 处理提交
  const handleFormSubmit = useCallback(
    async (data: T) => {
      try {
        onSubmitting?.()
        await onSubmit(data)
      } catch (error) {
        onError?.(error)
      }
    },
    [onSubmit, onSubmitting, onError]
  )

  // 处理提交错误
  const handleFormError = useCallback<SubmitErrorHandler<T>>(
    (errors) => {
      onError?.(errors)
    },
    [onError]
  )

  // 渲染字段
  const renderField = (field: Field) => {
    const FieldRenderer = FIELD_RENDERERS[field.type]
    if (!FieldRenderer) return null

    return (
      <FieldRenderer
        key={field.id}
        field={field}
        control={control as Control<FieldValues>}
        variant={variant}
        size={size}
        disabled={disabled || readOnly}
        error={formState.errors[field.name]?.message as string}
      />
    )
  }

  // 布局计算
  const layout = schema.layout ?? { columns: 1, gap: 'md' }
  const gridClass = layout.columns > 1
    ? `grid grid-cols-1 md:grid-cols-${layout.columns} gap-${layout.gap ?? 'md'}`
    : 'flex flex-col gap-6'

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit, handleFormError)}
      className={`space-y-6 ${className}`}
      noValidate
    >
      {/* 表单描述 */}
      {schema.description && (
        <p className="text-sm text-gray-600">{schema.description}</p>
      )}

      {/* 字段列表 */}
      <div className={gridClass}>
        {schema.fields.map(renderField)}
      </div>

      {/* 提交按钮 */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          disabled={disabled || formState.isSubmitting}
        >
          重置
        </button>
        <button
          type="submit"
          disabled={disabled || readOnly || formState.isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {formState.isSubmitting
            ? (submittingText ?? schema.submit?.loadingText ?? '提交中...')
            : (submitText ?? schema.submit?.text ?? '提交')
          }
        </button>
      </div>
    </form>
  )
}

export default FormRenderer

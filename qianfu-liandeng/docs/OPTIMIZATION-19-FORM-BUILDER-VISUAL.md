# 优化项 19: 表单生成器 - 可视化

## 问题分析

当前项目已有：
- ✅ 表单类型定义 (`src/forms/types.ts`)
- ✅ 高性能表单 Hook (`src/forms/use-performance-form.ts`)

缺失：
- ❌ 可视化表单生成器组件
- ❌ JSON Schema 驱动的动态表单渲染
- ❌ 表单设计器（拖拽排序等）

## 优化方案

### 1. 整体架构

```
src/forms/
├── types.ts                    # 已有：类型定义
├── use-performance-form.ts     # 已有：高性能 Hook
├── schema.ts                  # 新增：表单 Schema 定义
├── FormRenderer.tsx           # 新增：Schema → React 表单
├── FormBuilder.tsx            # 新增：可视化表单设计器
├── FormPreview.tsx            # 新增：表单预览
├── fields/                    # 新增：字段组件
│   ├── index.ts
│   ├── FormInput.tsx
│   ├── FormTextarea.tsx
│   ├── FormSelect.tsx
│   ├── FormCheckbox.tsx
│   ├── FormRadioGroup.tsx
│   ├── FormSwitch.tsx
│   ├── FormDatePicker.tsx
│   ├── FormSlider.tsx
│   └── FormFileUpload.tsx
└── builder/                   # 新增：设计器模块
    ├── index.ts
    ├── DraggableField.tsx
    ├── FieldPalette.tsx
    ├── FieldProperties.tsx
    ├── FormCanvas.tsx
    └── BuilderToolbar.tsx
```

### 2. 表单 Schema 定义

**src/forms/schema.ts**

```typescript
import { z } from 'zod'

// ============================================================
// 字段类型枚举
// ============================================================

export const FieldTypes = {
  INPUT: 'input',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  RADIO_GROUP: 'radioGroup',
  SWITCH: 'switch',
  DATE_PICKER: 'datePicker',
  SLIDER: 'slider',
  FILE_UPLOAD: 'fileUpload',
} as const

export type FieldType = (typeof FieldTypes)[keyof typeof FieldTypes]

// ============================================================
// 基础字段 Schema
// ============================================================

export const BaseFieldSchema = z.object({
  /** 字段唯一 ID */
  id: z.string().uuid(),
  /** 字段类型 */
  type: z.enum([
    FieldTypes.INPUT,
    FieldTypes.TEXTAREA,
    FieldTypes.SELECT,
    FieldTypes.CHECKBOX,
    FieldTypes.RADIO_GROUP,
    FieldTypes.SWITCH,
    FieldTypes.DATE_PICKER,
    FieldTypes.SLIDER,
    FieldTypes.FILE_UPLOAD,
  ]),
  /** 字段名称 */
  name: z.string().min(1).max(50),
  /** 标签 */
  label: z.string().min(1).max(100),
  /** 占位符 */
  placeholder: z.string().max(200).optional(),
  /** 描述 */
  description: z.string().max(500).optional(),
  /** 默认值 */
  defaultValue: z.unknown().optional(),
  /** 是否禁用 */
  disabled: z.boolean().optional(),
  /** 是否必填 */
  required: z.boolean().optional(),
  /** 验证规则 */
  rules: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.object({
      value: z.string(),
      message: z.string(),
    }).optional(),
    validate: z.record(z.string()).optional(),
  }).optional(),
})

// ============================================================
// 特定字段类型 Schema
// ============================================================

export const InputFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.INPUT),
  options: z.object({
    inputType: z.enum(['text', 'email', 'password', 'number', 'tel', 'url', 'search']).optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    leftIcon: z.string().optional(),
    rightIcon: z.string().optional(),
    autoComplete: z.string().optional(),
  }).optional(),
})

export const TextareaFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.TEXTAREA),
  options: z.object({
    rows: z.number().min(1).max(20).optional(),
    maxLength: z.number().optional(),
    showCount: z.boolean().optional(),
    resize: z.enum(['none', 'vertical', 'horizontal']).optional(),
    autoSize: z.boolean().optional(),
  }).optional(),
})

export const SelectFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.SELECT),
  options: z.object({
    options: z.array(z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      disabled: z.boolean().optional(),
    })),
    multiple: z.boolean().optional(),
    searchable: z.boolean().optional(),
    clearable: z.boolean().optional(),
    emptyText: z.string().optional(),
  }),
})

export const CheckboxFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.CHECKBOX),
  options: z.object({
    value: z.union([z.string(), z.number()]).optional(),
    indeterminate: z.boolean().optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
  }).optional(),
})

export const RadioGroupFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.RADIO_GROUP),
  options: z.object({
    options: z.array(z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      disabled: z.boolean().optional(),
      description: z.string().optional(),
    })),
    direction: z.enum(['vertical', 'horizontal']).optional(),
  }),
})

export const SwitchFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.SWITCH),
  options: z.object({
    size: z.enum(['sm', 'md', 'lg']).optional(),
  }).optional(),
})

export const DatePickerFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.DATE_PICKER),
  options: z.object({
    mode: z.enum(['date', 'datetime', 'time', 'range']).optional(),
    format: z.string().optional(),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
  }).optional(),
})

export const SliderFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.SLIDER),
  options: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    range: z.boolean().optional(),
  }).optional(),
})

export const FileUploadFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.FILE_UPLOAD),
  options: z.object({
    accept: z.string().optional(),
    maxSize: z.number().optional(), // bytes
    multiple: z.boolean().optional(),
    dropzone: z.boolean().optional(),
  }).optional(),
})

// ============================================================
// 联合字段 Schema
// ============================================================

export const FieldSchema = z.discriminatedUnion('type', [
  InputFieldSchema,
  TextareaFieldSchema,
  SelectFieldSchema,
  CheckboxFieldSchema,
  RadioGroupFieldSchema,
  SwitchFieldSchema,
  DatePickerFieldSchema,
  SliderFieldSchema,
  FileUploadFieldSchema,
])

// ============================================================
// 表单 Schema
// ============================================================

export const FormSchemaSchema = z.object({
  /** 表单 ID */
  id: z.string().uuid(),
  /** 表单名称 */
  name: z.string().min(1).max(100),
  /** 表单描述 */
  description: z.string().max(500).optional(),
  /** 字段列表 */
  fields: z.array(FieldSchema),
  /** 布局 */
  layout: z.object({
    columns: z.number().min(1).max(4).optional(),
    gap: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  }).optional(),
  /** 提交配置 */
  submit: z.object({
    text: z.string().optional(),
    loadingText: z.string().optional(),
  }).optional(),
})

// ============================================================
// 类型导出
// ============================================================

export type BaseField = z.infer<typeof BaseFieldSchema>
export type InputField = z.infer<typeof InputFieldSchema>
export type TextareaField = z.infer<typeof TextareaFieldSchema>
export type SelectField = z.infer<typeof SelectFieldSchema>
export type CheckboxField = z.infer<typeof CheckboxFieldSchema>
export type RadioGroupField = z.infer<typeof RadioGroupFieldSchema>
export type SwitchField = z.infer<typeof SwitchFieldSchema>
export type DatePickerField = z.infer<typeof DatePickerFieldSchema>
export type SliderField = z.infer<typeof SliderFieldSchema>
export type FileUploadField = z.infer<typeof FileUploadFieldSchema>
export type Field = z.infer<typeof FieldSchema>
export type FormSchema = z.infer<typeof FormSchemaSchema>
```

### 3. 表单渲染器组件

**src/forms/FormRenderer.tsx**

```tsx
import React, { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { FormSchema as FormSchemaType, Field } from './schema'
import { FormSchemaSchema } from './schema'
import type { FormFieldVariant, FormFieldSize } from './types'

// 字段组件导入
import FormInput from './fields/FormInput'
import FormTextarea from './fields/FormTextarea'
import FormSelect from './fields/FormSelect'
import FormCheckbox from './fields/FormCheckbox'
import FormRadioGroup from './fields/FormRadioGroup'
import FormSwitch from './fields/FormSwitch'
import FormDatePicker from './fields/FormDatePicker'
import FormSlider from './fields/FormSlider'
import FormFileUpload from './fields/FormFileUpload'
import { FieldTypes } from './schema'

// ============================================================
// 字段组件映射
// ============================================================

const FIELD_COMPONENTS = {
  [FieldTypes.INPUT]: FormInput,
  [FieldTypes.TEXTAREA]: FormTextarea,
  [FieldTypes.SELECT]: FormSelect,
  [FieldTypes.CHECKBOX]: FormCheckbox,
  [FieldTypes.RADIO_GROUP]: FormRadioGroup,
  [FieldTypes.SWITCH]: FormSwitch,
  [FieldTypes.DATE_PICKER]: FormDatePicker,
  [FieldTypes.SLIDER]: FormSlider,
  [FieldTypes.FILE_UPLOAD]: FormFileUpload,
}

// ============================================================
// Props 定义
// ============================================================

export interface FormRendererProps<T extends Record<string, unknown>> {
  /** 表单 Schema */
  schema: FormSchemaType
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
  /** 提交按钮位置 */
  submitPosition?: 'start' | 'end' | 'both'
}

// ============================================================
// 主组件
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
  submitPosition = 'end',
}: FormRendererProps<T>) {
  // 验证 Schema
  const validatedSchema = useMemo(() => {
    const result = FormSchemaSchema.safeParse(schema)
    if (!result.success) {
      console.error('Invalid form schema:', result.error)
      return null
    }
    return result.data
  }, [schema])

  // 表单配置
  const { register, control, handleSubmit, formState, setValue, watch } = useForm<T>({
    defaultValues: defaultValues as T,
    resolver: zodResolver(FormSchemaSchema),
    mode: 'onBlur',
  })

  // 处理提交
  const onFormSubmit = handleSubmit(
    async (data) => {
      try {
        onSubmitting?.()
        await onSubmit(data)
      } catch (error) {
        onError?.(error)
      }
    },
    (errors) => {
      onError?.(errors)
    }
  )

  // 渲染字段
  const renderField = (field: Field) => {
    const FieldComponent = FIELD_COMPONENTS[field.type as keyof typeof FIELD_COMPONENTS]
    if (!FieldComponent) return null

    // 转换为字段组件 props
    const fieldProps = {
      name: field.name,
      label: field.label,
      placeholder: field.placeholder,
      description: field.description,
      disabled: disabled || readOnly || field.disabled,
      readOnly,
      variant,
      size,
      required: field.required,
      defaultValue: field.defaultValue,
      options: (field as { options?: unknown }).options,
      register,
      control,
      setValue,
      watch,
      error: formState.errors[field.name as keyof typeof formState.errors],
    }

    return <FieldComponent key={field.id} {...fieldProps} />
  }

  // 布局计算
  const layout = validatedSchema?.layout ?? { columns: 1, gap: 'md' }
  const gridClass = layout.columns > 1
    ? `grid grid-cols-1 md:grid-cols-${layout.columns} gap-${layout.gap ?? 'md'}`
    : 'flex flex-col gap-4'

  if (!validatedSchema) {
    return <div className="text-red-500">Invalid form schema</div>
  }

  return (
    <form
      onSubmit={onFormSubmit}
      className={`space-y-6 ${className}`}
      noValidate
    >
      {/* 表单描述 */}
      {validatedSchema.description && (
        <p className="text-sm text-gray-600 mb-4">
          {validatedSchema.description}
        </p>
      )}

      {/* 字段列表 */}
      <div className={gridClass}>
        {validatedSchema.fields.map(renderField)}
      </div>

      {/* 提交按钮 */}
      <div className={`flex gap-3 ${submitPosition === 'end' ? 'justify-end' : submitPosition === 'start' ? 'justify-start' : 'justify-between'}`}>
        {submitPosition === 'both' && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              // 重置表单
            }}
          >
            重置
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || formState.isSubmitting}
          className="btn btn-primary"
        >
          {formState.isSubmitting
            ? (submittingText ?? validatedSchema.submit?.loadingText ?? '提交中...')
            : (submitText ?? validatedSchema.submit?.text ?? '提交')
          }
        </button>
      </div>
    </form>
  )
}

export default FormRenderer
```

### 4. 可视化表单设计器

**src/forms/FormBuilder.tsx**

```tsx
import React, { useState, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { FormSchema as FormSchemaType, Field } from './schema'
import { FieldTypes } from './schema'
import FieldPalette from './builder/FieldPalette'
import FormCanvas from './builder/FormCanvas'
import FieldProperties from './builder/FieldProperties'
import BuilderToolbar from './builder/BuilderToolbar'

// ============================================================
// Props 定义
// ============================================================

export interface FormBuilderProps {
  /** 表单 Schema */
  schema?: Partial<FormSchemaType>
  /** Schema 变更回调 */
  onChange?: (schema: FormSchemaType) => void
  /** 保存回调 */
  onSave?: (schema: FormSchemaType) => void
  /** 预览回调 */
  onPreview?: (schema: FormSchemaType) => void
  /** 初始化 Schema */
  initialSchema?: FormSchemaType
  /** 是否只读 */
  readOnly?: boolean
}

// ============================================================
// 状态类型
// ============================================================

interface BuilderState {
  schema: FormSchemaType
  selectedFieldId: string | null
  isDragging: boolean
  previewMode: boolean
}

// ============================================================
// 主组件
// ============================================================

export function FormBuilder({
  schema,
  onChange,
  onSave,
  onPreview,
  initialSchema,
  readOnly = false,
}: FormBuilderProps) {
  // 状态
  const [state, setState] = useState<BuilderState>(() => ({
    schema: initialSchema ?? createEmptySchema(),
    selectedFieldId: null,
    isDragging: false,
    previewMode: false,
  }))

  // DnD 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 创建空 Schema
  const createEmptySchema = (): FormSchemaType => ({
    id: crypto.randomUUID(),
    name: 'Untitled Form',
    description: '',
    fields: [],
    layout: { columns: 1, gap: 'md' },
    submit: { text: 'Submit', loadingText: 'Submitting...' },
  })

  // 更新 Schema
  const updateSchema = useCallback((updater: (prev: FormSchemaType) => FormSchemaType) => {
    setState(prev => {
      const newSchema = updater(prev.schema)
      onChange?.(newSchema)
      return { ...prev, schema: newSchema }
    })
  }, [onChange])

  // 添加字段
  const addField = useCallback((type: Field['type'], afterId?: string) => {
    const newField = createField(type)

    updateSchema(prev => ({
      ...prev,
      fields: afterId
        ? insertAfter(prev.fields, afterId, newField)
        : [...prev.fields, newField],
    }))

    setState(prev => ({ ...prev, selectedFieldId: newField.id }))
  }, [updateSchema])

  // 删除字段
  const removeField = useCallback((id: string) => {
    updateSchema(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id),
    }))

    setState(prev => ({
      ...prev,
      selectedFieldId: prev.selectedFieldId === id ? null : prev.selectedFieldId,
    }))
  }, [updateSchema])

  // 更新字段
  const updateField = useCallback((id: string, updates: Partial<Field>) => {
    updateSchema(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f),
    }))
  }, [updateSchema])

  // 拖拽排序
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      updateSchema(prev => {
        const oldIndex = prev.fields.findIndex(f => f.id === active.id)
        const newIndex = prev.fields.findIndex(f => f.id === over.id)
        return {
          ...prev,
          fields: arrayMove(prev.fields, oldIndex, newIndex),
        }
      })
    }
  }, [updateSchema])

  // 创建字段
  const createField = (type: Field['type']): Field => {
    const baseField = {
      id: crypto.randomUUID(),
      type,
      name: `field_${Date.now()}`,
      label: getDefaultLabel(type),
      required: false,
    }

    switch (type) {
      case FieldTypes.SELECT:
        return {
          ...baseField,
          type: FieldTypes.SELECT,
          options: {
            options: [
              { label: 'Option 1', value: 'option1' },
              { label: 'Option 2', value: 'option2' },
            ],
          },
        }
      case FieldTypes.RADIO_GROUP:
        return {
          ...baseField,
          type: FieldTypes.RADIO_GROUP,
          options: {
            options: [
              { label: 'Option 1', value: 'option1' },
              { label: 'Option 2', value: 'option2' },
            ],
          },
        }
      case FieldTypes.SLIDER:
        return {
          ...baseField,
          type: FieldTypes.SLIDER,
          options: { min: 0, max: 100, step: 1 },
        }
      default:
        return baseField as Field
    }
  }

  // 获取默认标签
  const getDefaultLabel = (type: Field['type']): string => {
    const labels: Record<Field['type'], string> = {
      [FieldTypes.INPUT]: 'Text Input',
      [FieldTypes.TEXTAREA]: 'Text Area',
      [FieldTypes.SELECT]: 'Select',
      [FieldTypes.CHECKBOX]: 'Checkbox',
      [FieldTypes.RADIO_GROUP]: 'Radio Group',
      [FieldTypes.SWITCH]: 'Switch',
      [FieldTypes.DATE_PICKER]: 'Date Picker',
      [FieldTypes.SLIDER]: 'Slider',
      [FieldTypes.FILE_UPLOAD]: 'File Upload',
    }
    return labels[type] ?? 'Field'
  }

  // 插入字段
  const insertAfter = <T,>(arr: T[], afterId: string, item: T): T[] => {
    const index = arr.findIndex(f => (f as { id: string }).id === afterId)
    return [...arr.slice(0, index + 1), item, ...arr.slice(index + 1)]
  }

  // 选中字段
  const selectedField = state.schema.fields.find(f => f.id === state.selectedFieldId)

  // 预览模式
  if (state.previewMode) {
    return (
      <div className="p-6">
        <FormPreview
          schema={state.schema}
          onBack={() => setState(prev => ({ ...prev, previewMode: false }))}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* 左侧：字段面板 */}
      <FieldPalette onAddField={addField} disabled={readOnly} />

      {/* 中间：画布 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 p-6 overflow-auto">
          <FormCanvas
            fields={state.schema.fields}
            selectedFieldId={state.selectedFieldId}
            onSelectField={(id) => setState(prev => ({ ...prev, selectedFieldId: id }))}
            onRemoveField={removeField}
            disabled={readOnly}
          />
        </div>
      </DndContext>

      {/* 右侧：属性面板 */}
      <FieldProperties
        field={selectedField}
        onUpdate={(updates) => {
          if (selectedField) {
            updateField(selectedField.id, updates)
          }
        }}
        disabled={readOnly}
      />

      {/* 工具栏 */}
      <BuilderToolbar
        schema={state.schema}
        onSave={() => onSave?.(state.schema)}
        onPreview={() => setState(prev => ({ ...prev, previewMode: true }))}
        onSchemaNameChange={(name) => updateSchema(prev => ({ ...prev, name }))}
      />
    </div>
  )
}

export default FormBuilder
```

### 5. 设计器子组件

**src/forms/builder/FieldPalette.tsx**

```tsx
import React from 'react'
import { FieldTypes } from '../schema'

interface FieldPaletteProps {
  onAddField: (type: Field['type']) => void
  disabled?: boolean
}

const FIELD_ITEMS = [
  { type: FieldTypes.INPUT, label: 'Text Input', icon: 'type' },
  { type: FieldTypes.TEXTAREA, label: 'Text Area', icon: 'align-left' },
  { type: FieldTypes.SELECT, label: 'Dropdown', icon: 'chevron-down' },
  { type: FieldTypes.CHECKBOX, label: 'Checkbox', icon: 'check-square' },
  { type: FieldTypes.RADIO_GROUP, label: 'Radio', icon: 'circle' },
  { type: FieldTypes.SWITCH, label: 'Toggle', icon: 'toggle-right' },
  { type: FieldTypes.DATE_PICKER, label: 'Date', icon: 'calendar' },
  { type: FieldTypes.SLIDER, label: 'Slider', icon: 'sliders' },
  { type: FieldTypes.FILE_UPLOAD, label: 'Upload', icon: 'upload' },
]

export function FieldPalette({ onAddField, disabled }: FieldPaletteProps) {
  return (
    <div className="w-64 border-r bg-gray-50 p-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-4">Form Fields</h3>
      <div className="space-y-2">
        {FIELD_ITEMS.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => onAddField(type)}
            disabled={disabled}
            className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-gray-500">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FieldPalette
```

**src/forms/builder/FormCanvas.tsx**

```tsx
import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Field } from '../schema'
import SortableField from './SortableField'

interface FormCanvasProps {
  fields: Field[]
  selectedFieldId: string | null
  onSelectField: (id: string) => void
  onRemoveField: (id: string) => void
  disabled?: boolean
}

export function FormCanvas({
  fields,
  selectedFieldId,
  onSelectField,
  onRemoveField,
  disabled,
}: FormCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[500px] bg-white rounded-xl border-2 border-dashed p-6 ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
    >
      {fields.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>Drag fields from the left panel or click to add</p>
        </div>
      ) : (
        <SortableContext
          items={fields.map(f => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {fields.map((field) => (
              <SortableField
                key={field.id}
                field={field}
                isSelected={field.id === selectedFieldId}
                onSelect={() => onSelectField(field.id)}
                onRemove={() => onRemoveField(field.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

export default FormCanvas
```

**src/forms/builder/FieldProperties.tsx**

```tsx
import React from 'react'
import type { Field } from '../schema'
import type { SelectField, RadioGroupField } from '../schema'

interface FieldPropertiesProps {
  field: Field | undefined
  onUpdate: (updates: Partial<Field>) => void
  disabled?: boolean
}

export function FieldProperties({ field, onUpdate, disabled }: FieldPropertiesProps) {
  if (!field) {
    return (
      <div className="w-72 border-l bg-gray-50 p-4">
        <p className="text-gray-500 text-sm">Select a field to edit its properties</p>
      </div>
    )
  }

  return (
    <div className="w-72 border-l bg-gray-50 p-4 overflow-auto">
      <h3 className="font-semibold text-sm text-gray-700 mb-4">Field Properties</h3>

      <div className="space-y-4">
        {/* 基础属性 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Field Name</label>
          <input
            type="text"
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
          <input
            type="text"
            value={field.placeholder ?? ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={field.description ?? ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        {/* 复选框属性 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="required"
            checked={field.required ?? false}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            disabled={disabled}
          />
          <label htmlFor="required" className="text-xs text-gray-600">Required</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="disabled"
            checked={field.disabled ?? false}
            onChange={(e) => onUpdate({ disabled: e.target.checked })}
            disabled={disabled}
          />
          <label htmlFor="disabled" className="text-xs text-gray-600">Disabled</label>
        </div>

        {/* Select/Radio 选项 */}
        {(field.type === 'select' || field.type === 'radioGroup') && (
          <OptionsEditor
            field={field as SelectField | RadioGroupField}
            onUpdate={onUpdate}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}

// 选项编辑器
function OptionsEditor({
  field,
  onUpdate,
  disabled,
}: {
  field: SelectField | RadioGroupField
  onUpdate: (updates: Partial<Field>) => void
  disabled?: boolean
}) {
  const options = field.options?.options ?? []

  const addOption = () => {
    const newOptions = [...options, { label: `Option ${options.length + 1}`, value: `option${options.length + 1}` }]
    onUpdate({ options: { ...field.options, options: newOptions } } as Partial<Field>)
  }

  const updateOption = (index: number, updates: { label?: string; value?: string; disabled?: boolean }) => {
    const newOptions = options.map((opt, i) => i === index ? { ...opt, ...updates } : opt)
    onUpdate({ options: { ...field.options, options: newOptions } } as Partial<Field>)
  }

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index)
    onUpdate({ options: { ...field.options, options: newOptions } } as Partial<Field>)
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-2">Options</label>
      <div className="space-y-2">
        {options.map((opt, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOption(index, { label: e.target.value })}
              disabled={disabled}
              className="flex-1 px-2 py-1 border rounded text-xs"
            />
            <button
              onClick={() => removeOption(index)}
              disabled={disabled || options.length <= 1}
              className="text-red-500 hover:text-red-700 disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={addOption}
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add Option
        </button>
      </div>
    </div>
  )
}

export default FieldProperties
```

### 6. 使用示例

**基础使用**

```tsx
import { FormRenderer } from './forms/FormRenderer'
import { FieldTypes } from './forms/schema'

const schema = {
  id: crypto.randomUUID(),
  name: 'Contact Form',
  description: 'Please fill out the form below',
  fields: [
    {
      id: crypto.randomUUID(),
      type: FieldTypes.INPUT,
      name: 'name',
      label: 'Full Name',
      placeholder: 'Enter your name',
      required: true,
    },
    {
      id: crypto.randomUUID(),
      type: FieldTypes.INPUT,
      name: 'email',
      label: 'Email Address',
      inputType: 'email',
      placeholder: 'your@email.com',
      required: true,
    },
    {
      id: crypto.randomUUID(),
      type: FieldTypes.SELECT,
      name: 'subject',
      label: 'Subject',
      options: {
        options: [
          { label: 'General Inquiry', value: 'general' },
          { label: 'Technical Support', value: 'support' },
          { label: 'Billing Question', value: 'billing' },
        ],
        searchable: true,
      },
    },
    {
      id: crypto.randomUUID(),
      type: FieldTypes.TEXTAREA,
      name: 'message',
      label: 'Message',
      rows: 5,
      required: true,
    },
  ],
}

function ContactForm() {
  const handleSubmit = async (data) => {
    console.log('Form submitted:', data)
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  return (
    <FormRenderer
      schema={schema}
      onSubmit={handleSubmit}
      submitText="Send Message"
      variant="outline"
    />
  )
}
```

**设计器使用**

```tsx
import { FormBuilder } from './forms/FormBuilder'

function AdminFormEditor() {
  const handleSave = (schema) => {
    // 保存到数据库
    saveFormSchema(schema)
  }

  return (
    <div className="h-[calc(100vh-64px)]">
      <FormBuilder
        onSave={handleSave}
        onPreview={(schema) => {
          // 打开预览弹窗
          openPreviewModal(schema)
        }}
      />
    </div>
  )
}
```

## 依赖安装

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## 优势

1. **类型安全** - 基于 Zod Schema 的完整类型推断
2. **性能优化** - 字段级精确渲染，避免全量重绘
3. **可视化设计** - 拖拽排序，所见即所得
4. **Schema 驱动** - 表单定义与渲染分离，灵活复用
5. **扩展性强** - 支持自定义字段组件
6. **响应式布局** - 支持多列布局配置

## 注意事项

1. **Schema 版本管理** - 考虑 Schema 迁移策略
2. **数据持久化** - Schema 存储格式选择（JSON/数据库）
3. **复杂字段** - 级联选择、动态表单项等需要扩展
4. **主题适配** - 确保与现有 UI 组件风格一致

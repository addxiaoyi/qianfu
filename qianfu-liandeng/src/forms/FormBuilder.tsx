/**
 * 表单设计器
 * 可视化拖拽式表单构建器
 * 优化项 19: 表单生成器 - 可视化
 */
import React, { useState, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FormSchema as FormSchemaType, Field } from './schema'
import { FieldTypes } from './schema'
import { GripVertical, Trash2, Eye, Save, Settings } from 'lucide-react'
import FormRenderer from './FormRenderer'

// ============================================================
// 类型定义
// ============================================================

interface FormBuilderProps {
  /** 初始 Schema */
  initialSchema?: Partial<FormSchemaType>
  /** Schema 变更回调 */
  onChange?: (schema: FormSchemaType) => void
  /** 保存回调 */
  onSave?: (schema: FormSchemaType) => void
  /** 预览回调 */
  onPreview?: (schema: FormSchemaType) => void
  /** 是否只读 */
  readOnly?: boolean
}

// ============================================================
// 状态定义
// ============================================================

interface BuilderState {
  schema: FormSchemaType
  selectedFieldId: string | null
  previewMode: boolean
}

// ============================================================
// 字段面板组件
// ============================================================

const FIELD_ITEMS = [
  { type: FieldTypes.INPUT, label: '文本输入' },
  { type: FieldTypes.TEXTAREA, label: '文本域' },
  { type: FieldTypes.SELECT, label: '下拉选择' },
  { type: FieldTypes.CHECKBOX, label: '复选框' },
  { type: FieldTypes.RADIO_GROUP, label: '单选组' },
  { type: FieldTypes.SWITCH, label: '开关' },
  { type: FieldTypes.SLIDER, label: '滑块' },
  { type: FieldTypes.DATE_PICKER, label: '日期选择' },
  { type: FieldTypes.FILE_UPLOAD, label: '文件上传' },
] as const

interface FieldPaletteProps {
  onAddField: (type: Field['type']) => void
  disabled?: boolean
}

function FieldPalette({ onAddField, disabled }: FieldPaletteProps) {
  return (
    <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-700">字段组件</h3>
        <p className="text-xs text-gray-500 mt-1">点击添加字段到画布</p>
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-auto">
        {FIELD_ITEMS.map(({ type, label }) => (
          <button
            type="button"
            key={type}
            onClick={() => onAddField(type)}
            disabled={disabled}
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">{label[0]}</span>
            </div>
            <span className="text-sm text-gray-700">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 可排序字段组件
// ============================================================

interface SortableFieldProps {
  field: Field
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  disabled?: boolean
}

function SortableField({ field, isSelected, onSelect, onRemove, disabled }: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getFieldIcon = (type: Field['type']) => {
    return FIELD_ITEMS.find(f => f.type === type)?.label ?? type[0].toUpperCase()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative bg-white rounded-lg border-2 transition-all
        ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}
        ${isDragging ? 'opacity-50 z-50' : ''}
      `}
    >
      <div className="flex items-center gap-2 p-3">
        {/* 拖拽手柄 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`拖动调整字段：${field.label}`}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing disabled:opacity-30"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* 字段选择与信息 */}
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          aria-pressed={isSelected}
          aria-label={`编辑字段：${field.label}`}
          className="min-w-0 flex flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
        >
          <span className="w-8 h-8 shrink-0 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium">
            {getFieldIcon(field.type)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-800 truncate">{field.label}</span>
              {field.required && <span className="text-red-500 text-xs">*</span>}
            </span>
            <span className="block text-xs text-gray-500 truncate">{field.name}</span>
          </span>
        </button>

        {/* 删除按钮 */}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`删除字段：${field.label}`}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 选中时显示属性预览 */}
      {isSelected && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-11 p-2 bg-gray-50 rounded text-xs text-gray-500">
            类型: {field.type} | 名称: {field.name}
            {field.placeholder && ` | 占位: ${field.placeholder}`}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 画布组件
// ============================================================

interface FormCanvasProps {
  fields: Field[]
  selectedFieldId: string | null
  onSelectField: (id: string) => void
  onRemoveField: (id: string) => void
  disabled?: boolean
}

function FormCanvas({ fields, selectedFieldId, onSelectField, onRemoveField, disabled }: FormCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 min-h-[500px] bg-gray-100 rounded-xl border-2 border-dashed p-6 overflow-auto
        ${isOver ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300'}
      `}
    >
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <div className="w-16 h-16 mb-4 rounded-full bg-gray-200 flex items-center justify-center">
            <Settings className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-sm">从左侧面板点击添加字段</p>
          <p className="text-xs mt-1">或拖拽字段到此处</p>
        </div>
      ) : (
        <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 max-w-2xl mx-auto">
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

// ============================================================
// 字段属性面板
// ============================================================

interface FieldPropertiesProps {
  field: Field | undefined
  onUpdate: (updates: Partial<Field>) => void
  disabled?: boolean
}

function FieldProperties({ field, onUpdate, disabled }: FieldPropertiesProps) {
  if (!field) {
    return (
      <div className="w-72 bg-gray-50 border-l border-gray-200 flex items-center justify-center p-6">
        <div className="text-center text-gray-500">
          <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">选择字段以编辑属性</p>
        </div>
      </div>
    )
  }

  const isSelectField = field.type === FieldTypes.SELECT || field.type === FieldTypes.RADIO_GROUP

  return (
    <div className="w-72 bg-gray-50 border-l border-gray-200 flex flex-col overflow-auto">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-700">字段属性</h3>
        <p className="text-xs text-gray-500 mt-1">编辑选中的字段</p>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* 标签 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">标签</label>
          <input
            type="text"
            aria-label="字段标签"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* 字段名 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">字段名</label>
          <input
            type="text"
            aria-label="字段名"
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* 占位符 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">占位符</label>
          <input
            type="text"
            aria-label="字段占位符"
            value={field.placeholder ?? ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">描述</label>
          <textarea
            aria-label="字段描述"
            value={field.description ?? ''}
            onChange={(e) => onUpdate({ description: e.target.value || undefined })}
            disabled={disabled}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
          />
        </div>

        {/* 复选框选项 */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required ?? false}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">必填字段</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.disabled ?? false}
              onChange={(e) => onUpdate({ disabled: e.target.checked })}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">禁用状态</span>
          </label>
        </div>

        {/* 选择/单选选项 */}
        {isSelectField && (
          <SelectOptionsEditor
            field={field}
            onUpdate={onUpdate}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}

// 选择选项编辑器
function SelectOptionsEditor({
  field,
  onUpdate,
  disabled,
}: {
  field: Field
  onUpdate: (updates: Partial<Field>) => void
  disabled?: boolean
}) {
  const options = (field.options as { options?: Array<{ label: string; value: string; disabled?: boolean }> })?.options ?? []

  const addOption = () => {
    const newOptions = [...options, { label: `选项 ${options.length + 1}`, value: `option${options.length + 1}` }]
    onUpdate({ options: { ...field.options, options: newOptions } } as Partial<Field>)
  }

  const updateOption = (index: number, updates: { label?: string; value?: string }) => {
    const newOptions = options.map((opt, i) => i === index ? { ...opt, ...updates } : opt)
    onUpdate({ options: { ...field.options, options: newOptions } } as Partial<Field>)
  }

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index)
    onUpdate({ options: { ...field.options, options: newOptions } } as Partial<Field>)
  }

  return (
    <div className="pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-600">选项</label>
        <button
          type="button"
          onClick={addOption}
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          + 添加选项
        </button>
      </div>
      <div className="space-y-2">
        {options.map((opt, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              type="text"
              aria-label={`选项 ${index + 1} 标签`}
              value={opt.label}
              onChange={(e) => updateOption(index, { label: e.target.value })}
              disabled={disabled}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="标签"
            />
            <input
              type="text"
              aria-label={`选项 ${index + 1} 值`}
              value={opt.value}
              onChange={(e) => updateOption(index, { value: e.target.value })}
              disabled={disabled}
              className="w-20 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="值"
            />
            <button
              type="button"
              onClick={() => removeOption(index)}
              disabled={disabled || options.length <= 1}
              aria-label={`删除选项 ${index + 1}`}
              className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

export function FormBuilder({
  initialSchema,
  onChange,
  onSave,
  onPreview,
  readOnly = false,
}: FormBuilderProps) {
  // 初始化 Schema
  const initial = initialSchema ?? {
    id: crypto.randomUUID(),
    name: '未命名表单',
    description: '',
    fields: [],
    layout: { columns: 1, gap: 'md' },
    submit: { text: '提交', loadingText: '提交中...' },
  }

  // 状态
  const [state, setState] = useState<BuilderState>({
    schema: initial as FormSchemaType,
    selectedFieldId: null,
    previewMode: false,
  })

  // DnD 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // 创建字段
  const createField = useCallback((type: Field['type']): Field => {
    const id = crypto.randomUUID()
    const baseField = {
      id,
      type,
      name: `field_${Date.now()}`,
      label: FIELD_ITEMS.find(f => f.type === type)?.label ?? '新字段',
      required: false,
    } as Field

    // 根据类型添加默认选项
    if (type === FieldTypes.SELECT || type === FieldTypes.RADIO_GROUP) {
      baseField.options = {
        options: [
          { label: '选项 1', value: 'option1' },
          { label: '选项 2', value: 'option2' },
        ],
      }
    }

    return baseField
  }, [])

  // 添加字段
  const addField = useCallback((type: Field['type']) => {
    const newField = createField(type)
    setState(prev => {
      const newSchema = {
        ...prev.schema,
        fields: [...prev.schema.fields, newField],
      }
      onChange?.(newSchema)
      return {
        ...prev,
        schema: newSchema,
        selectedFieldId: newField.id,
      }
    })
  }, [createField, onChange])

  // 删除字段
  const removeField = useCallback((id: string) => {
    setState(prev => {
      const newSchema = {
        ...prev.schema,
        fields: prev.schema.fields.filter(f => f.id !== id),
      }
      onChange?.(newSchema)
      return {
        ...prev,
        schema: newSchema,
        selectedFieldId: prev.selectedFieldId === id ? null : prev.selectedFieldId,
      }
    })
  }, [onChange])

  // 更新字段
  const updateField = useCallback((id: string, updates: Partial<Field>) => {
    setState(prev => {
      const nextFields: Field[] = prev.schema.fields.map(f => f.id === id ? { ...f, ...updates } as Field : f)
      const newSchema: FormSchemaType = {
        ...prev.schema,
        fields: nextFields,
      }
      onChange?.(newSchema)
      return { ...prev, schema: newSchema }
    })
  }, [onChange])

  // 拖拽排序
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setState(prev => {
      const oldIndex = prev.schema.fields.findIndex(f => f.id === active.id)
      const newIndex = prev.schema.fields.findIndex(f => f.id === over.id)
      const newSchema = {
        ...prev.schema,
        fields: arrayMove(prev.schema.fields, oldIndex, newIndex),
      }
      onChange?.(newSchema)
      return { ...prev, schema: newSchema }
    })
  }, [onChange])

  // 选中字段
  const selectedField = state.schema.fields.find(f => f.id === state.selectedFieldId)

  // 预览模式
  if (state.previewMode) {
    return (
      <div className="flex flex-col h-full bg-gray-100">
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">{state.schema.name}</h2>
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, previewMode: false }))}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            关闭预览
          </button>
        </div>
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-2xl mx-auto bg-white rounded-xl p-8 shadow-sm">
            <FormRenderer<Record<string, unknown>>
              schema={state.schema}
              onSubmit={async () => undefined}
              readOnly
              submitText="预览模式"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <input
            type="text"
            aria-label="表单名称"
            value={state.schema.name}
            onChange={(e) => {
              const newSchema = { ...state.schema, name: e.target.value }
              onChange?.(newSchema)
              setState(prev => ({ ...prev, schema: newSchema }))
            }}
            className="text-lg font-semibold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0"
            placeholder="表单名称"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, previewMode: true }))}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <Eye className="w-4 h-4" />
            预览
          </button>
          <button
            type="button"
            onClick={() => onSave?.(state.schema)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {/* 左侧：字段面板 */}
          <FieldPalette onAddField={addField} disabled={readOnly} />

          {/* 中间：画布 */}
          <FormCanvas
            fields={state.schema.fields}
            selectedFieldId={state.selectedFieldId}
            onSelectField={(id) => setState(prev => ({ ...prev, selectedFieldId: id }))}
            onRemoveField={removeField}
            disabled={readOnly}
          />
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
      </div>
    </div>
  )
}

export default FormBuilder

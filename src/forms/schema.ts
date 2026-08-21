/**
 * 表单 Schema 定义
 * 优化项 19: 表单生成器 - 可视化
 */
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
  id: z.string(),
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
  }).optional(),
})

export const CheckboxFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.CHECKBOX),
  options: z.object({
    value: z.union([z.string(), z.number()]).optional(),
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
  }).optional(),
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
    mode: z.enum(['date', 'datetime', 'time']).optional(),
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
  }).optional(),
})

export const FileUploadFieldSchema = BaseFieldSchema.extend({
  type: z.literal(FieldTypes.FILE_UPLOAD),
  options: z.object({
    accept: z.string().optional(),
    maxSize: z.number().optional(),
    multiple: z.boolean().optional(),
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
  id: z.string(),
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

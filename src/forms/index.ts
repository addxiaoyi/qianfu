/**
 * 性能表单模块
 * 优化项 16: React Hook Form - 性能表单
 * 优化项 19: 表单生成器 - 可视化
 *
 * @example
 * // 基础使用
 * import { Form, FormInput, SubmitButton } from '@/forms'
 *
 * function LoginForm() {
 *   return (
 *     <Form
 *       defaultValues={{ email: '', password: '' }}
 *       onSubmit={handleLogin}
 *     >
 *       <FormInput name="email" label="邮箱" type="email" required />
 *       <FormInput name="password" label="密码" type="password" required />
 *       <SubmitButton>登录</SubmitButton>
 *     </Form>
 *   )
 * }
 *
 * @example
 * // 可视化表单生成器 - Schema 驱动
 * import { FormRenderer, FieldTypes } from '@/forms'
 *
 * const schema = {
 *   id: 'form-1',
 *   name: 'Contact Form',
 *   fields: [
 *     { id: '1', type: FieldTypes.INPUT, name: 'name', label: 'Name', required: true },
 *     { id: '2', type: FieldTypes.INPUT, name: 'email', label: 'Email', inputType: 'email' },
 *   ]
 * }
 *
 * <FormRenderer schema={schema} onSubmit={handleSubmit} />
 */

// ============================================================
// 核心 Hooks
// ============================================================

export { usePerformanceForm, useZodForm, useSimpleForm } from './use-performance-form'

// ============================================================
// 表单组件
// ============================================================

export {
  Form,
  SubmitButton,
} from './form'

// ============================================================
// 字段组件
// ============================================================

export {
  FormInput,
  FormTextarea,
  FormSelect,
  OptimizedFormField as FormField,
  BaseFieldWrapper,
  FieldLabel,
  FieldDescription,
  Input,
  Textarea,
  Select,
} from './fields'

// ============================================================
// Schemas
// ============================================================

export * from './schemas'

// ============================================================
// 类型定义
// ============================================================

export type {
  // 表单配置
  PerformanceFormOptions,
  UsePerformanceFormReturn,
  FormSubmitState,
  // 字段配置
  FormInputProps,
  FormTextareaProps,
  FormSelectProps,
  BaseFieldProps,
  FormFieldVariant,
  FormFieldSize,
} from './types'

// ============================================================
// 开发工具
// ============================================================

export { useFormDevtools, useFormPerformance } from './devtools'

// ============================================================
// 配置
// ============================================================

export * from './config'

// ============================================================
// 优化项 19: 可视化表单生成器
// ============================================================

// Schema 类型定义
export {
  FieldTypes,
  BaseFieldSchema,
  InputFieldSchema,
  TextareaFieldSchema,
  SelectFieldSchema,
  CheckboxFieldSchema,
  RadioGroupFieldSchema,
  SwitchFieldSchema,
  DatePickerFieldSchema,
  SliderFieldSchema,
  FileUploadFieldSchema,
  FieldSchema,
  FormSchemaSchema,
} from './schema'

export type {
  BaseField,
  InputField,
  TextareaField,
  SelectField,
  CheckboxField,
  RadioGroupField,
  SwitchField,
  DatePickerField,
  SliderField,
  FileUploadField,
  Field,
  FormSchema,
} from './schema'

// 可视化组件
export { FormRenderer } from './FormRenderer'
export { FormBuilder } from './FormBuilder'

// 表单渲染器类型
export type { FormRendererProps } from './FormRenderer'

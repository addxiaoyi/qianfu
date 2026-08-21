import type { ReactNode } from 'react';
import FormRenderer from '@/forms/FormRenderer';
import type { FormSchema } from '@/forms/schema';
import type { FormFieldSize, FormFieldVariant } from '@/forms/types';

const basicSchema: FormSchema = {
  id: 'basic-form-example',
  name: '基础表单',
  fields: [
    { id: 'name', type: 'input', name: 'name', label: '名称', required: true },
    { id: 'description', type: 'textarea', name: 'description', label: '描述' },
  ],
};

const selectSchema: FormSchema = {
  id: 'validated-form-example',
  name: '验证表单',
  fields: [
    {
      id: 'email',
      type: 'input',
      name: 'email',
      label: '邮箱',
      required: true,
      options: { inputType: 'email' },
    },
    {
      id: 'category',
      type: 'select',
      name: 'category',
      label: '类型',
      options: { options: [{ label: '功能建议', value: 'feature' }, { label: '问题反馈', value: 'bug' }] },
    },
  ],
};

function ExampleFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function ExampleForm({
  schema,
  variant,
  size,
}: {
  schema: FormSchema;
  variant?: FormFieldVariant;
  size?: FormFieldSize;
}) {
  return (
    <FormRenderer<Record<string, unknown>>
      schema={schema}
      defaultValues={{}}
      onSubmit={async () => undefined}
      variant={variant}
      size={size}
    />
  );
}

export function BasicFormExample() {
  return <ExampleFrame title="基础表单"><ExampleForm schema={basicSchema} /></ExampleFrame>;
}

export function ValidatedFormExample() {
  return <ExampleFrame title="验证表单"><ExampleForm schema={selectSchema} /></ExampleFrame>;
}

export function ComplexFormExample() {
  return <ExampleFrame title="复杂表单"><ExampleForm schema={selectSchema} variant="filled" /></ExampleFrame>;
}

export function FormVariantsExample() {
  return <ExampleFrame title="字段变体"><ExampleForm schema={basicSchema} variant="outline" /></ExampleFrame>;
}

export function FormSizesExample() {
  return <ExampleFrame title="字段尺寸"><ExampleForm schema={basicSchema} size="sm" /></ExampleFrame>;
}

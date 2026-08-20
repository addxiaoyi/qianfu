# UI Snapshot Testing

**优化项 494: Snapshot Testing - UI快照**

## 概述

UI 快照测试用于捕获组件的渲染输出，确保 UI 在后续更改中保持一致性。当组件的输出发生变化时，快照测试会失败，提示开发者检查是有意更改还是意外的回归。

## 快速开始

### 运行快照测试

```bash
# 运行所有快照测试
npm run test:snapshot

# 更新快照（当组件变更是有意的时候）
npm run test:snapshot:update

# 监视模式
npm run test:snapshot:watch
```

### 运行单元测试（包含快照测试）

```bash
npm run test:unit
```

## 项目结构

```
tests/unit/src/
├── setup-snapshot.ts          # 测试环境配置
├── snapshot-testing.tsx        # 测试工具函数
├── snapshot-utils.tsx          # 工具函数导出
├── components/
│   ├── __snapshots__/
│   │   └── skeleton.snapshot.test.tsx.snap
│   └── skeleton.snapshot.test.tsx
├── pages/
│   ├── __snapshots__/
│   │   └── login.snapshot.test.tsx.snap
│   └── login.snapshot.test.tsx
└── __snapshots__/
    └── ...
```

## 测试配置

### vitest.snapshot.config.ts

快照测试专用配置：

- **环境**: `jsdom` - 支持 DOM 测试
- **超时**: 30 秒
- **包含文件**: `tests/unit/src/**/*.{test,snapshot}.{ts,tsx}`

### 测试环境设置 (setup-snapshot.ts)

- Mock framer-motion 动画
- Mock react-router-dom 路由
- Mock lucide-react 图标组件
- Mock react-hook-form
- Mock zustand store
- Mock toast 通知
- 全局视口配置 (1280x800)
- matchMedia 模拟

## 测试工具

### 渲染函数

```tsx
import { customRender } from './snapshot-testing'

// 基本用法
const { container } = customRender(<MyComponent />)
expect(container).toMatchSnapshot()

// 带路由
const { container } = customRender(<MyComponent />, {
  initialRoute: '/servers/123'
})
```

### 响应式快照

```tsx
import { responsiveSnapshots, RESPONSIVE_BREAKPOINTS } from './snapshot-testing'

responsiveSnapshots(MyPage, {
  baseProps: {},
  breakpoints: ['mobile', 'tablet', 'desktop'],
  customBreakpoints: [
    { name: 'small-tablet', width: 600, height: 900 }
  ]
})
```

### 主题快照

```tsx
import { themeSnapshots, commonThemes } from './snapshot-testing'

themeSnapshots(MyComponent, {
  variant: 'primary'
}, commonThemes)
```

### 变体快照

```tsx
import { snapshotVariants } from './snapshot-testing'

snapshotVariants('Button', Button, [
  { name: 'default', props: { children: 'Click me' } },
  { name: 'primary', props: { variant: 'primary', children: 'Submit' } },
  { name: 'disabled', props: { disabled: true, children: 'Disabled' } },
])
```

### 交互式快照

```tsx
it('Button interaction states', async () => {
  const { user, container } = customRender(<Button>Hover me</Button>)

  const results = await snapshotInteractionStates(user, container, [
    { name: 'default', action: async () => {} },
    { name: 'hover', action: async () => {
      await user.hover(container.querySelector('button')!)
    }},
    { name: 'focus', action: async () => {
      await user.tab()
    }},
  ])

  results.forEach(({ name, html }) => {
    expect(html).toMatchSnapshot(`-${name}`)
  })
})
```

## 编写新快照测试

### 1. 创建测试文件

```tsx
// tests/unit/src/components/MyComponent.snapshot.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from '@/components/MyComponent'

describe('MyComponent snapshots', () => {
  it('renders with default props', () => {
    render(<MyComponent />)
    const component = screen.getByTestId('my-component')
    expect(component).toMatchSnapshot()
  })

  it('renders with custom className', () => {
    render(<MyComponent className="custom-class" />)
    const component = screen.getByTestId('my-component')
    expect(component).toMatchSnapshot()
  })
})
```

### 2. 运行测试生成快照

```bash
npm run test:snapshot
```

### 3. 审核快照文件

检查生成的 `.snap` 文件，确保输出正确：

```snap
// tests/unit/src/components/__snapshots__/MyComponent.snapshot.test.tsx.snap
exports[`MyComponent snapshots renders with default props 1`] = `
<div
  class="my-component"
  data-testid="my-component"
>
  <span>Default</span>
</div>
`;
```

### 4. 提交快照文件

快照文件应该与测试代码一起提交到版本控制。

## 更新快照

当组件变更是有意的时候：

```bash
# 单次更新
npm run test:snapshot:update

# Vitest watch 模式中按 u 键
npm run test:snapshot:watch
```

## 最佳实践

### 1. 保持快照稳定

- 使用稳定的测试 ID 而非动态内容
- Mock 随机数据和时间戳
- 避免测试包含随机生成的类名

### 2. 组件变体测试

```tsx
snapshotVariants('FormField', FormField, [
  { name: 'text-input', props: { type: 'text' } },
  { name: 'email-input', props: { type: 'email' } },
  { name: 'password-input', props: { type: 'password' } },
])
```

### 3. 响应式测试

```tsx
describe('Responsive snapshots', () => {
  responsiveSnapshots(LoginPage, {
    breakpoints: ['mobile', 'tablet', 'desktop']
  })
})
```

### 4. 交互状态测试

```tsx
it('Button states', async () => {
  const { user, container } = customRender(<Button>Click</Button>)

  await snapshotInteractionStates(user, container, [
    { name: 'default', action: async () => {} },
    { name: 'hover', action: async () => {
      await user.hover(container.querySelector('button')!)
    }},
    { name: 'active', action: async () => {
      await user.click(container.querySelector('button')!)
    }},
    { name: 'focus', action: async () => {
      await user.tab()
    }},
  ])
})
```

## 常见问题

### 快照测试失败

1. **检查是否有意更改**：打开 `.snap` 文件对比差异
2. **更新快照**：如果更改是有意的，运行 `npm run test:snapshot:update`
3. **修复回归**：如果更改是意外的，修复代码

### 动态内容

对于随机数据或时间戳，在测试中 mock：

```tsx
vi.spyOn(Math, 'random').mockReturnValue(0.5)
```

### 动画

动画组件已被 mock，直接测试组件结构。

## 参考资源

- [Vitest 快照文档](https://vitest.dev/guide/snapshot.html)
- [Testing Library 快照](https://testing-library.com/docs/snapshot-testing)
- [Jest 快照最佳实践](https://jestjs.io/docs/snapshot-testing)

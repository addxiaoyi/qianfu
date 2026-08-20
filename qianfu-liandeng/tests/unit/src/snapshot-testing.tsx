/**
 * Component Snapshot Testing Utilities
 * 优化项 494: Snapshot Testing - UI快照
 *
 * 提供组件快照测试的辅助函数和配置
 */
import { render, RenderOptions } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { ReactElement, ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

// ============================================================
// 类型定义
// ============================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * 初始路由
   * @default '/'
   */
  initialRoute?: string

  /**
   * 路由前缀
   * @default '/'
   */
  routePrefix?: string

  /**
   * 包装组件
   */
  wrapper?: React.ComponentType<{ children: ReactNode }>

  /**
   * 是否包装在 BrowserRouter 中
   * @default true
   */
  withRouter?: boolean
}

interface SnapshotVariantConfig<T> {
  name: string
  props: T
  options?: {
    description?: string
  }
}

// ============================================================
// 响应式断点
// ============================================================

export const RESPONSIVE_BREAKPOINTS = {
  mobile: { width: 375, height: 667 },
  mobileLandscape: { width: 667, height: 375 },
  tablet: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 800 },
  desktopLarge: { width: 1920, height: 1080 },
} as const

// ============================================================
// 主题配置
// ============================================================

export interface ThemeConfig {
  name: string
  className?: string
  dataAttribute?: string
}

export const commonThemes: ThemeConfig[] = [
  { name: 'light', className: '' },
  { name: 'dark', className: 'dark', dataAttribute: 'data-theme="dark"' },
]

// ============================================================
// 渲染函数
// ============================================================

/**
 * 创建测试专用的路由包装器
 */
function createRouterWrapper(initialRoute: string = '/', routePrefix: string = '/') {
  return function RouterWrapper({ children }: { children: ReactNode }) {
    // 设置初始路由
    if (typeof window !== 'undefined' && initialRoute !== '/') {
      window.history.pushState({}, 'Test', initialRoute)
    }
    return (
      <BrowserRouter basename={routePrefix}>
        {children}
      </BrowserRouter>
    )
  }
}

/**
 * 自定义渲染函数
 *
 * @example
 * ```tsx
 * // 基本用法
 * const { container } = customRender(<MyComponent />)
 *
 * // 带路由
 * const { container } = customRender(<MyComponent />, {
 *   initialRoute: '/servers/123',
 * })
 *
 * // 获取快照
 * expect(container).toMatchSnapshot()
 * ```
 */
export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    initialRoute = '/',
    routePrefix = '/',
    wrapper: customWrapper,
    withRouter = true,
    ...renderOptions
  } = options

  const Wrapper = customWrapper || (withRouter ? createRouterWrapper(initialRoute, routePrefix) : undefined)

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  }
}

// ============================================================
// 响应式快照测试
// ============================================================

/**
 * 响应式快照测试
 *
 * @example
 * ```tsx
 * describe('LoginPage responsive snapshots', () => {
 *   responsiveSnapshots(LoginPage, {
 *     baseProps: {},
 *     breakpoints: ['mobile', 'tablet', 'desktop'],
 *   })
 * })
 * ```
 */
export function responsiveSnapshots(
  Component: React.ComponentType<{ [key: string]: unknown }>,
  config: {
    baseProps?: Record<string, unknown>
    breakpoints?: Array<keyof typeof RESPONSIVE_BREAKPOINTS>
    customBreakpoints?: Array<{ name: string; width: number; height: number }>
  }
) {
  const { baseProps = {}, breakpoints = ['mobile', 'tablet', 'desktop'] } = config

  describe('responsive snapshots', () => {
    beforeEach(() => {
      // 重置窗口大小
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 })
      window.dispatchEvent(new Event('resize'))
    })

    breakpoints.forEach((breakpoint) => {
      const dimensions = RESPONSIVE_BREAKPOINTS[breakpoint]

      it(`renders correctly at ${breakpoint} (${dimensions.width}x${dimensions.height})`, () => {
        // 设置视口
        Object.defineProperty(window, 'innerWidth', { writable: true, value: dimensions.width })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: dimensions.height })
        window.dispatchEvent(new Event('resize'))

        const { container } = customRender(<Component {...baseProps} />)
        expect(container).toMatchSnapshot(`-${breakpoint}`)
      })
    })

    // 自定义断点
    if (config.customBreakpoints) {
      config.customBreakpoints.forEach(({ name, width, height }) => {
        it(`renders correctly at ${name} (${width}x${height})`, () => {
          Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
          Object.defineProperty(window, 'innerHeight', { writable: true, value: height })
          window.dispatchEvent(new Event('resize'))

          const { container } = customRender(<Component {...baseProps} />)
          expect(container).toMatchSnapshot(`-${name}`)
        })
      })
    }
  })
}

// ============================================================
// 主题快照测试
// ============================================================

/**
 * 主题快照测试
 *
 * @example
 * ```tsx
 * describe('Component themes', () => {
 *   themeSnapshots(MyComponent, {}, commonThemes)
 * })
 * ```
 */
export function themeSnapshots(
  Component: React.ComponentType<{ [key: string]: unknown }>,
  props: Record<string, unknown>,
  themes: ThemeConfig[]
) {
  describe('theme snapshots', () => {
    themes.forEach((theme) => {
      it(`renders correctly in ${theme.name} theme`, () => {
        const wrapperClass = theme.className || ''

        const { container } = customRender(
          <div className={wrapperClass} data-theme={theme.name}>
            <Component {...props} />
          </div>
        )

        expect(container).toMatchSnapshot(`-${theme.name}`)
      })
    })
  })
}

// ============================================================
// 变体快照测试
// ============================================================

/**
 * 组件变体快照测试配置
 */
export interface SnapshotVariantConfig<T> {
  name: string
  props: T
  options?: {
    containerClassName?: string
    description?: string
  }
}

/**
 * 为组件的多个变体生成快照测试
 *
 * @example
 * ```tsx
 * describe('Button snapshots', () => {
 *   snapshotVariants('Button', Button, [
 *     { name: 'default', props: { children: 'Click me' } },
 *     { name: 'primary', props: { variant: 'primary', children: 'Submit' } },
 *     { name: 'disabled', props: { disabled: true, children: 'Disabled' } },
 *   ])
 * })
 * ```
 */
export function snapshotVariants<T extends Record<string, unknown>>(
  componentName: string,
  Component: React.ComponentType<T>,
  variants: SnapshotVariantConfig<T>[]
) {
  describe(`${componentName} snapshot variants`, () => {
    variants.forEach(({ name, props, options }) => {
      it(`renders correctly: ${name}`, () => {
        const { container } = customRender(<Component {...props} />, {
          wrapper: options?.containerClassName
            ? ({ children }) => (
                <div className={options.containerClassName}>{children}</div>
              )
            : undefined,
        })
        expect(container).toMatchSnapshot(`-${name}`)
      })
    })
  })
}

// ============================================================
// 交互式快照
// ============================================================

/**
 * 快照交互状态
 */
export interface SnapshotInteractionState {
  name: string
  action: (user: UserEvent, container: HTMLElement) => Promise<void>
}

/**
 * 测试组件的交互状态快照
 *
 * @example
 * ```tsx
 * it('Button states', async () => {
 *   const { user, container } = customRender(<Button>Hover me</Button>)
 *
 *   const results = await snapshotInteractionStates(user, container, [
 *     { name: 'default', action: async () => {} },
 *     { name: 'hover', action: async () => {
 *       await user.hover(container.querySelector('button')!)
 *     }},
 *   ])
 *
 *   results.forEach(({ name, html }) => {
 *     expect(html).toMatchSnapshot(`-${name}`)
 *   })
 * })
 * ```
 */
export async function snapshotInteractionStates(
  user: UserEvent,
  container: HTMLElement,
  states: SnapshotInteractionState[]
): Promise<Array<{ name: string; html: string }>> {
  const results: Array<{ name: string; html: string }> = []

  for (const state of states) {
    await state.action(user, container)
    results.push({
      name: state.name,
      html: container.innerHTML,
    })
  }

  return results
}

// ============================================================
// 导出 Testing Library
// ============================================================

export * from '@testing-library/react'
export { userEvent }

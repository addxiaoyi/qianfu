/**
 * Snapshot Testing Setup
 * 优化项 494: Snapshot Testing - UI快照
 *
 * 配置前端 UI 组件快照测试环境
 */
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// ============================================================
// 全局清理
// ============================================================

// 每个测试后清理
afterEach(() => {
  cleanup()
})

// ============================================================
// 全局窗口配置
// ============================================================

// 设置默认视口大小
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1280,
})

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 800,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ============================================================
// 全局 vi 模拟函数
// ============================================================

// Mock setInterval/clearInterval
vi.useFakeTimers()

// 全局 vi 配置
vi.stubGlobal('scrollTo', vi.fn())
vi.stubGlobal('scroll', vi.fn())

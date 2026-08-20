/**
 * Snapshot Testing Utilities
 * 优化项 494: Snapshot Testing - UI快照
 *
 * 提供快照测试的辅助函数和配置
 *
 * @deprecated 请使用 snapshot-testing.tsx 中的函数
 */
export {
  customRender,
  responsiveSnapshots,
  themeSnapshots,
  snapshotVariants,
  snapshotInteractionStates,
  RESPONSIVE_BREAKPOINTS,
  commonThemes,
  type ThemeConfig,
  type SnapshotVariantConfig,
  type SnapshotInteractionState,
} from './snapshot-testing'

// Re-export Testing Library
export * from '@testing-library/react'

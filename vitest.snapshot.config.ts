/**
 * Vitest Snapshot Testing Configuration
 * 优化项 494: Snapshot Testing - UI快照
 *
 * 配置用于 UI 组件快照测试的环境
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // 使用 jsdom 环境进行 DOM 测试
    environment: 'jsdom',

    // 全局设置
    globals: {
      vi: true,
    },

    // 测试文件
    include: [
      'tests/unit/src/**/*.test.ts',
      'tests/unit/src/**/*.test.tsx',
      'tests/unit/src/**/*.snapshot.ts',
      'tests/unit/src/**/*.snapshot.tsx',
    ],

    // 排除
    exclude: [
      'node_modules/**',
      'dist/**',
      'dist-server/**',
      'server/**',
    ],

    // 快照配置
    snapshot: {
      // 快照输出格式
      printBasicPrototype: false,
      // 快照文件扩展名
      extension: '.snap',
    },

    // 报告器
    reporters: ['default', 'verbose'],

    // 测试超时 (毫秒)
    testTimeout: 30000,

    // setup 文件
    setupFiles: [
      './tests/unit/src/setup-snapshot.ts',
    ],

    // 序列执行
    sequence: {
      shuffle: false,
      hooks: 'list',
    },

    // 静默模式
    silent: false,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/forms': resolve(__dirname, 'src/forms'),
      '@/pages': resolve(__dirname, 'src/pages'),
      '@/store': resolve(__dirname, 'src/store'),
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/auth': resolve(__dirname, 'src/auth'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/utils': resolve(__dirname, 'src/utils'),
    },
  },
})

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 全局测试环境
    environment: 'node',

    // 全局测试设置
    globals: true,

    // 覆盖的文件模式
    include: [
      'server/**/*.test.ts',
      'server/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],

    // 排除的文件
    exclude: [
      'node_modules/**',
      'dist/**',
      'dist-server/**',
      '**/*.integration.test.ts',
      'tests/e2e/**',
    ],

    // 报告器
    reporters: ['default'],

    // 输出目录
    outputFile: {
      html: 'coverage/test-report.html',
    },

    // coverage 配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'dist-server/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        'tests/**',
        'vite.config.ts',
        'server/routes/**', // 路由层通常集成测试覆盖
      ],
      // 全局阈值
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },

    // 测试超时 (毫秒)
    testTimeout: 10000,

    // hook 超时
    hookTimeout: 10000,

    // 并发配置
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    // 序列执行特定测试
    sequence: {
      shuffle: false,
      hooks: 'list',
    },

    // 监视模式配置
    watch: false,

    // 静默模式
    silent: false,

    // 环境变量
    env: {
      NODE_ENV: 'test',
      SKIP_DB: 'true',
      SKIP_EXTERNAL: 'true',
    },
  },

  // 路径别名
  resolve: {
    alias: {
      '@server': resolve(__dirname, 'server'),
      '@config': resolve(__dirname, 'server/config'),
      '@middleware': resolve(__dirname, 'server/middleware'),
      '@lib': resolve(__dirname, 'server/lib'),
      '@routes': resolve(__dirname, 'server/routes'),
      '@services': resolve(__dirname, 'server/services'),
      '@tests': resolve(__dirname, 'tests'),
    },
  },
});

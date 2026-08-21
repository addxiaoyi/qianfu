/**
 * 负载测试 Vitest 配置
 * 优化项 203: 性能测试 - 负载测试
 *
 * 使用 autocannon 进行真实的 HTTP 负载测试
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 测试环境
    environment: 'node',

    // 全局测试设置
    globals: true,

    // 包含的测试文件
    include: ['tests/load/**/*.test.ts'],

    // 排除的文件
    exclude: [
      'node_modules/**',
      'dist/**',
      'dist-server/**',
    ],

    // 报告器
    reporters: ['default', 'html', 'json'],

    // 输出目录
    outputFile: {
      html: 'coverage/load-test-report.html',
      json: 'coverage/load-test-results.json',
    },

    // 测试超时 (毫秒) - 负载测试需要更长时间
    testTimeout: 120000,

    // hook 超时
    hookTimeout: 30000,

    // 串行执行负载测试
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // 负载测试需要串行执行
      },
    },

    // 序列配置
    sequence: {
      shuffle: false,
      hooks: 'list',
    },

    // 监视模式禁用
    watch: false,

    // 环境变量
    env: {
      NODE_ENV: 'test',
      LOAD_TEST: 'true',
      SKIP_DB: 'true',
    },

    // 覆盖
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/load-test',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        'scripts/**',
      ],
    },
  },

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

/**
 * API E2E 测试专用 Playwright 配置
 * 优化项 202: 集成测试 - API端到端
 *
 * 使用方式:
 * - 运行所有 API 测试: npx playwright test --config=playwright.api.config.ts
 * - 只运行合规 API: npx playwright test compliance-api.spec.ts --config=playwright.api.config.ts
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * API 测试配置
 */
export default defineConfig({
  testDir: './tests/e2e',

  // 只运行 API 测试文件
  testMatch: '**/tests/e2e/*-api.spec.ts',

  // 排除 UI 测试
  testIgnore: [
    '**/tests/e2e/auth.spec.ts',
    '**/tests/e2e/search.spec.ts',
    '**/tests/e2e/global-*.ts',
    '**/tests/e2e/test-orchestrator.ts',
  ],

  // 完全并行测试
  fullyParallel: true,

  // CI 环境下重试
  retries: process.env.CI ? 2 : 1,

  // 限制工作线程
  workers: process.env.CI ? 4 : undefined,

  // 报告器
  reporter: [
    ['html', { outputFolder: 'coverage/api-playwright-report' }],
    ['json', { outputFile: 'coverage/api-playwright-results.json' }],
    ['list'],
    ['@estruyf/vscode-reporter', process.env.CI ? {
      reportResults: true,
      openInBrowser: false,
    } : undefined],
  ].filter((r) => r[1] !== undefined),

  use: {
    // 基础 URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // API 测试不需要追踪
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',

    // 截图配置
    screenshotOnFailure: true,

    // 等待时间配置
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,

    // 桌面视口
    viewport: { width: 1280, height: 720 },

    // 中文环境
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',

    // 不记录视频
    recordVideo: undefined,
  },

  // 全局设置 - API 测试需要服务运行
  globalSetup: './tests/e2e/api-global-setup.ts',
  globalTeardown: './tests/e2e/api-global-teardown.ts',

  // 只使用 Chromium
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // WebServer 配置 - CI 环境自动启动服务
  webServer: process.env.CI
    ? {
        command: 'pnpm start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,

  // 输出目录
  outputDir: 'coverage/api-playwright-results',
});

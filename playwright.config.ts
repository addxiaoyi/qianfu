import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 */
export default defineConfig({
  testDir: './tests/e2e',

  // 完全失火模式 - 任何失败都会停止测试
  fullyParallel: true,

  // 失败时重试次数
  retries: process.env.CI ? 2 : 0,

  // 工作线程数
  workers: process.env.CI ? 2 : undefined,

  // 报告器
  reporter: [
    ['html', { outputFolder: 'coverage/playwright-report' }],
    ['json', { outputFile: 'coverage/playwright-results.json' }],
    ['list'],
  ],

  use: {
    // 基础 URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // 追踪配置
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',

    // 视频配置
    video: 'on-first-retry',

    // 截图配置
    screenshotOnFailure: true,

    // 等待时间配置
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,

    // 视口配置
    viewport: { width: 1280, height: 720 },

    // 标记语言
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',

    // 是否记录视频
    recordVideo: process.env.CI ? { dir: 'coverage/videos' } : undefined,
  },

  // 全局清理
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  // 项目配置 (多浏览器)
  projects: [
    // Chromium - 主要测试
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox - 次要测试
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // Mobile Safari
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // WebServer 配置 (开发/CI 时自动启动)
  webServer: process.env.CI
    ? {
        command: 'pnpm start',
        url: 'http://localhost:3000',
        reuseExistingServer: false,
        timeout: 120000,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,

  // 输出目录
  outputDir: 'coverage/playwright-results',
});

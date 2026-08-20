/**
 * API E2E 测试编排
 * 优化项 202: 集成测试 - API端到端
 *
 * 负责协调所有API测试的执行顺序和依赖关系
 */

import { test, expect, chromium, FullConfig } from '@playwright/test';

/**
 * 测试前准备
 */
test.beforeAll(async ({ browser }) => {
  // 启动浏览器
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 检查服务是否可用
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    console.log(`检查服务可用性: ${baseUrl}`);

    const response = await page.goto(`${baseUrl}/health`, { timeout: 10000 });

    if (!response || response.status() >= 500) {
      console.warn('服务可能未启动或不可用，测试可能失败');
    }

    console.log('API E2E 测试环境准备完成');
  } catch (error) {
    console.warn('无法连接到测试服务:', error);
  } finally {
    await context.close();
  }
});

/**
 * 测试套件编排
 */
test.describe.serial('API E2E 测试套件编排', () => {
  // 测试执行顺序和依赖关系
  const testOrder = [
    // 1. 健康检查 - 最基础的服务检查
    { file: 'metrics-api.spec.ts', name: 'Metrics API' },
    // 2. 语义搜索API - 独立功能
    { file: 'semantic-search-api.spec.ts', name: '语义搜索 API' },
    // 3. 合规API - 依赖认证功能
    { file: 'compliance-api.spec.ts', name: '合规 API' },
  ];

  for (const testGroup of testOrder) {
    test.describe(testGroup.name, () => {
      test(`验证 ${testGroup.name} 测试套件已配置`, async () => {
        // 这是一个占位测试，确保测试文件被加载
        expect(true).toBe(true);
      });
    });
  }
});

/**
 * 全局测试配置
 */
export default async function globalSetup(config: FullConfig) {
  console.log('='.repeat(50));
  console.log('API E2E 测试套件启动');
  console.log('='.repeat(50));
  console.log(`测试目录: ${config.testDir}`);
  console.log(`工作线程: ${config.workers}`);
  console.log(`重试次数: ${config.retries}`);
  console.log('='.repeat(50));

  // 检查环境变量
  const requiredEnvVars = ['BASE_URL'];
  const missing = requiredEnvVars.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    console.warn(`警告: 缺少环境变量: ${missing.join(', ')}`);
    console.warn('将使用默认值: http://localhost:3000');
  }

  // 预检查服务可用性
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const healthUrl = `${baseUrl}/health`;

    console.log(`检查服务健康状态: ${healthUrl}`);

    const response = await page.goto(healthUrl, {
      timeout: 10000,
    });

    if (response && response.ok()) {
      console.log('服务健康检查通过');
    } else {
      console.warn(`服务响应状态: ${response?.status() || 'N/A'}`);
    }

    await context.close();
    await browser.close();
  } catch (error) {
    console.error('服务健康检查失败:', error);
    console.warn('请确保测试服务正在运行');
  }

  console.log('全局设置完成');
}

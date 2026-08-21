/**
 * API E2E 测试全局设置
 * 优化项 202: 集成测试 - API端到端
 *
 * 负责测试前的环境准备
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('='.repeat(50));
  console.log('API E2E 测试环境设置');
  console.log('='.repeat(50));

  // 1. 检查必要环境变量
  const requiredEnvVars = ['BASE_URL'];
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`警告: 缺少环境变量: ${missing.join(', ')}`);
    console.warn('将使用默认值: http://localhost:3000');
  }

  // 2. 创建浏览器实例检查服务可用性
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const healthUrl = `${baseUrl}/health`;

    console.log(`检查服务健康状态: ${healthUrl}`);

    const response = await page.goto(healthUrl, {
      timeout: 15000,
    });

    if (response && response.ok()) {
      console.log('服务健康检查通过');

      // 获取响应内容
      try {
        const body = await response.json();
        console.log('健康状态响应:', JSON.stringify(body, null, 2));
      } catch {
        // 非 JSON 响应
        console.log('健康状态响应: OK');
      }
    } else if (response && response.status() === 404) {
      // 可能没有 /health 端点，尝试其他端点
      console.log('未找到 /health 端点，尝试 /metrics/resources/simple');

      try {
        const metricsResponse = await page.goto(`${baseUrl}/metrics/resources/simple`, {
          timeout: 10000,
        });

        if (metricsResponse && metricsResponse.ok()) {
          console.log('Metrics 端点可用');
        }
      } catch {
        console.warn('无法连接到服务');
      }
    } else {
      console.warn(`服务响应状态: ${response?.status() || 'N/A'}`);
    }
  } catch (error) {
    console.error('服务健康检查失败:', error);
    console.warn('请确保测试服务正在运行: pnpm start');
  }

  await context.close();
  await browser.close();

  // 3. 清理测试环境
  // await cleanupTestEnvironment();

  console.log('='.repeat(50));
  console.log('API E2E 测试环境设置完成');
  console.log('='.repeat(50));
}

/**
 * 清理测试环境
 */
async function cleanupTestEnvironment() {
  // 清理测试数据
  // await cleanupTestData();

  // 清理测试文件
  // await cleanupTestFiles();

  // 重置测试状态
  // await resetTestState();
}

export default globalSetup;

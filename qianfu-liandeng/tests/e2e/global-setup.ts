/**
 * E2E 测试全局设置
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // 创建浏览器实例用于一次性设置
  const browser = await chromium.launch();

  // 清理测试数据库
  // await cleanupTestDatabase();

  // 清理测试文件
  // await cleanupTestFiles();

  // 预热服务
  // await warmupServices();

  await browser.close();

  console.log('E2E 测试环境设置完成');
}

export default globalSetup;

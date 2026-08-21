/**
 * E2E 测试全局清理
 */

import { chromium } from '@playwright/test';

async function globalTeardown() {
  const browser = await chromium.launch();

  // 清理测试数据
  // await cleanupTestData();

  // 清理上传的文件
  // await cleanupUploads();

  // 发送测试报告通知（可选）
  // await sendTestReport();

  await browser.close();

  console.log('E2E 测试环境清理完成');
}

export default globalTeardown;

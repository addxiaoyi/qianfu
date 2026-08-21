/**
 * Vitest 全局测试设置
 *
 * 在所有测试运行前执行一次
 */

import { beforeAll, afterAll, vi } from 'vitest';

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.SKIP_DB = 'true';
process.env.SKIP_EXTERNAL = 'true';
process.env.LOG_LEVEL = 'error';

// 全局超时配置
jest.setTimeout(30000);
vi.setConfig({ testTimeout: 30000 });

beforeAll(() => {
  // 全局测试设置
  console.log('========================================');
  console.log('开始运行测试套件');
  console.log('========================================');
});

afterAll(() => {
  // 全局清理
  console.log('========================================');
  console.log('测试套件执行完毕');
  console.log('========================================');
});

// 全局错误处理
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

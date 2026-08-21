/**
 * 负载测试模块导出
 * 优化项 203: 性能测试 - 负载测试
 */

// 类型导出
export type {
  LoadTestConfig,
  RequestResult,
  LoadTestResult,
  TestThresholds,
  TestScenario,
  LoadTestOptions,
} from './load.test';

export type {
  LoadTestReport,
  ScenarioReport,
  BaselineMetrics,
  ChangeMetrics,
  TrendAnalysis,
} from './types';

// 配置导出
export { THRESHOLDS } from './load.test';

// 工具函数导出
export {
  createTestApp,
  concurrentRequests,
  calculateMetrics,
  warmup,
  runLoadTest,
  checkThresholds,
  printResult,
} from './load.test';

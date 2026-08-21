/**
 * Autocannon 负载测试运行器
 * 优化项 203: 性能测试 - 负载测试
 *
 * 使用 autocannon 进行 HTTP 负载测试
 * 安装: npm install -D autocannon
 * 运行: npm run load:autocannon
 */

import autocannon from 'autocannon';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 配置
// ============================================================

interface TestScenario {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  connections: number;
  duration: number;
  pipelining: number;
  warmup?: number;
}

interface LoadTestResult {
  scenario: string;
  timestamp: string;
  requests: {
    total: number;
    pending: number;
    sent: number;
  };
  latency: {
    min: number;
    max: number;
    mean: number;
    stddev: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    p999: number;
    p9999: number;
  };
  throughput: {
    mean: number;
    stddev: number;
    min: number;
    max: number;
    total: number;
  };
  errors: number;
  timeouts: number;
  non2xx: number;
  duration: number;
  rps: number;
}

// 负载测试场景定义
const SCENARIOS: TestScenario[] = [
  // 1. 基础性能测试
  {
    name: 'simple-get',
    url: process.env.TEST_BASE_URL || 'http://localhost:3000/api/simple',
    method: 'GET',
    connections: 10,
    duration: 10,
    pipelining: 1,
  },
  // 2. 中等并发测试
  {
    name: 'medium-concurrency',
    url: process.env.TEST_BASE_URL || 'http://localhost:3000/api/simple',
    method: 'GET',
    connections: 50,
    duration: 10,
    pipelining: 1,
  },
  // 3. 高并发测试
  {
    name: 'high-concurrency',
    url: process.env.TEST_BASE_URL || 'http://localhost:3000/api/simple',
    method: 'GET',
    connections: 100,
    duration: 10,
    pipelining: 1,
  },
  // 4. POST 请求测试
  {
    name: 'post-request',
    url: process.env.TEST_BASE_URL || 'http://localhost:3000/api/compute',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ iterations: 1000 }),
    connections: 20,
    duration: 10,
    pipelining: 1,
  },
  // 5. 持续负载测试
  {
    name: 'sustained-load',
    url: process.env.TEST_BASE_URL || 'http://localhost:3000/api/simple',
    method: 'GET',
    connections: 30,
    duration: 60, // 1分钟持续负载
    pipelining: 1,
  },
  // 6. 突发流量测试
  {
    name: 'burst-traffic',
    url: process.env.TEST_BASE_URL || 'http://localhost:3000/api/simple',
    method: 'GET',
    connections: 200,
    duration: 5,
    pipelining: 4, // HTTP pipelining 模拟突发
  },
];

// 性能阈值定义
const THRESHOLDS = {
  simpleGet: {
    p95: 200,      // P95 响应时间 < 200ms
    maxErrorRate: 1, // 错误率 < 1%
    minRps: 100,   // 最小 100 RPS
  },
  mediumConcurrency: {
    p95: 500,
    maxErrorRate: 5,
    minRps: 50,
  },
  highConcurrency: {
    p95: 1000,
    maxErrorRate: 10,
    minRps: 30,
  },
};

// ============================================================
// 工具函数
// ============================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function checkThresholds(result: LoadTestResult, scenarioName: string): {
  passed: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  let passed = true;

  // 根据场景选择阈值
  let threshold;
  if (scenarioName.includes('simple')) {
    threshold = THRESHOLDS.simpleGet;
  } else if (scenarioName.includes('medium')) {
    threshold = THRESHOLDS.mediumConcurrency;
  } else if (scenarioName.includes('high')) {
    threshold = THRESHOLDS.highConcurrency;
  } else {
    threshold = THRESHOLDS.simpleGet;
  }

  // 检查 P95 延迟
  if (result.latency.p95 > threshold.p95) {
    errors.push(`P95 延迟过高: ${result.latency.p95.toFixed(2)}ms > ${threshold.p95}ms`);
    passed = false;
  }

  // 检查错误率
  const errorRate = (result.errors / result.requests.total) * 100;
  if (errorRate > threshold.maxErrorRate) {
    errors.push(`错误率过高: ${errorRate.toFixed(2)}% > ${threshold.maxErrorRate}%`);
    passed = false;
  }

  // 检查 RPS
  if (result.rps < threshold.minRps) {
    warnings.push(`RPS 低于预期: ${result.rps.toFixed(2)} < ${threshold.minRps}`);
  }

  return { passed, warnings, errors };
}

// ============================================================
// 单个场景测试
// ============================================================

async function runScenario(scenario: TestScenario): Promise<LoadTestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`运行测试场景: ${scenario.name}`);
  console.log(`URL: ${scenario.url}`);
  console.log(`并发连接: ${scenario.connections}`);
  console.log(`测试时长: ${scenario.duration}s`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  const result = await autocannon({
    url: scenario.url,
    method: scenario.method,
    headers: scenario.headers,
    body: scenario.body,
    connections: scenario.connections,
    duration: scenario.duration,
    pipelining: scenario.pipelining,
    warmup: scenario.warmup,
    renderResult: false,
    reconnectInterval: 1000,
    socketReuse: true,
  });

  const endTime = Date.now();

  return {
    scenario: scenario.name,
    timestamp: new Date().toISOString(),
    requests: result.requests,
    latency: result.latency,
    throughput: result.throughput,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    duration: endTime - startTime,
    rps: result.requests.total / (scenario.duration + (scenario.warmup || 0)),
  };
}

// ============================================================
// 结果输出
// ============================================================

function printResult(result: LoadTestResult): void {
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`测试结果: ${result.scenario}`);
  console.log(`完成时间: ${result.timestamp}`);
  console.log('-'.repeat(60));

  console.log('\n请求统计:');
  console.log(`  总请求数: ${result.requests.total.toLocaleString()}`);
  console.log(`  RPS: ${result.rps.toFixed(2)}`);
  console.log(`  错误数: ${result.errors}`);
  console.log(`  超时数: ${result.timeouts}`);
  console.log(`  非2xx响应: ${result.non2xx}`);

  console.log('\n延迟统计 (ms):');
  console.log(`  Min:    ${formatDuration(result.latency.min)}`);
  console.log(`  Mean:   ${formatDuration(result.latency.mean)}`);
  console.log(`  StdDev: ${formatDuration(result.latency.stddev)}`);
  console.log(`  P50:    ${formatDuration(result.latency.p50)}`);
  console.log(`  P90:    ${formatDuration(result.latency.p90)}`);
  console.log(`  P95:    ${formatDuration(result.latency.p95)}`);
  console.log(`  P99:    ${formatDuration(result.latency.p99)}`);
  console.log(`  P999:   ${formatDuration(result.latency.p999)}`);
  console.log(`  P9999:  ${formatDuration(result.latency.p9999)}`);
  console.log(`  Max:    ${formatDuration(result.latency.max)}`);

  console.log('\n吞吐量:');
  console.log(`  Mean:   ${formatBytes(result.throughput.mean)}/s`);
  console.log(`  Min:    ${formatBytes(result.throughput.min)}/s`);
  console.log(`  Max:    ${formatBytes(result.throughput.max)}/s`);
  console.log(`  Total:  ${formatBytes(result.throughput.total)}`);

  console.log(`\n测试耗时: ${(result.duration / 1000).toFixed(2)}s`);
}

// ============================================================
// 生成报告
// ============================================================

function generateReport(results: LoadTestResult[], outputPath: string): void {
  const report = {
    summary: {
      totalScenarios: results.length,
      timestamp: new Date().toISOString(),
      environment: process.env.TEST_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
    },
    scenarios: results.map(r => ({
      name: r.scenario,
      rps: Math.round(r.rps),
      p95: Math.round(r.latency.p95),
      p99: Math.round(r.latency.p99),
      errorRate: `${((r.errors / r.requests.total) * 100).toFixed(2)}%`,
      status: checkThresholds(r, r.scenario).passed ? 'PASS' : 'FAIL',
    })),
    details: results,
  };

  // 确保输出目录存在
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n报告已生成: ${outputPath}`);
}

// ============================================================
// 主函数
// ============================================================

async function main(): Promise<void> {
  console.log('🚀 负载测试开始');
  console.log(`基础 URL: ${process.env.TEST_BASE_URL || 'http://localhost:3000'}`);
  console.log(`测试场景数: ${SCENARIOS.length}`);

  const results: LoadTestResult[] = [];
  const reportDir = join(__dirname, '../../reports/load-test');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = join(reportDir, `report-${timestamp}.json`);

  // 支持通过环境变量选择测试场景
  const scenarioFilter = process.env.TEST_SCENARIOS?.split(',') || null;
  const scenariosToRun = scenarioFilter
    ? SCENARIOS.filter(s => scenarioFilter.includes(s.name))
    : SCENARIOS;

  console.log(`将运行 ${scenariosToRun.length} 个测试场景`);

  for (const scenario of scenariosToRun) {
    try {
      const result = await runScenario(scenario);
      results.push(result);
      printResult(result);

      // 检查阈值
      const thresholdResult = checkThresholds(result, scenario.name);
      if (thresholdResult.passed) {
        console.log(`\n✅ ${scenario.name} - 通过`);
      } else {
        console.log(`\n❌ ${scenario.name} - 未通过`);
        thresholdResult.errors.forEach(e => console.log(`   错误: ${e}`));
      }
      thresholdResult.warnings.forEach(w => console.log(`   警告: ${w}`));
    } catch (error) {
      console.error(`\n❌ 测试场景 ${scenario.name} 失败:`, error);
    }
  }

  // 生成报告
  if (results.length > 0) {
    generateReport(results, reportFile);

    // 输出汇总
    console.log('\n' + '='.repeat(60));
    console.log('测试汇总');
    console.log('='.repeat(60));
    console.log('\n场景结果:');
    results.forEach(r => {
      const thresholdResult = checkThresholds(r, r.scenario);
      const status = thresholdResult.passed ? '✅' : '❌';
      console.log(`  ${status} ${r.scenario}: RPS=${r.rps.toFixed(0)}, P95=${r.latency.p95.toFixed(0)}ms`);
    });
  }

  // 计算退出码
  const allPassed = results.every(r => checkThresholds(r, r.scenario).passed);
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);

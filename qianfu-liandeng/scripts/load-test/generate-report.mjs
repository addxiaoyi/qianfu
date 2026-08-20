/**
 * 负载测试报告生成器
 * 优化项 203: 性能测试 - 负载测试
 *
 * 从多个来源聚合数据生成综合报告
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  reportsDir: join(__dirname, '../../reports/load-test'),
  outputDir: join(__dirname, '../../reports/load-test/summary'),
};

// ============================================================
// 报告类型定义
// ============================================================

interface LoadTestReport {
  timestamp: string;
  environment: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    overallStatus: 'PASS' | 'FAIL';
  };
  scenarios: ScenarioReport[];
  trends?: TrendAnalysis;
}

interface ScenarioReport {
  name: string;
  description: string;
  status: 'PASS' | 'FAIL';
  metrics: {
    rps: number;
    latency: {
      min: number;
      mean: number;
      p50: number;
      p95: number;
      p99: number;
      max: number;
    };
    errorRate: number;
    throughput: {
      mean: number;
      max: number;
      total: number;
    };
  };
  comparison?: {
    baseline?: BaselineMetrics;
    change?: ChangeMetrics;
  };
}

interface BaselineMetrics {
  rps: number;
  p95: number;
  timestamp: string;
}

interface ChangeMetrics {
  rps: { value: number; direction: 'up' | 'down' };
  p95: { value: number; direction: 'up' | 'down' };
}

interface TrendAnalysis {
  direction: 'improving' | 'stable' | 'degrading';
  details: string[];
}

// ============================================================
// 工具函数
// ============================================================

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function formatNumber(num, decimals = 2) {
  return Number(num).toFixed(decimals);
}

function calculateChange(current, baseline) {
  if (!baseline || baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

function formatChange(change, direction) {
  const sign = direction === 'up' ? '+' : '-';
  return `${sign}${Math.abs(change).toFixed(1)}%`;
}

// ============================================================
// 加载测试数据
// ============================================================

function loadTestData() {
  const historyDir = join(CONFIG.reportsDir, 'history');
  const reports = [];

  // 加载历史报告
  if (existsSync(historyDir)) {
    const files = [];
    try {
      const dir = Deno.readDirSync(historyDir);
      for (const file of dir) {
        if (file.name.endsWith('.json') && file.name !== 'baseline.json') {
          files.push(file.name);
        }
      }
    } catch {
      // 降级处理
    }

    for (const file of files.slice(-10)) { // 最近 10 个报告
      try {
        const content = readFileSync(join(historyDir, file), 'utf-8');
        reports.push(JSON.parse(content));
      } catch {
        // 跳过无效文件
      }
    }
  }

  // 加载当前报告
  const currentFile = join(CONFIG.reportsDir, 'current.json');
  if (existsSync(currentFile)) {
    try {
      const content = readFileSync(currentFile, 'utf-8');
      reports.push(JSON.parse(content));
    } catch {
      // 忽略
    }
  }

  return reports;
}

function loadBaseline() {
  const baselineFile = join(CONFIG.reportsDir, 'history', 'baseline.json');
  if (existsSync(baselineFile)) {
    try {
      return JSON.parse(readFileSync(baselineFile, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================================
// 生成报告
// ============================================================

function generateReport(data, baseline) {
  const scenarios: ScenarioReport[] = [];
  let passedCount = 0;
  let failedCount = 0;

  // 处理每个测试场景
  for (const result of data) {
    if (Array.isArray(result.results)) {
      for (const r of result.results) {
        const scenario = processScenarioResult(r, baseline?.[r.scenario]);
        scenarios.push(scenario);
        if (scenario.status === 'PASS') {
          passedCount++;
        } else {
          failedCount++;
        }
      }
    } else if (result.scenario) {
      const scenario = processScenarioResult(result, baseline?.[result.scenario]);
      scenarios.push(scenario);
      if (scenario.status === 'PASS') {
        passedCount++;
      } else {
        failedCount++;
      }
    }
  }

  // 分析趋势
  const trends = analyzeTrends(scenarios);

  const report: LoadTestReport = {
    timestamp: new Date().toISOString(),
    environment: process.env.TEST_ENV || 'development',
    summary: {
      totalTests: scenarios.length,
      passed: passedCount,
      failed: failedCount,
      overallStatus: failedCount === 0 ? 'PASS' : 'FAIL',
    },
    scenarios,
    trends,
  };

  return report;
}

function processScenarioResult(result, baseline): ScenarioReport {
  // 提取指标
  const rps = result.rps || (result.requests?.total / result.duration * 1000);
  const latency = result.latency || result.latencyMs || {};
  const p95 = latency.p95 || latency['p95'] || 0;

  // 计算状态
  const status = determineStatus(rps, p95, result.errors, result.requests?.total);

  // 计算与基准的比较
  let comparison;
  if (baseline) {
    const rpsChange = calculateChange(rps, baseline.rps);
    const p95Change = calculateChange(p95, baseline.p95);

    comparison = {
      baseline: {
        rps: baseline.rps,
        p95: baseline.p95,
        timestamp: baseline.timestamp,
      },
      change: {
        rps: {
          value: Math.abs(rpsChange),
          direction: rpsChange >= 0 ? 'up' : 'down',
        },
        p95: {
          value: Math.abs(p95Change),
          direction: p95Change <= 0 ? 'up' : 'down', // 延迟下降是好的
        },
      },
    };
  }

  return {
    name: result.scenario || 'unknown',
    description: getScenarioDescription(result.scenario),
    status,
    metrics: {
      rps: rps || 0,
      latency: {
        min: latency.min || 0,
        mean: latency.mean || 0,
        p50: latency.p50 || 0,
        p95: p95,
        p99: latency.p99 || 0,
        max: latency.max || 0,
      },
      errorRate: result.errorRate || ((result.errors / result.requests?.total) * 100) || 0,
      throughput: {
        mean: result.throughput?.mean || 0,
        max: result.throughput?.max || 0,
        total: result.throughput?.total || 0,
      },
    },
    comparison,
  };
}

function getScenarioDescription(scenarioName) {
  const descriptions = {
    'simple-get': '简单 GET 请求 - 验证基础 API 性能',
    'medium-concurrency': '中等并发测试 - 模拟正常负载',
    'high-concurrency': '高并发测试 - 压力测试',
    'sustained-load': '持续负载测试 - 长时间稳定性',
    'burst-traffic': '突发流量测试 - 峰值处理能力',
    'smoke': '冒烟测试 - 基础功能验证',
    'light': '轻负载测试 - 日常开发验证',
    'medium': '中等负载测试 - 预发布验证',
    'stress': '压力测试 - 极限性能验证',
  };
  return descriptions[scenarioName] || scenarioName;
}

function determineStatus(rps, p95, errors, totalRequests) {
  // 性能阈值
  const THRESHOLDS = {
    minRps: 30,
    maxP95: 1000,
    maxErrorRate: 5,
  };

  const errorRate = totalRequests ? (errors / totalRequests) * 100 : 0;

  if (rps < THRESHOLDS.minRps) return 'FAIL';
  if (p95 > THRESHOLDS.maxP95) return 'FAIL';
  if (errorRate > THRESHOLDS.maxErrorRate) return 'FAIL';

  return 'PASS';
}

function analyzeTrends(scenarios): TrendAnalysis | undefined {
  if (scenarios.length < 2) return undefined;

  const details: string[] = [];
  let improvingCount = 0;
  let degradingCount = 0;

  for (const scenario of scenarios) {
    if (scenario.comparison?.change) {
      const { rps, p95 } = scenario.comparison.change;

      // RPS 上升 + 延迟下降 = 改善
      if (rps.direction === 'up' && p95.direction === 'up') {
        improvingCount++;
      }
      // RPS 下降 + 延迟上升 = 退化
      if (rps.direction === 'down' && p95.direction === 'down') {
        degradingCount++;
      }
    }
  }

  let direction: 'improving' | 'stable' | 'degrading';
  if (improvingCount > degradingCount && improvingCount > scenarios.length / 2) {
    direction = 'improving';
    details.push('多个场景显示性能改善');
  } else if (degradingCount > improvingCount && degradingCount > scenarios.length / 2) {
    direction = 'degrading';
    details.push('多个场景显示性能退化');
  } else {
    direction = 'stable';
    details.push('性能保持稳定');
  }

  return { direction, details };
}

// ============================================================
// 格式化输出
// ============================================================

function formatMarkdownReport(report: LoadTestReport): string {
  let md = `# 负载测试报告\n\n`;
  md += `**生成时间**: ${report.timestamp}\n`;
  md += `**环境**: ${report.environment}\n\n`;

  // 汇总
  md += `## 测试汇总\n\n`;
  md += `| 指标 | 值 |\n`;
  md += `| --- | --- |\n`;
  md += `| 总测试数 | ${report.summary.totalTests} |\n`;
  md += `| 通过 | ${report.summary.passed} |\n`;
  md += `| 失败 | ${report.summary.failed} |\n`;
  md += `| 状态 | ${report.summary.overallStatus} |\n\n`;

  // 场景详情
  md += `## 场景详情\n\n`;

  for (const scenario of report.scenarios) {
    const statusEmoji = scenario.status === 'PASS' ? '✅' : '❌';
    md += `### ${statusEmoji} ${scenario.name}\n\n`;
    md += `${scenario.description}\n\n`;

    md += `**性能指标:**\n\n`;
    md += `| 指标 | 值 |\n`;
    md += `| --- | --- |\n`;
    md += `| RPS | ${scenario.metrics.rps.toFixed(0)} |\n`;
    md += `| P50 | ${scenario.metrics.latency.p50.toFixed(0)}ms |\n`;
    md += `| P95 | ${scenario.metrics.latency.p95.toFixed(0)}ms |\n`;
    md += `| P99 | ${scenario.metrics.latency.p99.toFixed(0)}ms |\n`;
    md += `| 错误率 | ${scenario.metrics.errorRate.toFixed(2)}% |\n\n`;

    if (scenario.comparison) {
      md += `**与基准对比:**\n\n`;
      md += `| 指标 | 基准 | 当前 | 变化 |\n`;
      md += `| --- | --- | --- | --- |\n`;
      const { baseline, change } = scenario.comparison;
      md += `| RPS | ${baseline.rps.toFixed(0)} | ${scenario.metrics.rps.toFixed(0)} | ${formatChange(change.rps.value, change.rps.direction)} |\n`;
      md += `| P95 | ${baseline.p95.toFixed(0)}ms | ${scenario.metrics.latency.p95.toFixed(0)}ms | ${formatChange(change.p95.value, change.p95.direction)} |\n\n`;
    }
  }

  // 趋势分析
  if (report.trends) {
    md += `## 趋势分析\n\n`;
    const trendEmoji = report.trends.direction === 'improving' ? '📈' :
                       report.trends.direction === 'degrading' ? '📉' : '➡️';
    md += `${trendEmoji} 方向: **${report.trends.direction.toUpperCase()}**\n\n`;
    for (const detail of report.trends.details) {
      md += `- ${detail}\n`;
    }
  }

  return md;
}

// ============================================================
// 主函数
// ============================================================

function main() {
  console.log('正在生成负载测试报告...\n');

  ensureDir(CONFIG.outputDir);

  // 加载数据
  const testData = loadTestData();
  const baseline = loadBaseline();

  if (testData.length === 0) {
    console.log('未找到测试数据');
    process.exit(1);
  }

  console.log(`加载了 ${testData.length} 个测试报告`);

  // 生成报告
  const report = generateReport(testData, baseline);

  // 保存 JSON 报告
  const jsonPath = join(CONFIG.outputDir, 'report.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON 报告已保存: ${jsonPath}`);

  // 生成 Markdown 报告
  const markdown = formatMarkdownReport(report);
  const mdPath = join(CONFIG.outputDir, 'report.md');
  writeFileSync(mdPath, markdown);
  console.log(`Markdown 报告已保存: ${mdPath}`);

  // 打印摘要
  console.log('\n' + '='.repeat(60));
  console.log('报告摘要');
  console.log('='.repeat(60));
  console.log(`\n总体状态: ${report.summary.overallStatus}`);
  console.log(`通过: ${report.summary.passed}/${report.summary.totalTests}`);

  if (report.trends) {
    console.log(`趋势: ${report.trends.direction}`);
  }
}

main();

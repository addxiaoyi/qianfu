/**
 * CI 负载测试运行器
 * 优化项 203: 性能测试 - 负载测试
 *
 * 用于 CI/CD 环境中执行负载测试
 * 支持阈值比较和性能回归检测
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  // 测试服务器地址
  targetUrl: process.env.LOAD_TEST_TARGET || 'http://localhost:3000',

  // 历史数据存储路径
  historyDir: join(__dirname, '../../reports/load-test/history'),

  // 当前测试报告路径
  currentReport: join(__dirname, '../../reports/load-test/current.json'),

  // 回归阈值 (百分比)
  regressionThreshold: {
    rps: 10,      // RPS 下降超过 10% 视为回归
    latency: 20,  // 延迟上升超过 20% 视为回归
  },

  // 最小性能要求
  minPerformance: {
    rps: 50,         // 最小 RPS
    p95Latency: 500, // 最大 P95 延迟 (ms)
    errorRate: 5,    // 最大错误率 (%)
  },
};

// ============================================================
// 性能阈值定义
// ============================================================

const SCENARIOS = [
  {
    name: 'smoke',
    description: '冒烟测试 - 基础功能验证',
    duration: 10,
    connections: 5,
    rpsTarget: 30,
    p95Target: 300,
  },
  {
    name: 'light',
    description: '轻负载测试',
    duration: 30,
    connections: 20,
    rpsTarget: 80,
    p95Target: 400,
  },
  {
    name: 'medium',
    description: '中等负载测试',
    duration: 60,
    connections: 50,
    rpsTarget: 150,
    p95Target: 600,
  },
  {
    name: 'stress',
    description: '压力测试',
    duration: 120,
    connections: 100,
    rpsTarget: 200,
    p95Target: 1000,
  },
];

// ============================================================
// 工具函数
// ============================================================

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function saveReport(data, filepath) {
  ensureDir(dirname(filepath));
  writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function loadHistory() {
  const historyFile = join(CONFIG.historyDir, 'baseline.json');
  if (existsSync(historyFile)) {
    try {
      return JSON.parse(readFileSync(historyFile, 'utf-8'));
    } catch {
      log('无法加载历史数据', 'WARN');
    }
  }
  return null;
}

function saveBaseline(scenario, result) {
  const baselineFile = join(CONFIG.historyDir, 'baseline.json');
  let baseline = loadHistory() || {};

  baseline[scenario] = {
    timestamp: new Date().toISOString(),
    rps: result.rps,
    p95: result.p95,
    p99: result.p99,
    errorRate: result.errorRate,
  };

  saveReport(baseline, baselineFile);
  log(`基准数据已更新: ${scenario}`, 'INFO');
}

function checkRegression(scenario, result) {
  const baseline = loadHistory();
  if (!baseline || !baseline[scenario]) {
    log(`无历史基准数据: ${scenario}`, 'WARN');
    return { hasRegression: false, isNewBaseline: true };
  }

  const base = baseline[scenario];
  const issues = [];

  // 检查 RPS 回归
  if (result.rps < base.rps) {
    const rpsDrop = ((base.rps - result.rps) / base.rps) * 100;
    if (rpsDrop > CONFIG.regressionThreshold.rps) {
      issues.push({
        type: 'rps_regression',
        message: `RPS 下降 ${rpsDrop.toFixed(1)}% (${base.rps.toFixed(0)} -> ${result.rps.toFixed(0)})`,
        severity: 'error',
      });
    }
  }

  // 检查延迟回归
  if (result.p95 > base.p95) {
    const latencyIncrease = ((result.p95 - base.p95) / base.p95) * 100;
    if (latencyIncrease > CONFIG.regressionThreshold.latency) {
      issues.push({
        type: 'latency_regression',
        message: `P95 延迟上升 ${latencyIncrease.toFixed(1)}% (${base.p95.toFixed(0)}ms -> ${result.p95.toFixed(0)}ms)`,
        severity: 'error',
      });
    }
  }

  // 检查错误率
  if (result.errorRate > base.errorRate + 2) {
    issues.push({
      type: 'error_rate_increase',
      message: `错误率上升: ${base.errorRate.toFixed(2)}% -> ${result.errorRate.toFixed(2)}%`,
      severity: 'error',
    });
  }

  return {
    hasRegression: issues.length > 0,
    issues,
    baseline: base,
  };
}

function checkMinimumPerformance(result) {
  const issues = [];

  if (result.rps < CONFIG.minPerformance.rps) {
    issues.push({
      type: 'rps_below_minimum',
      message: `RPS ${result.rps.toFixed(0)} 低于最小要求 ${CONFIG.minPerformance.rps}`,
      severity: 'error',
    });
  }

  if (result.p95 > CONFIG.minPerformance.p95Latency) {
    issues.push({
      type: 'p95_above_maximum',
      message: `P95 延迟 ${result.p95.toFixed(0)}ms 超过最大值 ${CONFIG.minPerformance.p95Latency}ms`,
      severity: 'error',
    });
  }

  if (result.errorRate > CONFIG.minPerformance.errorRate) {
    issues.push({
      type: 'error_rate_exceeded',
      message: `错误率 ${result.errorRate.toFixed(2)}% 超过最大值 ${CONFIG.minPerformance.errorRate}%`,
      severity: 'error',
    });
  }

  return issues;
}

// ============================================================
// 运行负载测试
// ============================================================

async function runLoadTest(scenario) {
  log(`运行测试场景: ${scenario.name} (${scenario.description})`);

  const targetUrl = `${CONFIG.targetUrl}/api/simple`;

  // 使用 curl 进行简单测试 (如果没有 autocannon)
  try {
    const startTime = Date.now();
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalLatency = 0;
    const latencies = [];

    // 计算需要的请求数
    const requestsPerSecond = Math.ceil(scenario.connections * 0.5);
    const totalRequestsNeeded = requestsPerSecond * scenario.duration;

    // 分批执行请求
    for (let i = 0; i < totalRequestsNeeded; i++) {
      const reqStart = Date.now();
      try {
        execSync(`curl -s -o /dev/null -w "%{http_code}" ${targetUrl}`, {
          stdio: 'pipe',
          timeout: 5000,
        });
        const latency = Date.now() - reqStart;
        totalLatency += latency;
        latencies.push(latency);
        successfulRequests++;
      } catch {
        // 请求失败
      }
      totalRequests++;

      // 控制请求速率
      if (i % requestsPerSecond === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 计算结果
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const result = {
      scenario: scenario.name,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      totalRequests,
      successfulRequests,
      rps: totalRequests / scenario.duration,
      avgLatency: totalLatency / totalRequests,
      p50,
      p95,
      p99,
      errorRate: ((totalRequests - successfulRequests) / totalRequests) * 100,
    };

    return result;
  } catch (error) {
    log(`测试失败: ${error.message}`, 'ERROR');
    return null;
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const testMode = args[0] || 'smoke'; // 默认冒烟测试
  const updateBaseline = args.includes('--update-baseline');

  log('='.repeat(60));
  log('CI 负载测试运行器');
  log('='.repeat(60));
  log(`目标 URL: ${CONFIG.targetUrl}`);
  log(`测试模式: ${testMode}`);
  log(`更新基准: ${updateBaseline}`);

  ensureDir(CONFIG.historyDir);

  // 选择测试场景
  let scenariosToRun;
  if (testMode === 'all') {
    scenariosToRun = SCENARIOS;
  } else {
    scenariosToRun = SCENARIOS.filter(s => s.name === testMode);
    if (scenariosToRun.length === 0) {
      log(`未知测试模式: ${testMode}`, 'ERROR');
      log(`可用模式: ${SCENARIOS.map(s => s.name).join(', ')}`, 'INFO');
      process.exit(1);
    }
  }

  const results = [];
  let hasFailure = false;

  // 执行测试
  for (const scenario of scenariosToRun) {
    const result = await runLoadTest(scenario);
    if (result) {
      results.push(result);

      // 检查最小性能要求
      const perfIssues = checkMinimumPerformance(result);
      if (perfIssues.length > 0) {
        log(`\n性能问题:`, 'ERROR');
        perfIssues.forEach(issue => log(`  - ${issue.message}`, 'ERROR'));
        hasFailure = true;
      }

      // 检查回归
      if (!updateBaseline) {
        const regression = checkRegression(scenario.name, result);
        if (regression.hasRegression) {
          log(`\n性能回归检测:`, 'ERROR');
          regression.issues.forEach(issue => log(`  - ${issue.message}`, 'ERROR'));
          hasFailure = true;
        } else if (regression.isNewBaseline) {
          log(`首次运行，创建基准数据...`, 'INFO');
          updateBaseline = true;
        }
      }

      // 更新基准
      if (updateBaseline) {
        saveBaseline(scenario.name, result);
      }

      // 打印结果
      log(`\n结果:`);
      log(`  RPS: ${result.rps.toFixed(0)}`);
      log(`  P95: ${result.p95.toFixed(0)}ms`);
      log(`  错误率: ${result.errorRate.toFixed(2)}%`);
    }
  }

  // 保存当前报告
  const report = {
    timestamp: new Date().toISOString(),
    target: CONFIG.targetUrl,
    mode: testMode,
    results,
  };
  saveReport(report, CONFIG.currentReport);

  // 输出汇总
  log('\n' + '='.repeat(60));
  log('测试汇总');
  log('='.repeat(60));
  log(`\n场景数: ${results.length}`);
  log(`失败数: ${hasFailure ? results.length : 0}`);

  if (results.length > 0) {
    log('\n结果汇总:');
    results.forEach(r => {
      const status = hasFailure ? '❌' : '✅';
      log(`  ${status} ${r.scenario}: RPS=${r.rps.toFixed(0)}, P95=${r.p95.toFixed(0)}ms`);
    });
  }

  process.exit(hasFailure ? 1 : 0);
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, 'ERROR');
  process.exit(1);
});

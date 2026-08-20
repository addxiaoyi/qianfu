/**
 * K6 负载测试场景
 * 优化项 203: 性能测试 - 负载测试
 *
 * K6 是一款现代化的负载测试工具，支持 JavaScript 编写测试脚本
 * 安装: https://k6.io/docs/getting-started/installation/
 * 运行: k6 run scripts/load-test/k6-scenarios.js
 *
 * 也可通过 docker 运行:
 * docker run -it loadimpact/k6 run - < scripts/load-test/k6-scenarios.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ============================================================
// 自定义指标
// ============================================================

// 错误率
const errorRate = new Rate('errors');

// 请求趋势
const simpleGetLatency = new Trend('simple_get_duration');
const complexGetLatency = new Trend('complex_get_duration');
const postLatency = new Trend('post_duration');
const cachedLatency = new Trend('cached_duration');
const metricsLatency = new Trend('metrics_duration');

// 计数器
const requestsTotal = new Counter('requests_total');
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');

// 仪表
const activeUsers = new Gauge('active_users');

// ============================================================
// 测试配置
// ============================================================

export const options = {
  // 场景1: 基础负载测试
  stages: [
    { duration: '30s', target: 10 },   // 0 -> 10 用户 (30秒)
    { duration: '1m', target: 10 },     // 保持 10 用户 (1分钟)
    { duration: '30s', target: 0 },    // 10 -> 0 用户 (30秒)
  ],

  // 场景2: 压力测试 (取消注释使用)
  // stages: [
  //   { duration: '1m', target: 50 },    // 逐步增加到 50 用户
  //   { duration: '3m', target: 50 },    // 保持 50 用户 3 分钟
  //   { duration: '1m', target: 100 },   // 增加到 100 用户
  //   { duration: '5m', target: 100 },   // 保持 100 用户 5 分钟
  //   { duration: '2m', target: 0 },     // 逐渐减少到 0
  // ],

  // 场景3: 峰值测试 (取消注释使用)
  // stages: [
  //   { duration: '10s', target: 5 },
  //   { duration: '30s', target: 200 }, // 突发到 200 用户
  //   { duration: '1m', target: 200 },
  //   { duration: '30s', target: 5 },
  // ],

  // 通用配置
  thresholds: {
    // HTTP 相关阈值
    'http_req_duration': ['p(95)<500'],                    // 95% 请求 < 500ms
    'http_req_duration': ['p(99)<1000'],                   // 99% 请求 < 1s
    'http_req_failed': ['rate<0.05'],                      // 失败率 < 5%

    // 自定义阈值
    'simple_get_duration': ['p(95)<200'],                   // 简单 GET P95 < 200ms
    'complex_get_duration': ['p(95)<1000'],                 // 复杂 GET P95 < 1s
    'post_duration': ['p(95)<1000'],                        // POST P95 < 1s

    // 错误阈值
    'errors': ['rate<0.02'],                                // 错误率 < 2%
    'errors': ['count<100'],                                // 总错误 < 100

    // RPS 阈值
    'requests_total': ['count>100'],                       // 至少 100 请求
  },

  // 分散化: 模拟真实用户行为
  rps: 100, // 目标 RPS (可选)

  // 日志级别
  // logLevel: 'warn',
};

// 测试环境配置
const BASE_URL = __ENV.TEST_BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

// ============================================================
// 测试数据生成
// ============================================================

function generateRandomId() {
  return Math.random().toString(36).substring(7);
}

function generateSearchQuery() {
  const queries = [
    'Minecraft server hosting',
    'game server cheap',
    'VPS hosting',
    'cloud gaming',
    'dedicated server',
  ];
  return queries[Math.floor(Math.random() * queries.length)];
}

// ============================================================
// 测试场景
// ============================================================

export default function () {
  // 更新活跃用户数
  activeUsers.add(__VU);

  group('基础 API 测试', () => {
    // 1. 简单 GET 请求
    testSimpleGet();

    // 2. 复杂 GET 请求
    testComplexGet();

    // 3. POST 请求
    testPostRequest();

    // 4. 缓存测试
    testCache();
  });

  group('Metrics API 测试', () => {
    testMetricsEndpoint();
  });

  group('搜索功能测试', () => {
    testSearch();
  });

  // 模拟用户思考时间
  sleep(1 + Math.random() * 2);
}

// ============================================================
// 测试用例
// ============================================================

function testSimpleGet() {
  const res = http.get(`${BASE_URL}/api/simple`);

  simpleGetLatency.add(res.timings.duration);
  requestsTotal.add(1);

  const success = check(res, {
    'simple get: status is 200': (r) => r.status === 200,
    'simple get: has success response': (r) => r.json('success') === true,
    'simple get: response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testComplexGet() {
  const res = http.get(`${BASE_URL}/api/complex`);

  complexGetLatency.add(res.timings.duration);
  requestsTotal.add(1);

  const success = check(res, {
    'complex get: status is 200': (r) => r.status === 200,
    'complex get: has data': (r) => r.json('data') !== undefined,
    'complex get: response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testPostRequest() {
  const payload = JSON.stringify({
    iterations: 1000,
    data: generateRandomId(),
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/compute`, payload, params);

  postLatency.add(res.timings.duration);
  requestsTotal.add(1);

  const success = check(res, {
    'post: status is 200': (r) => r.status === 200,
    'post: has result': (r) => r.json('result') !== undefined,
    'post: response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testCache() {
  const cacheKey = `test-${generateRandomId()}`;

  // 第一次请求 - 缓存未命中
  const missRes = http.get(`${BASE_URL}/api/cache/${cacheKey}`);

  if (missRes.status === 200 && missRes.json('source') === 'compute') {
    cacheMisses.add(1);
  }

  // 第二次请求 - 缓存命中
  const hitRes = http.get(`${BASE_URL}/api/cache/${cacheKey}`);

  cachedLatency.add(hitRes.timings.duration);
  requestsTotal.add(2);

  const success = check(hitRes, {
    'cache: status is 200': (r) => r.status === 200,
    'cache: source is cache': (r) => r.json('source') === 'cache',
    'cache: response time < 100ms': (r) => r.timings.duration < 100,
  });

  if (success) {
    cacheHits.add(1);
  } else {
    errorRate.add(1);
  }
}

function testMetricsEndpoint() {
  const res = http.get(`${BASE_URL}/metrics/resources/simple`);

  metricsLatency.add(res.timings.duration);
  requestsTotal.add(1);

  const success = check(res, {
    'metrics: status is 200': (r) => r.status === 200,
    'metrics: has cpu data': (r) => r.json('cpu') !== undefined,
    'metrics: has memory data': (r) => r.json('memory') !== undefined,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testSearch() {
  const query = generateSearchQuery();
  const res = http.post(
    `${BASE_URL}/api/search`,
    JSON.stringify({ query, limit: 10 }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` }),
      },
    }
  );

  requestsTotal.add(1);

  const success = check(res, {
    'search: status is 200': (r) => r.status === 200,
    'search: has results': (r) => Array.isArray(r.json('results')) || r.json('data') !== undefined,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

// ============================================================
// 生命周期钩子
// ============================================================

export function setup() {
  console.log('测试配置:');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  API Key: ${API_KEY ? '已设置' : '未设置'}`);

  // 预热请求
  console.log('执行预热请求...');
  http.get(`${BASE_URL}/api/simple`);
  http.get(`${BASE_URL}/metrics/resources/simple`);

  return { baseUrl: BASE_URL };
}

export function teardown(data) {
  console.log('\n测试完成');
  console.log(`总请求数: ${__ITER}`);
}

// ============================================================
// 处理函数 (用于 k6 cloud 或自定义运行器)
// ============================================================

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, opts) {
  const indent = opts.indent || '';
  let output = '\n';

  output += `${indent}负载测试汇总\n`;
  output += `${indent}${'='.repeat(50)}\n\n`;

  output += `${indent}请求统计:\n`;
  output += `${indent}  总请求数: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}  请求速率: ${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0} req/s\n`;
  output += `${indent}  平均持续时间: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `${indent}  P95: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `${indent}  P99: ${(data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n`;
  output += `${indent}  最大持续时间: ${(data.metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n`;

  output += `\n${indent}错误统计:\n`;
  output += `${indent}  失败率: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  output += `${indent}  错误数: ${data.metrics.errors?.values?.count || 0}\n`;

  return output;
}

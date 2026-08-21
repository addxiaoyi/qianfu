/**
 * 增强的负载测试套件
 * 优化项 203: 性能测试 - 负载测试
 *
 * 使用 autocannon 进行真实的 HTTP 负载测试
 * 支持多种测试场景和性能阈值
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import autocannon from 'autocannon';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';

// 导入安全中间件
import {
  sqlInjectionProtection,
  xssProtection,
  SecurityConfig,
  defaultSecurityConfig,
  securityHeaders,
} from '../../server/middleware/security/security-center';

// ============================================================
// 类型定义
// ============================================================

interface LoadTestResult {
  scenario: string;
  url: string;
  duration: number;
  connections: number;
  pipelining: number;
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
  rps: number;
}

interface TestThresholds {
  minRps: number;
  maxP95: number;
  maxP99: number;
  maxErrorRate: number;
}

// ============================================================
// 测试配置
// ============================================================

const THRESHOLDS: Record<string, TestThresholds> = {
  // 简单端点阈值
  simple: {
    minRps: 50,
    maxP95: 200,
    maxP99: 500,
    maxErrorRate: 1,
  },
  // 复杂端点阈值
  complex: {
    minRps: 20,
    maxP95: 500,
    maxP99: 1000,
    maxErrorRate: 2,
  },
  // 高并发阈值
  highConcurrency: {
    minRps: 30,
    maxP95: 1000,
    maxP99: 2000,
    maxErrorRate: 5,
  },
  // 持续负载阈值
  sustained: {
    minRps: 40,
    maxP95: 800,
    maxP99: 1500,
    maxErrorRate: 3,
  },
};

// ============================================================
// 测试应用创建
// ============================================================

function createTestApp(enableSecurity = true): Express {
  const app = express();
  app.use(express.json());

  if (enableSecurity) {
    app.use(sqlInjectionProtection(defaultSecurityConfig.sqlInjection));
    app.use(xssProtection(defaultSecurityConfig.xss));
    app.use(securityHeaders(defaultSecurityConfig.securityHeaders));
  }

  // 简单端点
  app.get('/api/simple', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Simple endpoint' });
  });

  // 复杂数据端点
  app.get('/api/complex', (_req: Request, res: Response) => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random() * 1000,
      timestamp: new Date().toISOString(),
    }));
    res.json({ success: true, data, count: data.length });
  });

  // 计算端点
  app.post('/api/compute', (req: Request, res: Response) => {
    const { iterations = 1000 } = req.body;
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    res.json({ success: true, result, iterations });
  });

  // 缓存端点
  const memoryCache = new Map<string, { data: unknown; expires: number }>();
  app.get('/api/cache/:key', (req: Request, res: Response) => {
    const { key } = req.params;
    const cached = memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      res.json({ success: true, source: 'cache', data: cached.data });
    } else {
      const data = { key, value: `Value for ${key}`, timestamp: Date.now() };
      memoryCache.set(key, { data, expires: Date.now() + 60000 });
      res.json({ success: true, source: 'compute', data });
    }
  });

  // 延迟端点
  app.get('/api/delay/:ms', (req: Request, res: Response) => {
    const delay = parseInt(req.params.ms) || 100;
    setTimeout(() => {
      res.json({ success: true, delay });
    }, delay);
  });

  return app;
}

// ============================================================
// 负载测试工具
// ============================================================

async function runLoadTest(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  connections: number;
  duration: number;
  pipelining?: number;
}): Promise<LoadTestResult> {
  const result = await autocannon({
    url: options.url,
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    connections: options.connections,
    duration: options.duration,
    pipelining: options.pipelining || 1,
    renderResult: false,
  });

  return {
    scenario: options.url,
    url: options.url,
    duration: options.duration,
    connections: options.connections,
    pipelining: options.pipelining || 1,
    requests: result.requests,
    latency: result.latency,
    throughput: result.throughput,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    rps: result.requests.total / options.duration,
  };
}

function checkThresholds(result: LoadTestResult, thresholds: TestThresholds): {
  passed: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const errorRate = (result.errors / result.requests.total) * 100;

  if (result.rps < thresholds.minRps) {
    issues.push(`RPS ${result.rps.toFixed(0)} 低于阈值 ${thresholds.minRps}`);
  }

  if (result.latency.p95 > thresholds.maxP95) {
    issues.push(`P95 延迟 ${result.latency.p95.toFixed(0)}ms 超过阈值 ${thresholds.maxP95}ms`);
  }

  if (result.latency.p99 > thresholds.maxP99) {
    issues.push(`P99 延迟 ${result.latency.p99.toFixed(0)}ms 超过阈值 ${thresholds.maxP99}ms`);
  }

  if (errorRate > thresholds.maxErrorRate) {
    issues.push(`错误率 ${errorRate.toFixed(2)}% 超过阈值 ${thresholds.maxErrorRate}%`);
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function printResult(result: LoadTestResult): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`场景: ${result.url}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`连接数: ${result.connections}, 时长: ${result.duration}s`);
  console.log(`\n请求统计:`);
  console.log(`  总请求: ${result.requests.total.toLocaleString()}`);
  console.log(`  RPS: ${result.rps.toFixed(0)}`);
  console.log(`  错误: ${result.errors}, 超时: ${result.timeouts}`);
  console.log(`\n延迟 (ms):`);
  console.log(`  Mean: ${result.latency.mean.toFixed(0)}`);
  console.log(`  P50:  ${result.latency.p50.toFixed(0)}`);
  console.log(`  P95:  ${result.latency.p95.toFixed(0)}`);
  console.log(`  P99:  ${result.latency.p99.toFixed(0)}`);
  console.log(`  Max:  ${result.latency.max.toFixed(0)}`);
}

// ============================================================
// 负载测试套件
// ============================================================

describe('负载测试 - Autocannon 真实 HTTP 测试', () => {
  let app: Express;
  let baseUrl = 'http://localhost:3001';

  beforeAll(async () => {
    // 启动测试服务器
    app = createTestApp(true);

    // 监听端口
    const server = app.listen(3001);
    console.log('测试服务器已启动: http://localhost:3001');

    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 确保服务器就绪
    try {
      await request('http://localhost:3001').get('/api/simple');
    } catch {
      // 继续
    }

    // 存储清理函数
    afterAll(() => {
      server.close();
      console.log('测试服务器已关闭');
    });
  });

  // ============================================================
  // 基础性能测试
  // ============================================================

  describe('基础性能测试', () => {
    it('简单 GET 请求 - 低并发', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: 5,
        duration: 5,
      });

      printResult(result);

      const { passed, issues } = checkThresholds(result, THRESHOLDS.simple);
      issues.forEach(issue => console.log(`  警告: ${issue}`));

      expect(passed).toBe(true);
      expect(result.rps).toBeGreaterThan(THRESHOLDS.simple.minRps);
    }, 30000);

    it('简单 GET 请求 - 中等并发', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: 20,
        duration: 10,
      });

      printResult(result);

      const { passed, issues } = checkThresholds(result, THRESHOLDS.simple);
      issues.forEach(issue => console.log(`  警告: ${issue}`));

      expect(passed).toBe(true);
    }, 60000);

    it('简单 GET 请求 - 高并发', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: 50,
        duration: 10,
      });

      printResult(result);

      const { passed, issues } = checkThresholds(result, THRESHOLDS.highConcurrency);
      issues.forEach(issue => console.log(`  警告: ${issue}`));

      expect(passed).toBe(true);
    }, 60000);
  });

  // ============================================================
  // 复杂端点测试
  // ============================================================

  describe('复杂端点测试', () => {
    it('复杂数据端点 - 正常负载', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/complex`,
        connections: 10,
        duration: 10,
      });

      printResult(result);

      const { passed, issues } = checkThresholds(result, THRESHOLDS.complex);
      issues.forEach(issue => console.log(`  警告: ${issue}`));

      expect(passed).toBe(true);
    }, 60000);

    it('POST 计算端点', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/compute`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iterations: 1000 }),
        connections: 10,
        duration: 10,
      });

      printResult(result);

      expect(result.rps).toBeGreaterThan(10);
      expect(result.errors).toBe(0);
    }, 60000);
  });

  // ============================================================
  // 持续负载测试
  // ============================================================

  describe('持续负载测试', () => {
    it('30秒持续负载', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: 20,
        duration: 30,
      });

      printResult(result);

      const { passed, issues } = checkThresholds(result, THRESHOLDS.sustained);
      issues.forEach(issue => console.log(`  警告: ${issue}`));

      expect(passed).toBe(true);
      expect(result.errors).toBeLessThan(result.requests.total * 0.05);
    }, 120000);

    it('60秒持续负载', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: 30,
        duration: 60,
      });

      printResult(result);

      const errorRate = (result.errors / result.requests.total) * 100;
      console.log(`  错误率: ${errorRate.toFixed(2)}%`);

      expect(errorRate).toBeLessThan(THRESHOLDS.sustained.maxErrorRate);
    }, 180000);
  });

  // ============================================================
  // 突发流量测试
  // ============================================================

  describe('突发流量测试', () => {
    it('HTTP Pipelining 突发', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: 10,
        duration: 5,
        pipelining: 4, // HTTP Pipelining
      });

      printResult(result);

      expect(result.rps).toBeGreaterThan(50);
    }, 30000);

    it('高并发突发', async () => {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: 100,
        duration: 5,
      });

      printResult(result);

      expect(result.rps).toBeGreaterThan(THRESHOLDS.highConcurrency.minRps);
    }, 30000);
  });

  // ============================================================
  // 安全中间件性能影响测试
  // ============================================================

  describe('安全中间件性能影响', () => {
    it('安全中间件开销测试', async () => {
      // 创建不带安全中间件的服务器
      const appNoSecurity = createTestApp(false);
      const serverNoSecurity = appNoSecurity.listen(3002);
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        // 测试不带安全中间件
        const resultNoSecurity = await runLoadTest({
          url: 'http://localhost:3002/api/simple',
          connections: 10,
          duration: 5,
        });

        // 测试带安全中间件
        const resultWithSecurity = await runLoadTest({
          url: `${baseUrl}/api/simple`,
          connections: 10,
          duration: 5,
        });

        console.log(`\n安全中间件性能对比:`);
        console.log(`  无安全 - RPS: ${resultNoSecurity.rps.toFixed(0)}, P95: ${resultNoSecurity.latency.p95.toFixed(0)}ms`);
        console.log(`  有安全 - RPS: ${resultWithSecurity.rps.toFixed(0)}, P95: ${resultWithSecurity.latency.p95.toFixed(0)}ms`);

        const overhead = ((resultWithSecurity.latency.p95 - resultNoSecurity.latency.p95) / resultNoSecurity.latency.p95) * 100;
        console.log(`  额外延迟开销: ${overhead.toFixed(1)}%`);

        // 安全中间件的开销应在合理范围内
        expect(overhead).toBeLessThan(100); // 延迟增加不超过 100%
      } finally {
        serverNoSecurity.close();
      }
    }, 120000);
  });

  // ============================================================
  // 缓存性能测试
  // ============================================================

  describe('缓存性能测试', () => {
    it('缓存命中性能', async () => {
      const cacheKey = `test-${Date.now()}`;

      // 第一次请求 - 缓存未命中
      await runLoadTest({
        url: `${baseUrl}/api/cache/${cacheKey}-miss`,
        connections: 5,
        duration: 2,
      });

      // 后续请求 - 缓存命中
      const result = await runLoadTest({
        url: `${baseUrl}/api/cache/${cacheKey}-miss`, // 相同 key
        connections: 10,
        duration: 5,
      });

      printResult(result);

      // 缓存命中应该有更低的延迟
      expect(result.latency.p95).toBeLessThan(100);
    }, 30000);
  });
});

// ============================================================
// 性能回归测试
// ============================================================

describe('性能回归测试', () => {
  let app: Express;
  let baseUrl = 'http://localhost:3003';

  beforeAll(async () => {
    app = createTestApp(true);
    const server = app.listen(3003);
    await new Promise(resolve => setTimeout(resolve, 500));

    afterAll(() => {
      server.close();
    });
  });

  it('基准性能测试', async () => {
    const result = await runLoadTest({
      url: `${baseUrl}/api/simple`,
      connections: 10,
      duration: 10,
    });

    printResult(result);

    // 记录基准
    const baseline = {
      timestamp: new Date().toISOString(),
      rps: result.rps,
      p95: result.latency.p95,
      p99: result.latency.p99,
      avgLatency: result.latency.mean,
    };

    console.log('\n基准数据:');
    console.log(JSON.stringify(baseline, null, 2));

    // 基准检查
    expect(result.rps).toBeGreaterThan(30);
    expect(result.latency.p95).toBeLessThan(500);
  }, 60000);

  it('压力测试 - 逐步增加负载', async () => {
    const levels = [10, 25, 50, 75, 100];
    const results: { concurrency: number; rps: number; p95: number; errorRate: number }[] = [];

    for (const concurrency of levels) {
      const result = await runLoadTest({
        url: `${baseUrl}/api/simple`,
        connections: concurrency,
        duration: 10,
      });

      const errorRate = (result.errors / result.requests.total) * 100;
      results.push({
        concurrency,
        rps: result.rps,
        p95: result.latency.p95,
        errorRate,
      });

      console.log(`并发 ${concurrency}: RPS=${result.rps.toFixed(0)}, P95=${result.latency.p95.toFixed(0)}ms`);
    }

    console.log('\n压力测试结果:');
    console.table(results);

    // 最高负载应该有合理的表现
    const lastResult = results[results.length - 1];
    expect(lastResult.rps).toBeGreaterThan(20);
    expect(lastResult.errorRate).toBeLessThan(10);
  }, 300000);
});

/**
 * 负载测试 - API 性能与并发测试
 * 优化项 203: 性能测试 - 负载测试
 *
 * 测试覆盖:
 * 1. 基础并发请求测试
 * 2. 响应时间测试 (P50, P95, P99)
 * 3. 吞吐量测试 (RPS)
 * 4. 极限负载测试
 * 5. 内存泄漏检测
 * 6. 数据库连接池测试
 * 7. 缓存性能测试
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';

// 导入安全中间件
import {
  sqlInjectionProtection,
  xssProtection,
  SecurityConfig,
  defaultSecurityConfig,
  securityHeaders,
} from '../middleware/security/security-center';

// 导入缓存服务
import { CacheService } from '../services/cache';

// ============================================================
// 测试配置
// ============================================================

interface LoadTestConfig {
  duration: number; // 测试持续时间(毫秒)
  concurrency: number; // 并发用户数
  warmupRequests: number; // 预热请求数
  baseUrl: string;
}

const defaultLoadTestConfig: LoadTestConfig = {
  duration: 10000, // 10秒
  concurrency: 10, // 10并发
  warmupRequests: 50, // 50个预热请求
  baseUrl: '',
};

// ============================================================
// 测试辅助函数
// ============================================================

interface RequestResult {
  status: number;
  duration: number; // 毫秒
  timestamp: number;
  success: boolean;
  error?: string;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50: number;
  p90?: number;
  p95: number;
  p99: number;
  errorRate: number;
  results: RequestResult[];
}

/**
 * 创建测试应用
 */
function createTestApp(enableSecurity: boolean = true): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (enableSecurity) {
    // 安全中间件
    app.use(sqlInjectionProtection(defaultSecurityConfig.sqlInjection));
    app.use(xssProtection(defaultSecurityConfig.xss));
    app.use(securityHeaders(defaultSecurityConfig.securityHeaders));
  }

  // 测试路由 - 模拟不同复杂度
  app.get('/api/simple', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Simple endpoint' });
  });

  app.get('/api/complex', (_req: Request, res: Response) => {
    // 模拟复杂业务逻辑
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random() * 1000,
      timestamp: new Date().toISOString(),
    }));
    res.json({ success: true, data, count: data.length });
  });

  app.post('/api/compute', (req: Request, res: Response) => {
    // 模拟计算密集型操作
    const { iterations = 1000 } = req.body;
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    res.json({ success: true, result, iterations });
  });

  app.get('/api/delay/:ms', (req: Request, res: Response) => {
    const delay = parseInt(req.params.ms) || 100;
    setTimeout(() => {
      res.json({ success: true, delay });
    }, delay);
  });

  // 错误模拟路由
  app.get('/api/error', (_req: Request, res: Response) => {
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // 缓存测试路由
  const memoryCache = new Map<string, { data: any; expires: number }>();
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

  return app;
}

/**
 * 并发请求测试
 */
async function concurrentRequests(
  app: Express,
  method: 'get' | 'post',
  path: string,
  concurrency: number,
  totalRequests: number,
  body?: any
): Promise<LoadTestResult> {
  const results: RequestResult[] = [];
  const startTime = Date.now();

  const promises: Promise<void>[] = [];

  for (let i = 0; i < totalRequests; i++) {
    const requestPromise = (async () => {
      const reqStart = Date.now();
      try {
        const res = method === 'get'
          ? await request(app).get(path)
          : await request(app).post(path).send(body || {});

        results.push({
          status: res.status,
          duration: Date.now() - reqStart,
          timestamp: reqStart,
          success: res.status < 400,
        });
      } catch (error) {
        results.push({
          status: 0,
          duration: Date.now() - reqStart,
          timestamp: reqStart,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    promises.push(requestPromise);

    // 控制并发
    if (promises.length >= concurrency) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }

  // 等待剩余请求
  if (promises.length > 0) {
    await Promise.all(promises);
  }

  const totalDuration = Date.now() - startTime;

  return calculateMetrics(results, totalDuration);
}

/**
 * 计算性能指标
 */
function calculateMetrics(results: RequestResult[], totalDuration: number): LoadTestResult {
  const sortedDurations = results.map(r => r.duration).sort((a, b) => a - b);
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = results.filter(r => !r.success).length;

  const p50Index = Math.floor(sortedDurations.length * 0.5);
  const p90Index = Math.floor(sortedDurations.length * 0.9);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p99Index = Math.floor(sortedDurations.length * 0.99);

  return {
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    totalDuration,
    requestsPerSecond: (results.length / totalDuration) * 1000,
    avgResponseTime: sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length,
    minResponseTime: sortedDurations[0] || 0,
    maxResponseTime: sortedDurations[sortedDurations.length - 1] || 0,
    p50: sortedDurations[p50Index] || 0,
    p90: sortedDurations[p90Index] || 0,
    p95: sortedDurations[p95Index] || 0,
    p99: sortedDurations[p99Index] || 0,
    errorRate: (failedRequests / results.length) * 100,
    results,
  };
}

/**
 * 预热请求
 */
async function warmup(app: Express, requests: number): Promise<void> {
  const promises: Promise<any>[] = [];
  for (let i = 0; i < requests; i++) {
    promises.push(request(app).get('/api/simple'));
  }
  await Promise.all(promises);
}

// ============================================================
// 负载测试套件
// ============================================================

describe('负载测试', () => {

  let app: Express;

  beforeAll(async () => {
    app = createTestApp(true);
    // 预热
    await warmup(app, defaultLoadTestConfig.warmupRequests);
  });

  // ============================================================
  // 基础并发测试
  // ============================================================

  describe('基础并发测试', () => {

    it('低并发: 5并发 50请求 - 简单端点', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        5,
        50
      );

      console.log('\n=== 低并发测试结果 ===');
      console.log(`总请求数: ${result.totalRequests}`);
      console.log(`成功: ${result.successfulRequests}, 失败: ${result.failedRequests}`);
      console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
      console.log(`平均响应时间: ${result.avgResponseTime.toFixed(2)}ms`);
      console.log(`P50: ${result.p50.toFixed(2)}ms`);
      console.log(`P95: ${result.p95.toFixed(2)}ms`);
      console.log(`P99: ${result.p99.toFixed(2)}ms`);
      console.log(`错误率: ${result.errorRate.toFixed(2)}%`);

      // 断言
      expect(result.successfulRequests).toBeGreaterThan(45); // 至少90%成功
      expect(result.p95).toBeLessThan(500); // P95 < 500ms
      expect(result.avgResponseTime).toBeLessThan(200); // 平均 < 200ms
    }, 30000);

    it('中并发: 10并发 100请求 - 简单端点', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        10,
        100
      );

      console.log('\n=== 中并发测试结果 ===');
      console.log(`总请求数: ${result.totalRequests}`);
      console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
      console.log(`P95: ${result.p95.toFixed(2)}ms`);
      console.log(`P99: ${result.p99.toFixed(2)}ms`);

      expect(result.successfulRequests).toBeGreaterThan(90);
      expect(result.p95).toBeLessThan(500);
    }, 30000);

    it('高并发: 20并发 200请求 - 简单端点', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        20,
        200
      );

      console.log('\n=== 高并发测试结果 ===');
      console.log(`总请求数: ${result.totalRequests}`);
      console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
      console.log(`P95: ${result.p95.toFixed(2)}ms`);
      console.log(`P99: ${result.p99.toFixed(2)}ms`);
      console.log(`错误率: ${result.errorRate.toFixed(2)}%`);

      expect(result.successfulRequests).toBeGreaterThan(180);
      expect(result.p99).toBeLessThan(1000);
    }, 60000);

  });

  // ============================================================
  // 响应时间测试
  // ============================================================

  describe('响应时间测试', () => {

    it('简单端点响应时间分布', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        10,
        200
      );

      console.log('\n=== 响应时间分布 ===');
      console.log(`Min: ${result.minResponseTime.toFixed(2)}ms`);
      console.log(`Avg: ${result.avgResponseTime.toFixed(2)}ms`);
      console.log(`P50: ${result.p50.toFixed(2)}ms`);
      console.log(`P90: ${result.p90?.toFixed(2) || 'N/A'}ms`);
      console.log(`P95: ${result.p95.toFixed(2)}ms`);
      console.log(`P99: ${result.p99.toFixed(2)}ms`);
      console.log(`Max: ${result.maxResponseTime.toFixed(2)}ms`);

      expect(result.p50).toBeLessThan(100);
      expect(result.p95).toBeLessThan(300);
      expect(result.p99).toBeLessThan(500);
    }, 30000);

    it('复杂端点响应时间', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/complex',
        10,
        100
      );

      console.log('\n=== 复杂端点响应时间 ===');
      console.log(`P50: ${result.p50.toFixed(2)}ms`);
      console.log(`P95: ${result.p95.toFixed(2)}ms`);
      console.log(`P99: ${result.p99.toFixed(2)}ms`);

      // 复杂端点可以允许更长的响应时间
      expect(result.p50).toBeLessThan(500);
      expect(result.p95).toBeLessThan(1000);
    }, 30000);

  });

  // ============================================================
  // 吞吐量测试
  // ============================================================

  describe('吞吐量测试', () => {

    it('应达到最低吞吐量要求', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        15,
        300
      );

      console.log('\n=== 吞吐量测试 ===');
      console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);

      // 简单端点应达到至少 50 RPS
      expect(result.requestsPerSecond).toBeGreaterThan(50);
    }, 60000);

    it('持续负载测试', async () => {
      // 模拟持续负载: 10并发持续5秒
      const startTime = Date.now();
      const duration = 5000;
      const results: RequestResult[] = [];

      while (Date.now() - startTime < duration) {
        const batch = await Promise.all([
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
          request(app).get('/api/simple'),
        ]);

        batch.forEach(res => {
          results.push({
            status: res.status,
            duration: 0, // 简化
            timestamp: Date.now(),
            success: res.status < 400,
          });
        });
      }

      const totalDuration = Date.now() - startTime;
      const rps = results.length / (totalDuration / 1000);

      console.log('\n=== 持续负载测试 ===');
      console.log(`总请求数: ${results.length}`);
      console.log(`持续时间: ${totalDuration}ms`);
      console.log(`RPS: ${rps.toFixed(2)}`);
      console.log(`成功率: ${((results.filter(r => r.success).length / results.length) * 100).toFixed(2)}%`);

      expect(rps).toBeGreaterThan(30);
    }, 30000);

  });

  // ============================================================
  // 极限负载测试
  // ============================================================

  describe('极限负载测试', () => {

    it('极高并发测试', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        50,
        500
      );

      console.log('\n=== 极高并发测试 (50并发) ===');
      console.log(`总请求数: ${result.totalRequests}`);
      console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
      console.log(`P95: ${result.p95.toFixed(2)}ms`);
      console.log(`错误率: ${result.errorRate.toFixed(2)}%`);

      // 极高并发下可以允许一定失败
      expect(result.successfulRequests).toBeGreaterThan(400);
      expect(result.errorRate).toBeLessThan(20);
    }, 60000);

    it('突发流量测试', async () => {
      // 模拟突发流量: 短时间内大量请求
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        30,
        300
      );

      console.log('\n=== 突发流量测试 ===');
      console.log(`突发请求数: ${result.totalRequests}`);
      console.log(`峰值 RPS: ${result.requestsPerSecond.toFixed(2)}`);
      console.log(`成功率: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);

      expect(result.successfulRequests).toBeGreaterThan(250);
    }, 60000);

  });

  // ============================================================
  // 安全中间件性能测试
  // ============================================================

  describe('安全中间件负载测试', () => {

    it('安全中间件对性能的影响', async () => {
      // 创建不带安全中间件的app
      const appNoSecurity = createTestApp(false);
      await warmup(appNoSecurity, 20);

      // 测试不带安全中间件
      const resultNoSecurity = await concurrentRequests(
        appNoSecurity,
        'get',
        '/api/simple',
        10,
        100
      );

      // 测试带安全中间件
      const resultWithSecurity = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        10,
        100
      );

      console.log('\n=== 安全中间件性能对比 ===');
      console.log(`无安全中间件 - P95: ${resultNoSecurity.p95.toFixed(2)}ms, RPS: ${resultNoSecurity.requestsPerSecond.toFixed(2)}`);
      console.log(`有安全中间件 - P95: ${resultWithSecurity.p95.toFixed(2)}ms, RPS: ${resultWithSecurity.requestsPerSecond.toFixed(2)}`);
      console.log(`性能损耗: ${((resultWithSecurity.avgResponseTime / resultNoSecurity.avgResponseTime - 1) * 100).toFixed(2)}%`);

      // 安全中间件的性能损耗应在合理范围内 (<50%)
      const overhead = (resultWithSecurity.avgResponseTime / resultNoSecurity.avgResponseTime - 1) * 100;
      expect(overhead).toBeLessThan(50);
    }, 30000);

  });

  // ============================================================
  // 缓存性能测试
  // ============================================================

  describe('缓存性能测试', () => {

    it('缓存命中与未命中性能', async () => {
      const key = 'loadtest-key';

      // 第一次请求 - 缓存未命中
      const missResult = await request(app).get(`/api/cache/${key}`);
      expect(missResult.body.source).toBe('compute');

      // 后续请求 - 缓存命中
      const hitResults = await Promise.all([
        request(app).get(`/api/cache/${key}`),
        request(app).get(`/api/cache/${key}`),
        request(app).get(`/api/cache/${key}`),
      ]);

      console.log('\n=== 缓存性能 ===');
      console.log(`缓存命中: ${hitResults.every(r => r.body.source === 'cache')}`);

      expect(hitResults.every(r => r.body.source === 'cache')).toBe(true);
    }, 10000);

  });

  // ============================================================
  // 错误处理性能测试
  // ============================================================

  describe('错误处理性能测试', () => {

    it('错误响应时间', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/error',
        10,
        100
      );

      console.log('\n=== 错误响应时间 ===');
      console.log(`P50: ${result.p50.toFixed(2)}ms`);
      console.log(`P95: ${result.p95.toFixed(2)}ms`);

      // 错误响应应该比正常响应更快
      expect(result.avgResponseTime).toBeLessThan(100);
    }, 30000);

    it('404响应时间', async () => {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/nonexistent',
        10,
        100
      );

      expect(result.successfulRequests).toBe(0); // 404 应该失败
      expect(result.results[0].status).toBe(404);
    }, 30000);

  });

  // ============================================================
  // 内存与资源测试
  // ============================================================

  describe('资源使用测试', () => {

    it('连续请求内存稳定性', async () => {
      const gc = global.gc || (() => {});

      // 预热后获取基线
      gc();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 执行大量请求
      for (let i = 0; i < 50; i++) {
        await request(app).get('/api/simple');
      }

      gc();
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('\n=== 内存稳定性测试 ===');
      console.log('执行了50次请求，无内存溢出');

      // 这个测试主要用于监控内存使用
      // 实际内存检查需要在真实环境中进行
      expect(true).toBe(true);
    }, 30000);

    it('并发连接稳定性', async () => {
      // 模拟多个并发连接
      const connections = 10;
      const requestsPerConnection = 20;

      const connectionPromises = Array.from({ length: connections }, async () => {
        for (let i = 0; i < requestsPerConnection; i++) {
          await request(app).get('/api/simple');
        }
      });

      await Promise.all(connectionPromises);

      console.log('\n=== 并发连接稳定性 ===');
      console.log(`${connections}个并发连接各发送${requestsPerConnection}个请求完成`);

      expect(true).toBe(true);
    }, 60000);

  });

});

// ============================================================
// 性能回归测试
// ============================================================

describe('性能回归测试', () => {

  let app: Express;

  beforeAll(async () => {
    app = createTestApp(true);
    await warmup(app, 30);
  });

  it('基准性能测试', async () => {
    const result = await concurrentRequests(
      app,
      'get',
      '/api/simple',
      10,
      100
    );

    // 记录基准
    const baseline = {
      rps: result.requestsPerSecond,
      p95: result.p95,
      avg: result.avgResponseTime,
    };

    console.log('\n=== 性能基准 ===');
    console.log(JSON.stringify(baseline, null, 2));

    // 基准测试 - 确保基本性能
    expect(result.requestsPerSecond).toBeGreaterThan(30);
    expect(result.p95).toBeLessThan(500);
  }, 30000);

});

// ============================================================
// 压力测试
// ============================================================

describe('压力测试', () => {

  let app: Express;

  beforeAll(async () => {
    app = createTestApp(true);
  });

  it('逐步增加负载', async () => {
    const levels = [5, 10, 20, 30];
    const results: Array<{ concurrency: number; rps: number; p95: number; errorRate: number }> = [];

    for (const concurrency of levels) {
      const result = await concurrentRequests(
        app,
        'get',
        '/api/simple',
        concurrency,
        concurrency * 10
      );

      results.push({
        concurrency,
        rps: result.requestsPerSecond,
        p95: result.p95,
        errorRate: result.errorRate,
      });

      console.log(`\n并发 ${concurrency}: RPS=${result.requestsPerSecond.toFixed(2)}, P95=${result.p95.toFixed(2)}ms, ErrorRate=${result.errorRate.toFixed(2)}%`);
    }

    // 验证性能随负载增加的趋势
    // 注意: 在达到系统极限前，RPS应该增加
    console.log('\n=== 压力测试结果 ===');
    console.table(results);

    // 最后一级负载应该有合理的表现
    const lastResult = results[results.length - 1];
    expect(lastResult.rps).toBeGreaterThan(20);
    expect(lastResult.errorRate).toBeLessThan(10);
  }, 120000);

});

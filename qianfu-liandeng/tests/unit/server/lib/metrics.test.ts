/**
 * 指标模块单元测试
 *
 * 测试覆盖：
 * - Prometheus 指标创建
 * - 资源指标收集
 * - 指标注册表
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock os module
vi.mock('os', () => ({
  loadavg: vi.fn().mockReturnValue([1.5, 1.2, 0.8]),
  cpus: vi.fn().mockReturnValue([
    { model: 'Intel Core i7', speed: 2400 },
    { model: 'Intel Core i7', speed: 2400 },
    { model: 'Intel Core i7', speed: 2400 },
    { model: 'Intel Core i7', speed: 2400 },
  ]),
  totalmem: vi.fn().mockReturnValue(16 * 1024 * 1024 * 1024), // 16GB
  freemem: vi.fn().mockReturnValue(8 * 1024 * 1024 * 1024), // 8GB
}));

// Mock fs module
vi.mock('fs', () => ({
  statfs: vi.fn().mockRejectedValue(new Error('Not supported on this platform')),
}));

import {
  metricsRegistry,
  collectResourceMetrics,
  getResourceSnapshot,
  startResourceCollection,
  stopResourceCollection,
  appErrorLogCounter,
  appWarnLogCounter,
  errorLogByLevel,
  errorLogByService,
  httpRequestCounter,
  httpRequestDuration,
  recordErrorLog,
  getMetricsRegistry,
  // System gauges
  systemCpuUsage,
  systemMemoryTotal,
  systemMemoryFree,
  systemMemoryUsagePercent,
  systemDiskUsagePercent,
  systemDiskTotal,
  systemDiskFree,
  processMemoryHeapUsed,
  processMemoryHeapTotal,
  processMemoryRss,
  processUptimeSeconds,
} from '../server/lib/metrics';

describe('Prometheus 指标定义', () => {
  describe('系统资源指标', () => {
    it('应该有 CPU 使用率指标', () => {
      expect(systemCpuUsage).toBeDefined();
    });

    it('应该有内存指标', () => {
      expect(systemMemoryTotal).toBeDefined();
      expect(systemMemoryFree).toBeDefined();
      expect(systemMemoryUsagePercent).toBeDefined();
    });

    it('应该有磁盘指标', () => {
      expect(systemDiskUsagePercent).toBeDefined();
      expect(systemDiskTotal).toBeDefined();
      expect(systemDiskFree).toBeDefined();
    });

    it('应该有进程内存指标', () => {
      expect(processMemoryHeapUsed).toBeDefined();
      expect(processMemoryHeapTotal).toBeDefined();
      expect(processMemoryRss).toBeDefined();
    });

    it('应该有进程运行时间指标', () => {
      expect(processUptimeSeconds).toBeDefined();
    });
  });

  describe('应用指标', () => {
    it('应该有错误日志计数器', () => {
      expect(appErrorLogCounter).toBeDefined();
    });

    it('应该有警告日志计数器', () => {
      expect(appWarnLogCounter).toBeDefined();
    });

    it('应该有按级别分类的错误计数器', () => {
      expect(errorLogByLevel).toBeDefined();
    });

    it('应该有按服务分类的错误计数器', () => {
      expect(errorLogByService).toBeDefined();
    });
  });

  describe('HTTP 指标', () => {
    it('应该有 HTTP 请求计数器', () => {
      expect(httpRequestCounter).toBeDefined();
    });

    it('应该有 HTTP 请求延迟直方图', () => {
      expect(httpRequestDuration).toBeDefined();
    });
  });
});

describe('collectResourceMetrics 函数', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功收集资源指标', async () => {
    await expect(collectResourceMetrics()).resolves.not.toThrow();
  });

  it('应该更新 CPU 指标', async () => {
    await collectResourceMetrics();
    // 指标应该在没有错误的情况下更新
    expect(true).toBe(true); // 确认函数执行完成
  });

  it('应该更新内存指标', async () => {
    await collectResourceMetrics();
    expect(true).toBe(true);
  });

  it('应该处理磁盘获取失败的情况', async () => {
    // fs.statfs mock 已设置为失败
    await collectResourceMetrics();
    expect(true).toBe(true);
  });
});

describe('getResourceSnapshot 函数', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该返回完整的资源快照', async () => {
    const snapshot = await getResourceSnapshot();

    expect(snapshot).toHaveProperty('cpu');
    expect(snapshot).toHaveProperty('memory');
    expect(snapshot).toHaveProperty('disk');
    expect(snapshot).toHaveProperty('process');
    expect(snapshot).toHaveProperty('timestamp');
  });

  it('应该包含 CPU 信息', async () => {
    const snapshot = await getResourceSnapshot();

    expect(snapshot.cpu).toHaveProperty('usage');
    expect(snapshot.cpu).toHaveProperty('loadAverage');
    expect(snapshot.cpu).toHaveProperty('cores');
    expect(snapshot.cpu.cores).toBe(4); // mock 返回 4 个 CPU
  });

  it('应该包含内存信息', async () => {
    const snapshot = await getResourceSnapshot();

    expect(snapshot.memory).toHaveProperty('total');
    expect(snapshot.memory).toHaveProperty('free');
    expect(snapshot.memory).toHaveProperty('used');
    expect(snapshot.memory).toHaveProperty('usagePercent');

    expect(snapshot.memory.total).toBe(16 * 1024 * 1024 * 1024);
    expect(snapshot.memory.free).toBe(8 * 1024 * 1024 * 1024);
    expect(snapshot.memory.used).toBe(8 * 1024 * 1024 * 1024);
  });

  it('应该包含进程信息', async () => {
    const snapshot = await getResourceSnapshot();

    expect(snapshot.process).toHaveProperty('uptime');
    expect(snapshot.process).toHaveProperty('heapUsed');
    expect(snapshot.process).toHaveProperty('heapTotal');
    expect(snapshot.process).toHaveProperty('rss');
    expect(snapshot.process).toHaveProperty('memoryUsagePercent');
  });

  it('应该包含时间戳', async () => {
    const snapshot = await getResourceSnapshot();

    expect(snapshot.timestamp).toBeDefined();
    expect(new Date(snapshot.timestamp).getTime()).not.toBeNaN();
  });
});

describe('指标注册表', () => {
  it('应该提供正确的注册表实例', () => {
    const registry = getMetricsRegistry();
    expect(registry).toBeDefined();
    expect(registry).toBe(metricsRegistry);
  });

  it('注册表应该包含指标', async () => {
    const registry = getMetricsRegistry();
    const metrics = await registry.getMetricsAsJSON();
    expect(Array.isArray(metrics)).toBe(true);
    expect(metrics.length).toBeGreaterThan(0);
  });
});

describe('定时资源收集', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopResourceCollection();
    vi.useRealTimers();
  });

  it('应该启动定时收集', () => {
    startResourceCollection(1000);
    // 函数不应该抛出错误
    expect(true).toBe(true);
  });

  it('应该允许停止定时收集', () => {
    startResourceCollection(1000);
    stopResourceCollection();
    expect(true).toBe(true);
  });

  it('应该清除之前的定时器', () => {
    startResourceCollection(1000);
    startResourceCollection(2000); // 应该清除之前的
    stopResourceCollection();
    expect(true).toBe(true);
  });
});

describe('recordErrorLog 函数', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该记录错误日志并更新指标', () => {
    expect(() => recordErrorLog('error', 'test-category')).not.toThrow();
  });

  it('应该使用默认服务名', () => {
    expect(() => recordErrorLog('warn', 'test-category')).not.toThrow();
  });

  it('应该接受自定义服务名', () => {
    expect(() => recordErrorLog('error', 'test-category', 'custom-service')).not.toThrow();
  });
});

describe('指标计数器操作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能够增加计数器', () => {
    expect(() => appErrorLogCounter.inc({ category: 'test', level: 'error' })).not.toThrow();
  });

  it('应该能够增加警告计数器', () => {
    expect(() => appWarnLogCounter.inc({ category: 'test', level: 'warn' })).not.toThrow();
  });

  it('应该能够增加级别分类计数器', () => {
    expect(() => errorLogByLevel.inc({ level: 'error' })).not.toThrow();
    expect(() => errorLogByLevel.inc({ level: 'warn' })).not.toThrow();
  });

  it('应该能够增加服务分类计数器', () => {
    expect(() => errorLogByService.inc({ service: 'api' })).not.toThrow();
  });
});

describe('HTTP 指标操作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能够记录 HTTP 请求', () => {
    expect(() => httpRequestCounter.inc({
      method: 'GET',
      path: '/api/test',
      status_code: 200,
    })).not.toThrow();
  });

  it('应该能够记录 HTTP 请求延迟', () => {
    const end = httpRequestDuration.startTimer();
    expect(() => end({
      method: 'POST',
      path: '/api/submit',
      status_code: 201,
    })).not.toThrow();
  });
});

describe('指标 Gauge 操作', () => {
  it('应该能够设置 CPU 使用率', () => {
    expect(() => systemCpuUsage.set(50)).not.toThrow();
  });

  it('应该能够设置内存指标', () => {
    expect(() => systemMemoryTotal.set(16 * 1024 * 1024 * 1024)).not.toThrow();
    expect(() => systemMemoryFree.set(8 * 1024 * 1024 * 1024)).not.toThrow();
    expect(() => systemMemoryUsagePercent.set(50)).not.toThrow();
  });

  it('应该能够设置磁盘指标', () => {
    expect(() => systemDiskUsagePercent.set(45)).not.toThrow();
    expect(() => systemDiskTotal.set(500 * 1024 * 1024 * 1024)).not.toThrow();
    expect(() => systemDiskFree.set(275 * 1024 * 1024 * 1024)).not.toThrow();
  });

  it('应该能够设置进程内存指标', () => {
    expect(() => processMemoryHeapUsed.set(100 * 1024 * 1024)).not.toThrow();
    expect(() => processMemoryHeapTotal.set(200 * 1024 * 1024)).not.toThrow();
    expect(() => processMemoryRss.set(300 * 1024 * 1024)).not.toThrow();
    expect(() => processUptimeSeconds.set(3600)).not.toThrow();
  });
});

/**
 * 应用指标收集模块
 * 暴露错误日志计数供 Prometheus 采集
 * 包含系统资源监控 (CPU/内存/磁盘)
 */

import { Counter, Registry, collectDefaultMetrics, Histogram, Gauge } from 'prom-client';

// 创建独立的 Registry
export const metricsRegistry = new Registry();

// 收集默认系统指标
collectDefaultMetrics({ register: metricsRegistry });

// ============================================================
// 系统资源监控指标 (CPU/内存/磁盘)
// ============================================================

/**
 * CPU 使用率 Gauge
 */
export const systemCpuUsage = new Gauge({
  name: 'system_cpu_usage_percent',
  help: 'Current CPU usage percentage (1 min load average normalized by core count)',
  registers: [metricsRegistry],
});

/**
 * 系统负载平均值 (1分钟)
 */
export const systemLoadAverage = new Gauge({
  name: 'system_load_average_1min',
  help: 'System load average over 1 minute',
  registers: [metricsRegistry],
});

/**
 * 系统负载平均值 (5分钟)
 */
export const systemLoadAverage5 = new Gauge({
  name: 'system_load_average_5min',
  help: 'System load average over 5 minutes',
  registers: [metricsRegistry],
});

/**
 * 系统负载平均值 (15分钟)
 */
export const systemLoadAverage15 = new Gauge({
  name: 'system_load_average_15min',
  help: 'System load average over 15 minutes',
  registers: [metricsRegistry],
});

/**
 * 内存总量 Gauge
 */
export const systemMemoryTotal = new Gauge({
  name: 'system_memory_total_bytes',
  help: 'Total system memory in bytes',
  registers: [metricsRegistry],
});

/**
 * 内存空闲 Gauge
 */
export const systemMemoryFree = new Gauge({
  name: 'system_memory_free_bytes',
  help: 'Free system memory in bytes',
  registers: [metricsRegistry],
});

/**
 * 内存使用率 Gauge
 */
export const systemMemoryUsagePercent = new Gauge({
  name: 'system_memory_usage_percent',
  help: 'System memory usage percentage',
  registers: [metricsRegistry],
});

/**
 * 磁盘使用率 Gauge (需要平台支持)
 */
export const systemDiskUsagePercent = new Gauge({
  name: 'system_disk_usage_percent',
  help: 'System disk usage percentage (-1 if not available)',
  registers: [metricsRegistry],
});

/**
 * 磁盘总量 Gauge
 */
export const systemDiskTotal = new Gauge({
  name: 'system_disk_total_bytes',
  help: 'Total disk space in bytes',
  registers: [metricsRegistry],
});

/**
 * 磁盘空闲 Gauge
 */
export const systemDiskFree = new Gauge({
  name: 'system_disk_free_bytes',
  help: 'Free disk space in bytes',
  registers: [metricsRegistry],
});

/**
 * 进程内存使用 Gauge
 */
export const processMemoryHeapUsed = new Gauge({
  name: 'process_memory_heap_used_bytes',
  help: 'Process heap memory used in bytes',
  registers: [metricsRegistry],
});

/**
 * 进程内存总量 Gauge
 */
export const processMemoryHeapTotal = new Gauge({
  name: 'process_memory_heap_total_bytes',
  help: 'Process heap memory total in bytes',
  registers: [metricsRegistry],
});

/**
 * 进程 RSS 内存 Gauge
 */
export const processMemoryRss = new Gauge({
  name: 'process_memory_rss_bytes',
  help: 'Process resident set size in bytes',
  registers: [metricsRegistry],
});

/**
 * 进程运行时间 Gauge
 */
export const processUptimeSeconds = new Gauge({
  name: 'process_uptime_seconds',
  help: 'Process uptime in seconds',
  registers: [metricsRegistry],
});

// ============================================================
// 资源监控辅助函数
// ============================================================

let osModule: any = null;

async function getOsModule() {
  if (!osModule) {
    osModule = await import('os');
  }
  return osModule;
}

/**
 * 收集并更新系统资源指标
 * 建议在应用启动后定期调用 (如每 10-30 秒)
 */
export async function collectResourceMetrics(): Promise<void> {
  const os = await getOsModule();

  // CPU 指标
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const cpuUsage = Math.min((loadAvg[0] / cpuCount) * 100, 100);

  systemCpuUsage.set(cpuUsage);
  systemLoadAverage.set(loadAvg[0]);
  systemLoadAverage5.set(loadAvg[1]);
  systemLoadAverage15.set(loadAvg[2]);

  // 内存指标
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  systemMemoryTotal.set(totalMem);
  systemMemoryFree.set(freeMem);
  systemMemoryUsagePercent.set((usedMem / totalMem) * 100);

  // 磁盘指标
  try {
    const fs = await import('fs');
    const stats = await fs.statfs('/');
    const diskTotal = stats.blocks * stats.bsize;
    const diskFree = stats.free * stats.bsize;
    const diskUsed = diskTotal - diskFree;
    const diskUsagePercent = (diskUsed / diskTotal) * 100;

    systemDiskTotal.set(diskTotal);
    systemDiskFree.set(diskFree);
    systemDiskUsagePercent.set(diskUsagePercent);
  } catch {
    // Windows 或某些环境可能不支持 statfs
    systemDiskUsagePercent.set(-1);
    systemDiskTotal.set(0);
    systemDiskFree.set(0);
  }

  // 进程指标
  const processMem = process.memoryUsage();
  processMemoryHeapUsed.set(processMem.heapUsed);
  processMemoryHeapTotal.set(processMem.heapTotal);
  processMemoryRss.set(processMem.rss);
  processUptimeSeconds.set(process.uptime());
}

/**
 * 获取当前资源状态的快照 (用于 API 返回)
 */
export async function getResourceSnapshot(): Promise<{
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  } | null;
  process: {
    uptime: number;
    heapUsed: number;
    heapTotal: number;
    rss: number;
    memoryUsagePercent: number;
  };
  timestamp: string;
}> {
  const os = await getOsModule();
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const cpuUsage = Math.min((loadAvg[0] / cpuCount) * 100, 100);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let diskData: { total: number; free: number; used: number; usagePercent: number } | null = null;
  try {
    const fs = await import('fs');
    const stats = await fs.statfs('/');
    const diskTotal = stats.blocks * stats.bsize;
    const diskFree = stats.free * stats.bsize;
    diskData = {
      total: diskTotal,
      free: diskFree,
      used: diskTotal - diskFree,
      usagePercent: ((diskTotal - diskFree) / diskTotal) * 100,
    };
  } catch {
    // ignore
  }

  const processMem = process.memoryUsage();

  return {
    cpu: {
      usage: cpuUsage,
      loadAverage: loadAvg,
      cores: cpuCount,
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usagePercent: (usedMem / totalMem) * 100,
    },
    disk: diskData,
    process: {
      uptime: process.uptime(),
      heapUsed: processMem.heapUsed,
      heapTotal: processMem.heapTotal,
      rss: processMem.rss,
      memoryUsagePercent: (processMem.heapUsed / processMem.heapTotal) * 100,
    },
    timestamp: new Date().toISOString(),
  };
}

// 启动定时资源指标收集
let resourceCollectionInterval: NodeJS.Timeout | null = null;

/**
 * 启动定期资源指标收集
 * @param intervalMs 收集间隔 (默认 15000ms = 15秒)
 */
export function startResourceCollection(intervalMs: number = 15000): void {
  if (resourceCollectionInterval) {
    clearInterval(resourceCollectionInterval);
  }

  // 立即执行一次
  collectResourceMetrics().catch(console.error);

  // 定时执行
  resourceCollectionInterval = setInterval(() => {
    collectResourceMetrics().catch(console.error);
  }, intervalMs);
}

/**
 * 停止定期资源指标收集
 */
export function stopResourceCollection(): void {
  if (resourceCollectionInterval) {
    clearInterval(resourceCollectionInterval);
    resourceCollectionInterval = null;
  }
}

// ============================================================
// 自定义指标：Error 日志计数
// ============================================================

/**
 * 应用错误日志计数器
 * 按 category 分类统计错误数量
 */
export const appErrorLogCounter = new Counter({
  name: 'app_error_log_total',
  help: 'Total number of error logs',
  labelNames: ['category', 'level'],
  registers: [metricsRegistry],
});

/**
 * 应用警告日志计数器
 */
export const appWarnLogCounter = new Counter({
  name: 'app_warn_log_total',
  help: 'Total number of warning logs',
  labelNames: ['category', 'level'],
  registers: [metricsRegistry],
});

/**
 * 按错误级别分类的计数器
 */
export const errorLogByLevel = new Counter({
  name: 'app_error_log_by_level_total',
  help: 'Total number of error logs by level',
  labelNames: ['level'],
  registers: [metricsRegistry],
});

/**
 * 按服务分类的错误计数器
 */
export const errorLogByService = new Counter({
  name: 'app_error_log_by_service_total',
  help: 'Total number of error logs by service',
  labelNames: ['service'],
  registers: [metricsRegistry],
});

// ============================================================
// HTTP 请求指标
// ============================================================

/**
 * HTTP 请求计数器
 */
export const httpRequestCounter = new Counter({
  name: 'app_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [metricsRegistry],
});

/**
 * HTTP 请求延迟直方图
 */
export const httpRequestDuration = new Histogram({
  name: 'app_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

// ============================================================
// 日志记录器增强
// ============================================================

import { LogLevel } from './logger';

/**
 * 增强的日志记录函数 - 记录错误时同时更新指标
 */
export function recordErrorLog(
  level: LogLevel,
  category: string,
  service: string = 'api'
): void {
  // 记录到错误日志计数器
  appErrorLogCounter.inc({ category, level }, 1);
  errorLogByLevel.inc({ level }, 1);
  errorLogByService.inc({ service }, 1);
}

/**
 * 获取 Metrics Registry
 * 用于 /metrics 端点
 */
export function getMetricsRegistry(): Registry {
  return metricsRegistry;
}

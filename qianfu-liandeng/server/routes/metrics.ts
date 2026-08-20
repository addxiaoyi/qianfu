/**
 * Metrics 端点路由
 * 暴露 /metrics 供 Prometheus 采集
 * 包含 /metrics/resources 资源监控端点
 */

import { Router, Request, Response } from 'express';
import { getMetricsRegistry, getResourceSnapshot, collectResourceMetrics } from '../lib/metrics';

const router = Router();

/**
 * GET /metrics
 * 返回 Prometheus 格式的指标数据
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const registry = getMetricsRegistry();
    res.set('Content-Type', registry.contentType);
    const metrics = await registry.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
});

/**
 * GET /metrics/resources
 * 返回系统资源监控数据 (CPU/内存/磁盘) - JSON 格式
 */
router.get('/metrics/resources', async (_req: Request, res: Response) => {
  try {
    // 立即收集最新指标
    await collectResourceMetrics();

    // 获取资源快照
    const snapshot = await getResourceSnapshot();

    // 添加告警阈值和状态
    const thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 75, critical: 90 },
    };

    const status = {
      cpu: snapshot.cpu.usage >= thresholds.cpu.critical ? 'critical'
         : snapshot.cpu.usage >= thresholds.cpu.warning ? 'warning'
         : 'healthy',
      memory: snapshot.memory.usagePercent >= thresholds.memory.critical ? 'critical'
            : snapshot.memory.usagePercent >= thresholds.memory.warning ? 'warning'
            : 'healthy',
      disk: snapshot.disk
        ? (snapshot.disk.usagePercent >= thresholds.disk.critical ? 'critical'
          : snapshot.disk.usagePercent >= thresholds.disk.warning ? 'warning'
          : 'healthy')
        : 'unknown',
    };

    res.json({
      resources: snapshot,
      thresholds,
      status,
    });
  } catch (error) {
    console.error('Failed to collect resource metrics:', error);
    res.status(500).json({ error: 'Failed to collect resource metrics' });
  }
});

/**
 * GET /metrics/resources/simple
 * 返回简化的资源监控数据 (仅关键指标)
 */
router.get('/metrics/resources/simple', async (_req: Request, res: Response) => {
  try {
    const snapshot = await getResourceSnapshot();

    res.json({
      cpu: {
        usage: Math.round(snapshot.cpu.usage * 100) / 100,
        loadAvg: snapshot.cpu.loadAverage.map(v => Math.round(v * 100) / 100),
      },
      memory: {
        used: Math.round(snapshot.memory.used / 1024 / 1024 / 1024 * 100) / 100, // GB
        total: Math.round(snapshot.memory.total / 1024 / 1024 / 1024 * 100) / 100, // GB
        percent: Math.round(snapshot.memory.usagePercent * 100) / 100,
      },
      disk: snapshot.disk ? {
        used: Math.round(snapshot.disk.used / 1024 / 1024 / 1024 * 100) / 100, // GB
        total: Math.round(snapshot.disk.total / 1024 / 1024 / 1024 * 100) / 100, // GB
        percent: Math.round(snapshot.disk.usagePercent * 100) / 100,
      } : null,
      status: {
        cpu: snapshot.cpu.usage >= 90 ? 'critical' : snapshot.cpu.usage >= 70 ? 'warning' : 'healthy',
        memory: snapshot.memory.usagePercent >= 95 ? 'critical' : snapshot.memory.usagePercent >= 80 ? 'warning' : 'healthy',
      },
      timestamp: snapshot.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect resource metrics' });
  }
});

/**
 * GET /health/metrics
 * 健康检查路由（可选）
 */
router.get('/health/metrics', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    metrics: 'enabled',
    timestamp: new Date().toISOString(),
  });
});

export default router;

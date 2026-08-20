/**
 * Metrics API E2E 测试
 * 优化项 202: 集成测试 - API端到端
 *
 * 测试覆盖：
 * - Prometheus 格式指标
 * - 资源监控数据
 * - 健康检查
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './api-helpers';

const BASE_URL = TEST_CONFIG.baseUrl;

test.describe('Metrics API E2E 测试', () => {
  // ==================== Prometheus 格式指标 ====================

  test.describe('Prometheus 格式指标', () => {
    test('应该返回Prometheus格式的指标', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics`);

      expect(response.status()).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });

    test('指标应该包含标准格式', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics`);

      expect(response.status()).toBe(200);
      const body = await response.text();

      // Prometheus格式检查
      // 应该有HELP和TYPE注释
      expect(body).toMatch(/^# HELP/m);
      expect(body).toMatch(/^# TYPE/m);
    });
  });

  // ==================== 资源监控 ====================

  test.describe('资源监控', () => {
    test('应该返回完整的资源数据', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources`);

      expect(response.status()).toBe(200);
      expect(response.body).toHaveProperty('resources');

      const { resources } = response.body;

      // CPU 指标
      expect(resources).toHaveProperty('cpu');
      expect(resources.cpu).toHaveProperty('usage');

      // 内存指标
      expect(resources).toHaveProperty('memory');
      expect(resources.memory).toHaveProperty('used');
      expect(resources.memory).toHaveProperty('total');
      expect(resources.memory).toHaveProperty('usagePercent');

      // 磁盘指标（可能为空）
      if (resources.disk) {
        expect(resources.disk).toHaveProperty('used');
        expect(resources.disk).toHaveProperty('total');
      }
    });

    test('应该包含告警阈值', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources`);

      expect(response.status()).toBe(200);
      expect(response.body).toHaveProperty('thresholds');

      const { thresholds } = response.body;

      expect(thresholds).toHaveProperty('cpu');
      expect(thresholds).toHaveProperty('memory');
      expect(thresholds).toHaveProperty('disk');

      // 阈值应该包含 warning 和 critical
      expect(thresholds.cpu).toHaveProperty('warning');
      expect(thresholds.cpu).toHaveProperty('critical');
    });

    test('应该包含资源状态', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources`);

      expect(response.status()).toBe(200);
      expect(response.body).toHaveProperty('status');

      const { status } = response.body;

      // 状态值应该是 known 的值
      const validStatuses = ['healthy', 'warning', 'critical', 'unknown'];

      if (status.cpu) {
        expect(validStatuses).toContain(status.cpu);
      }
      if (status.memory) {
        expect(validStatuses).toContain(status.memory);
      }
    });
  });

  // ==================== 简化资源数据 ====================

  test.describe('简化资源数据', () => {
    test('应该返回简化的资源指标', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources/simple`);

      expect(response.status()).toBe(200);

      // 简化格式检查
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('CPU数据应该包含使用率和负载', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources/simple`);

      expect(response.status()).toBe(200);
      expect(response.body.cpu).toHaveProperty('usage');
      expect(response.body.cpu).toHaveProperty('loadAvg');

      expect(typeof response.body.cpu.usage).toBe('number');
      expect(Array.isArray(response.body.cpu.loadAvg)).toBe(true);
    });

    test('内存数据应该使用GB单位', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources/simple`);

      expect(response.status()).toBe(200);
      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('percent');

      // 数值应该合理（以GB为单位）
      expect(response.body.memory.used).toBeLessThan(100);
      expect(response.body.memory.total).toBeLessThan(100);
    });

    test('磁盘数据可能为空', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources/simple`);

      expect(response.status()).toBe(200);
      // 磁盘数据可能为 null
      expect(response.body.disk === null || response.body.disk).toBeTruthy();
    });

    test('状态应该反映实际使用情况', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources/simple`);

      expect(response.status()).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toHaveProperty('cpu');
      expect(response.body.status).toHaveProperty('memory');

      // 状态值应该是 known 的值
      const validStatuses = ['healthy', 'warning', 'critical'];

      expect(validStatuses).toContain(response.body.status.cpu);
      expect(validStatuses).toContain(response.body.status.memory);
    });
  });

  // ==================== 健康检查 ====================

  test.describe('健康检查', () => {
    test('应该返回metrics健康状态', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/health/metrics`);

      expect(response.status()).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.metrics).toBe('enabled');
    });

    test('应该包含时间戳', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/health/metrics`);

      expect(response.status()).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  // ==================== 错误处理 ====================

  test.describe('错误处理', () => {
    test('应该处理无效路径', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/invalid-path`);

      // 应该返回404
      expect(response.status()).toBe(404);
    });

    test('POST到metrics端点应该被拒绝', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/metrics`).send({});

      // 应该返回405 Method Not Allowed
      expect([405, 404]).toContain(response.status());
    });
  });

  // ==================== 性能基准 ====================

  test.describe('性能基准', () => {
    test('metrics端点应该快速响应', async ({ request }) => {
      const start = Date.now();

      const response = await request.get(`${BASE_URL}/metrics`);

      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000); // 1秒内响应
    });

    test('资源监控端点应该快速响应', async ({ request }) => {
      const start = Date.now();

      const response = await request.get(`${BASE_URL}/metrics/resources/simple`);

      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(2000); // 2秒内响应
    });
  });

  // ==================== 数据一致性 ====================

  test.describe('数据一致性', () => {
    test('完整数据和简化数据应该一致', async ({ request }) => {
      const fullResponse = await request.get(`${BASE_URL}/metrics/resources`);
      const simpleResponse = await request.get(`${BASE_URL}/metrics/resources/simple`);

      expect(fullResponse.status()).toBe(200);
      expect(simpleResponse.status()).toBe(200);

      // 简化数据的值应该从完整数据中提取
      expect(simpleResponse.body.cpu.usage).toBeCloseTo(
        fullResponse.body.resources.cpu.usage,
        1
      );
    });

    test('时间戳应该在合理范围内', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/metrics/resources/simple`);

      expect(response.status()).toBe(200);
      expect(response.body.timestamp).toBeDefined();

      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      const diff = Math.abs(now.getTime() - timestamp.getTime());

      // 时间戳应该在当前时间的前后几分钟内
      expect(diff).toBeLessThan(5 * 60 * 1000); // 5分钟
    });
  });
});

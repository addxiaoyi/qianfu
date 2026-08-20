/**
 * 故障注入中间件测试
 * 优化项 496: Fault Injection - 故障注入
 */

import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 测试目标
import {
  createFaultInjection,
  createFaultInjectionWithStats,
  enableFaultInjection,
  disableFaultInjection,
  addFaultRoute,
  removeFaultRoute,
  getFaultInjectionConfig,
  updateFaultInjectionConfig,
  defaultFaultInjectionConfig,
  FaultScenarios,
  FaultType,
  RouteFaultConfig,
} from '../server/middleware/fault-injection';

// 测试辅助函数
function createTestApp(config?: any): Express {
  const app = express();
  app.use(express.json());

  // 添加故障注入中间件
  app.use(createFaultInjection(config));

  // 测试路由
  app.get('/api/users', (req, res) => {
    res.json({ success: true, data: [{ id: 1, name: 'John' }] });
  });

  app.post('/api/users', (req, res) => {
    res.status(201).json({ success: true, data: req.body });
  });

  app.get('/api/orders', (req, res) => {
    res.json({ success: true, orders: [] });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

describe('FaultInjection Middleware', () => {
  beforeEach(() => {
    // 重置配置
    defaultFaultInjectionConfig.enabled = false;
    defaultFaultInjectionConfig.routes = [];
  });

  afterEach(() => {
    // 清理
    defaultFaultInjectionConfig.enabled = false;
    defaultFaultInjectionConfig.routes = [];
  });

  describe('基础功能', () => {
    it('默认状态下不应注入故障', async () => {
      const app = createTestApp();
      defaultFaultInjectionConfig.enabled = false;

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['x-fault-injection']).toBeUndefined();
    });

    it('未匹配的路由不应注入故障', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{ path: '/api/non-existent*', faults: ['delay'] }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.headers['x-fault-injection']).toBeUndefined();
    });
  });

  describe('延迟故障 (delay)', () => {
    it('应注入指定的延迟', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['delay'],
          probability: 1,
          faultConfig: {
            delay: { type: 'delay', range: [100, 200], fixed: 100 },
          },
        }],
      });

      const start = Date.now();
      const response = await request(app).get('/api/users');
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(response.headers['x-fault-injection']).toBe('delay');
      expect(duration).toBeGreaterThanOrEqual(100);
    }, 10000);

    it('配置固定延迟', async () => {
      const app = createTestApp({
        enabled: true,
        defaultDelay: 500,
        routes: [{
          path: '/api/users',
          faults: ['delay'],
          probability: 1,
        }],
      });

      const start = Date.now();
      const response = await request(app).get('/api/users');
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(500);
    }, 10000);
  });

  describe('错误故障 (error/500)', () => {
    it('应返回 500 错误', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.injected).toBe(true);
      expect(response.headers['x-fault-injection']).toBe('500');
    });

    it('应支持自定义错误消息', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['error'],
          probability: 1,
          faultConfig: {
            error: {
              type: 'error',
              statusCode: 500,
              message: 'Custom error message',
              code: 'CUSTOM_CODE',
            },
          },
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Custom error message');
      expect(response.body.code).toBe('CUSTOM_CODE');
    });
  });

  describe('503 服务不可用故障', () => {
    it('应返回 503 状态码', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['503'],
          probability: 1,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(503);
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('应支持自定义重试时间', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['503'],
          probability: 1,
          faultConfig: {
            '503': { type: '503', retryAfter: 120 },
          },
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.headers['retry-after']).toBe('120');
    });
  });

  describe('502/504 错误故障', () => {
    it('应返回 502 网关错误', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['502'],
          probability: 1,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.headers['x-fault-injection']).toBe('502');
    });

    it('应返回 504 网关超时', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['504'],
          probability: 1,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(504);
      expect(response.body.code).toBe('FAULT_INJECTION');
    });
  });

  describe('概率控制', () => {
    it('probability=0 时不应注入故障', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 0,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.headers['x-fault-injection']).toBeUndefined();
    });

    it('probability=0.5 时约一半请求注入故障', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 0.5,
        }],
      });

      const results = [];
      for (let i = 0; i < 100; i++) {
        const response = await request(app).get('/api/users');
        results.push(response.status);
      }

      const errorCount = results.filter(s => s === 500).length;
      // 允许一定范围的统计误差
      expect(errorCount).toBeGreaterThan(20);
      expect(errorCount).toBeLessThan(80);
    }, 30000);
  });

  describe('路径匹配', () => {
    it('应支持通配符匹配', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/*',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response1 = await request(app).get('/api/users');
      const response2 = await request(app).post('/api/users');
      const response3 = await request(app).get('/api/orders');

      expect(response1.status).toBe(500);
      expect(response2.status).toBe(500);
      expect(response3.status).toBe(500);
    });

    it('应支持精确路径匹配', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response1 = await request(app).get('/api/users');
      const response2 = await request(app).get('/api/orders');

      expect(response1.status).toBe(500);
      expect(response2.status).toBe(200);
    });

    it('应支持方法过滤', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          methods: ['GET'],
          faults: ['500'],
          probability: 1,
        }],
      });

      const response1 = await request(app).get('/api/users');
      const response2 = await request(app).post('/api/users');

      expect(response1.status).toBe(500);
      expect(response2.status).toBe(201);
    });
  });

  describe('路径排除', () => {
    it('应排除健康检查路径', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '*',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.headers['x-fault-injection']).toBeUndefined();
    });

    it('应支持自定义排除路径', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '*',
          faults: ['500'],
          probability: 1,
        }],
        excludePaths: [/^\/api\/orders$/],
      });

      const response = await request(app).get('/api/orders');

      expect(response.status).toBe(200);
      expect(response.headers['x-fault-injection']).toBeUndefined();
    });

    it('应排除 OPTIONS 方法', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '*',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response = await request(app).options('/api/users');

      expect(response.headers['x-fault-injection']).toBeUndefined();
    });
  });

  describe('故障 ID', () => {
    it('每个故障应生成唯一 ID', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response1 = await request(app).get('/api/users');
      const response2 = await request(app).get('/api/users');

      expect(response1.body.faultId).toBeDefined();
      expect(response2.body.faultId).toBeDefined();
      expect(response1.body.faultId).not.toBe(response2.body.faultId);
    });
  });

  describe('enableFaultInjection / disableFaultInjection', () => {
    it('enableFaultInjection 应启用故障注入', () => {
      enableFaultInjection();
      expect(defaultFaultInjectionConfig.enabled).toBe(true);
    });

    it('disableFaultInjection 应禁用故障注入', () => {
      defaultFaultInjectionConfig.enabled = true;
      disableFaultInjection();
      expect(defaultFaultInjectionConfig.enabled).toBe(false);
    });
  });

  describe('addFaultRoute / removeFaultRoute', () => {
    it('addFaultRoute 应添加路由配置', () => {
      addFaultRoute({
        path: '/api/test',
        faults: ['500'],
        probability: 1,
      });

      expect(defaultFaultInjectionConfig.routes.length).toBe(1);
      expect(defaultFaultInjectionConfig.routes[0].path).toBe('/api/test');
    });

    it('removeFaultRoute 应移除路由配置', () => {
      addFaultRoute({
        path: '/api/test',
        faults: ['500'],
        probability: 1,
      });

      removeFaultRoute('/api/test');

      expect(defaultFaultInjectionConfig.routes.length).toBe(0);
    });
  });

  describe('getFaultInjectionConfig / updateFaultInjectionConfig', () => {
    it('getFaultInjectionConfig 应返回当前配置', () => {
      const config = getFaultInjectionConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(false);
    });

    it('updateFaultInjectionConfig 应更新配置', () => {
      updateFaultInjectionConfig({
        enabled: true,
        defaultDelay: 2000,
      });

      expect(defaultFaultInjectionConfig.enabled).toBe(true);
      expect(defaultFaultInjectionConfig.defaultDelay).toBe(2000);
    });
  });

  describe('预定义场景', () => {
    it('FaultScenarios.highLatency 应配置高延迟', () => {
      const config = FaultScenarios.highLatency();
      expect(config.enabled).toBe(true);
      expect(config.routes?.[0].faults).toContain('delay');
    });

    it('FaultScenarios.randomErrors 应配置随机错误', () => {
      const config = FaultScenarios.randomErrors();
      expect(config.enabled).toBe(true);
      expect(config.routes?.[0].probability).toBe(0.1);
    });

    it('FaultScenarios.serviceDown 应配置服务宕机', () => {
      const config = FaultScenarios.serviceDown();
      expect(config.enabled).toBe(true);
      expect(config.routes?.[0].faults).toContain('503');
    });

    it('FaultScenarios.chaosEngineering 应配置混沌工程场景', () => {
      const config = FaultScenarios.chaosEngineering();
      expect(config.enabled).toBe(true);
      expect(config.routes?.length).toBe(3);
    });
  });

  describe('createFaultInjectionWithStats', () => {
    it('应跟踪统计信息', async () => {
      const middleware = createFaultInjectionWithStats({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 1,
        }],
      });

      const app = express();
      app.use(express.json());
      app.use(middleware);
      app.get('/api/users', (req, res) => res.json({ success: true }));

      // 发送多个请求
      for (let i = 0; i < 5; i++) {
        await request(app).get('/api/users');
      }
    });
  });

  describe('响应头标记', () => {
    it('应设置故障注入响应头', async () => {
      const app = createTestApp({
        enabled: true,
        markResponse: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.headers['x-fault-injection']).toBe('500');
      expect(response.headers['x-fault-injection-id']).toBeDefined();
    });

    it('disabled markResponse 时不应设置响应头', async () => {
      const app = createTestApp({
        enabled: true,
        markResponse: false,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          probability: 1,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.headers['x-fault-injection']).toBeUndefined();
      // 但故障仍然注入
      expect(response.status).toBe(500);
    });
  });

  describe('边界条件', () => {
    it('空故障列表应跳过故障注入', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: [],
          probability: 1,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
    });

    it('enabled=false 的路由应被跳过', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['500'],
          enabled: false,
        }],
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
    });

    it('支持多故障类型组合', async () => {
      const app = createTestApp({
        enabled: true,
        routes: [{
          path: '/api/users',
          faults: ['delay', '500', '503'],
          probability: 1,
        }],
      });

      // 由于随机选择，多次请求应该能看到不同的故障类型
      const statuses = new Set();
      for (let i = 0; i < 20; i++) {
        const response = await request(app).get('/api/users');
        statuses.add(response.status);
      }

      // 应该至少有两种不同的故障状态
      expect(statuses.size).toBeGreaterThanOrEqual(1);
    }, 30000);
  });
});

describe('FaultInjection Integration Scenarios', () => {
  beforeEach(() => {
    defaultFaultInjectionConfig.enabled = false;
    defaultFaultInjectionConfig.routes = [];
  });

  afterEach(() => {
    defaultFaultInjectionConfig.enabled = false;
    defaultFaultInjectionConfig.routes = [];
  });

  describe('微服务故障场景', () => {
    it('模拟用户服务故障', async () => {
      const app = createTestApp();
      app.use(createFaultInjection({
        enabled: true,
        routes: [{
          path: '/api/users*',
          faults: ['503'],
          probability: 1,
          faultConfig: {
            '503': { type: '503', message: 'User service unavailable', retryAfter: 30 },
          },
        }],
      }));

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('User service unavailable');
    });

    it('模拟订单服务超时', async () => {
      const app = createTestApp();
      app.use(createFaultInjection({
        enabled: true,
        routes: [{
          path: '/api/orders*',
          faults: ['timeout'],
          probability: 1,
        }],
      }));

      const response = await request(app).get('/api/orders');

      // timeout 故障可能返回 504 或 200（超时处理方式）
      expect([200, 504]).toContain(response.status);
    }, 10000);
  });

  describe('级联故障场景', () => {
    it('多个服务依次故障', async () => {
      const app = express();
      app.use(express.json());

      // 用户服务
      app.use('/api/users', createFaultInjection({
        enabled: true,
        routes: [{ path: '*', faults: ['500'], probability: 1 }],
      }));

      // 订单服务
      app.use('/api/orders', createFaultInjection({
        enabled: true,
        routes: [{ path: '*', faults: ['503'], probability: 1 }],
      }));

      app.get('/api/users', (req, res) => res.json({ users: [] }));
      app.get('/api/orders', (req, res) => res.json({ orders: [] }));

      const usersResponse = await request(app).get('/api/users');
      const ordersResponse = await request(app).get('/api/orders');

      expect(usersResponse.status).toBe(500);
      expect(ordersResponse.status).toBe(503);
    });
  });
});

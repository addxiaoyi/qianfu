/**
 * 合规 API 集成测试
 *
 * 测试覆盖：
 * - 合规检查端点
 * - 审计日志端点
 * - 安全配置端点
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

// Mock 依赖
vi.mock('../../lib/logger', () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      security: vi.fn(),
      audit: vi.fn(),
    }),
  },
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  })),
}));

// Mock Prisma
vi.mock('../../../prisma/generated/client', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: '1' }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    securityLog: {
      create: vi.fn().mockResolvedValue({ id: '1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('合规 API 集成测试', () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // 导入并注册路由
    const complianceRoutes = await import('../../routes/compliance');
    app.use('/api/compliance', complianceRoutes.default);

    // 健康检查路由
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/compliance/check', () => {
    it('应该执行合规检查', async () => {
      const response = await request(app)
        .post('/api/compliance/check')
        .send({
          scope: 'security',
          level: 'L3',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('passed');
      expect(response.body).toHaveProperty('checks');
    });

    it('应该在缺少参数时返回错误', async () => {
      const response = await request(app)
        .post('/api/compliance/check')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/compliance/audit-logs', () => {
    it('应该返回审计日志列表', async () => {
      const response = await request(app)
        .get('/api/compliance/audit-logs')
        .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('应该支持分页', async () => {
      const response = await request(app)
        .get('/api/compliance/audit-logs')
        .query({ page: 1, pageSize: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('POST /api/compliance/security-report', () => {
    it('应该生成安全报告', async () => {
      const response = await request(app)
        .post('/api/compliance/security-report')
        .send({
          type: 'vulnerability',
          period: 'monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reportId');
      expect(response.body).toHaveProperty('generatedAt');
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的请求', async () => {
      const response = await request(app)
        .post('/api/compliance/invalid-endpoint')
        .send({});

      expect(response.status).toBe(404);
    });

    it('应该处理服务器错误', async () => {
      // 模拟服务器错误
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await request(app)
        .post('/api/compliance/check')
        .send({ scope: 'invalid' });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});

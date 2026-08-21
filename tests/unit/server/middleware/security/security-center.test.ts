/**
 * 安全中间件单元测试
 *
 * 测试覆盖（等保2.0 + SOC2）：
 * - SQL 注入防护
 * - XSS 防护
 * - 请求限流
 * - 暴力破解防护
 * - 输入验证
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

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

// Mock Redis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

import { Request, Response, NextFunction } from 'express';

// 测试请求/响应工厂函数
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    ip: '127.0.0.1',
    path: '/api/test',
    method: 'GET',
    headers: {},
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('安全中间件 - 等保2.0 合规测试', () => {
  let sqlInjectionProtection: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  let xssProtection: (req: Request, res: Response, next: NextFunction) => void;
  let rateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  let inputValidation: (req: Request, res: Response, next: NextFunction) => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // 动态导入中间件
    const securityCenter = await import('../../server/middleware/security/security-center');
    sqlInjectionProtection = securityCenter.sqlInjectionProtection;
    xssProtection = securityCenter.xssProtection;
    rateLimiter = securityCenter.rateLimiter;
    inputValidation = securityCenter.inputValidation;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('L3-SAB-2: SQL 注入防护', () => {
    it('应该阻止 SQL 注入攻击 - UNION SELECT', async () => {
      const req = createMockRequest({
        query: { id: "1 UNION SELECT * FROM users--" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await sqlInjectionProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SECURITY_SQL_INJECTION',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('应该阻止 SQL 注入攻击 - OR 1=1', async () => {
      const req = createMockRequest({
        query: { username: "admin' OR '1'='1" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await sqlInjectionProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('应该阻止 SQL 注入攻击 - 注释符', async () => {
      const req = createMockRequest({
        query: { id: '1; DROP TABLE users;--' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await sqlInjectionProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('应该允许正常请求通过', async () => {
      const req = createMockRequest({
        query: { id: '123', name: 'John' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await sqlInjectionProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('应该检查请求体中的 SQL 注入', async () => {
      const req = createMockRequest({
        body: { email: "test@test.com' OR 1=1--" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await sqlInjectionProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('L3-SAB-2: XSS 防护', () => {
    it('应该阻止脚本注入攻击', () => {
      const req = createMockRequest({
        query: { search: '<script>alert("xss")</script>' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      xssProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SECURITY_XSS',
        })
      );
    });

    it('应该阻止 javascript: 协议', () => {
      const req = createMockRequest({
        query: { url: 'javascript:alert(1)' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      xssProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('应该阻止事件处理器注入', () => {
      const req = createMockRequest({
        body: { comment: '<img src=x onerror="alert(1)">' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      xssProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('应该允许正常 HTML 内容通过', () => {
      const req = createMockRequest({
        body: { content: '<p>Hello, World!</p>' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      xssProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('L3-SCN-3: 请求限流', () => {
    it('应该允许正常请求通过', async () => {
      const req = createMockRequest({
        ip: '192.168.1.100',
      });
      const res = createMockResponse();
      const next = createMockNext();

      await rateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('应该在超限时返回 429', async () => {
      // 模拟多次请求
      const req = createMockRequest({
        ip: '192.168.1.200',
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 模拟 Redis 返回超限
      const Redis = require('ioredis');
      (Redis.default as Mock).mockImplementation(() => ({
        get: vi.fn().mockResolvedValue('1000'), // 模拟已超过限制
        incr: vi.fn().mockResolvedValue(1001),
        expire: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue('OK'),
      }));

      await rateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('L3-SCE-4: 暴力破解防护', () => {
    it('应该跟踪失败的登录尝试', async () => {
      const req = createMockRequest({
        ip: '10.0.0.1',
        path: '/api/auth/login',
        body: { username: 'admin', password: 'wrong' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 模拟登录失败后的检查
      const bruteForceProtection = (await import('../../server/middleware/security/security-center'))
        .bruteForceProtection;

      await bruteForceProtection(req, res, next);

      // 第一次失败应该允许继续
      expect(next).toHaveBeenCalled();
    });

    it('应该在多次失败后锁定账户', async () => {
      const req = createMockRequest({
        ip: '10.0.0.2',
        path: '/api/auth/login',
        body: { username: 'locked', password: 'wrong' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 模拟 Redis 返回锁定状态
      const Redis = require('ioredis');
      (Redis.default as Mock).mockImplementation(() => ({
        get: vi.fn().mockResolvedValue('6'), // 超过5次限制
        set: vi.fn().mockResolvedValue('OK'),
        incr: vi.fn().mockResolvedValue(6),
        expire: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue('OK'),
      }));

      const bruteForceProtection = (await import('../../server/middleware/security/security-center'))
        .bruteForceProtection;

      await bruteForceProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('输入验证', () => {
    it('应该验证必填字段', () => {
      const req = createMockRequest({
        body: { name: '' }, // 空名称
      });
      const res = createMockResponse();
      const next = createMockNext();

      inputValidation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('应该验证邮箱格式', () => {
      const req = createMockRequest({
        body: { email: 'invalid-email' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      inputValidation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('应该验证 URL 格式', () => {
      const req = createMockRequest({
        body: { website: 'not-a-url' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      inputValidation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('应该允许有效数据通过', () => {
      const req = createMockRequest({
        body: {
          name: 'Test User',
          email: 'test@example.com',
          website: 'https://example.com',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      inputValidation(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

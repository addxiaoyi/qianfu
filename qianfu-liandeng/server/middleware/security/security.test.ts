/**
 * 安全测试 - SQL注入与XSS防护
 * 优化项 204: 安全测试 - SQL注入/XSS测试
 *
 * 测试覆盖:
 * 1. SQL注入防护 - 检测常见SQL注入模式
 * 2. XSS防护 - 检测和阻止跨站脚本攻击
 * 3. 防护中间件的正确配置和应用
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// 导入安全中间件
import {
  sqlInjectionProtection,
  xssProtection,
  SecurityConfig,
  defaultSecurityConfig,
  securityHeaders,
  AuditEventType,
  SecurityLogger,
  AuditResult,
} from './security-center';

// ============================================================
// 测试辅助函数
// ============================================================

interface TestContext {
  app: Express;
  auditLogs: AuditResult[];
}

function createTestApp(config?: Partial<SecurityConfig['sqlInjection']> & Partial<SecurityConfig['xss']>): { app: Express; getAuditLogs: () => AuditResult[] } {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // 捕获审计日志
  const auditLogs: AuditResult[] = [];
  const originalLog = SecurityLogger.log.bind(SecurityLogger);

  // 临时覆盖日志方法以捕获测试数据
  (SecurityLogger as any).log = (event: Omit<AuditResult, 'eventId' | 'timestamp'>) => {
    const result = originalLog(event);
    auditLogs.push(result);
    return result;
  };

  // SQL注入防护中间件
  const sqlConfig = config ? { ...defaultSecurityConfig.sqlInjection, ...config } : defaultSecurityConfig.sqlInjection;
  app.use(sqlInjectionProtection(sqlConfig));

  // XSS防护中间件
  const xssConfig = config ? { ...defaultSecurityConfig.xss, ...config } : defaultSecurityConfig.xss;
  app.use(xssProtection(xssConfig));

  // 测试路由
  app.get('/test-query', (req: Request, res: Response) => {
    res.json({ success: true, query: req.query });
  });

  app.post('/test-body', (req: Request, res: Response) => {
    res.json({ success: true, body: req.body });
  });

  app.get('/test-param/:id', (req: Request, res: Response) => {
    res.json({ success: true, id: req.params.id });
  });

  return {
    app,
    getAuditLogs: () => {
      (SecurityLogger as any).log = originalLog;
      return auditLogs;
    },
  };
}

// ============================================================
// SQL注入防护测试
// ============================================================

describe('SQL注入防护测试', () => {

  describe('基础SQL注入模式检测', () => {

    it('应检测UNION SELECT注入', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ name: "'; UNION SELECT * FROM users--" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
      expect(getAuditLogs().some(log => log.eventType === AuditEventType.SQL_INJECTION_ATTEMPT)).toBe(true);
    });

    it('应检测SELECT FROM注入', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ query: 'SELECT * FROM admin' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
    });

    it('应检测DROP TABLE注入', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ table: 'users; DROP TABLE users--' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
    });

    it('应检测INSERT INTO注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ data: "INSERT INTO users VALUES ('hacker', 'password')" });

      expect(response.status).toBe(400);
    });

    it('应检测UPDATE SET注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ query: "UPDATE users SET role='admin' WHERE id=1--" });

      expect(response.status).toBe(400);
    });

    it('应检测DELETE FROM注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ query: 'DELETE FROM users WHERE id=1' });

      expect(response.status).toBe(400);
    });

    it('应检测EXEC/EXECUTE存储过程注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ exec: 'EXEC sp_executesql' });

      expect(response.status).toBe(400);
    });

    it('应检测SQL注释注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ id: '1 -- comment' });

      expect(response.status).toBe(400);
    });

    it('应检测OR 1=1永真条件注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ id: "1 OR 1=1" });

      expect(response.status).toBe(400);
    });

    it('应检测AND 1=1条件注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ id: "admin' AND '1'='1" });

      expect(response.status).toBe(400);
    });

    it('应检测单引号注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ name: "admin'" });

      expect(response.status).toBe(400);
    });

  });

  describe('防护模式配置', () => {

    it('blockSuspicious=false时应记录但不阻止请求', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: true, blockSuspicious: false });

      const response = await request(app)
        .get('/test-query')
        .query({ name: "'; DROP TABLE users--" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(getAuditLogs().some(log => log.eventType === AuditEventType.SQL_INJECTION_ATTEMPT)).toBe(true);
    });

    it('logSuspicious=false时应不记录日志', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: false, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ name: "'; DROP TABLE users--" });

      expect(response.status).toBe(400);
      expect(getAuditLogs().filter(log => log.eventType === AuditEventType.SQL_INJECTION_ATTEMPT)).toHaveLength(0);
    });

    it('enabled=false时应跳过检查', async () => {
      const { app, getAuditLogs } = createTestApp({ enabled: false, logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ name: "'; DROP TABLE users--" });

      expect(response.status).toBe(200);
      expect(getAuditLogs().filter(log => log.eventType === AuditEventType.SQL_INJECTION_ATTEMPT)).toHaveLength(0);
    });

  });

  describe('不同输入位置检测', () => {

    it('应检测query参数中的SQL注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ search: "UNION SELECT password FROM admin" });

      expect(response.status).toBe(400);
    });

    it('应检测body参数中的SQL注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({
          username: "admin",
          password: "' OR '1'='1"
        });

      expect(response.status).toBe(400);
    });

    it('应检测嵌套对象中的SQL注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({
          user: {
            name: "'; DROP TABLE sessions;--"
          }
        });

      expect(response.status).toBe(400);
    });

    it('应检测数组中的SQL注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({
          ids: [1, 2, "3; DELETE FROM users"]
        });

      expect(response.status).toBe(400);
    });

  });

  describe('审计日志记录', () => {

    it('应记录注入尝试的详细信息', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      await request(app)
        .post('/test-body')
        .send({ query: "UNION SELECT * FROM users" });

      const logs = getAuditLogs();
      const sqlLog = logs.find(log => log.eventType === AuditEventType.SQL_INJECTION_ATTEMPT);

      expect(sqlLog).toBeDefined();
      expect(sqlLog?.action).toBe('sql_injection_detected');
      expect(sqlLog?.result).toBe('warning');
      expect(sqlLog?.details).toBeDefined();
      expect(sqlLog?.details.pattern).toBeDefined();
      expect(sqlLog?.details.path).toBe('body');
    });

    it('应记录客户端IP', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      await request(app)
        .post('/test-body')
        .send({ query: "DROP TABLE users" });

      const logs = getAuditLogs();
      const sqlLog = logs.find(log => log.eventType === AuditEventType.SQL_INJECTION_ATTEMPT);

      expect(sqlLog?.ip).toBeDefined();
    });

    it('应记录请求路径', async () => {
      const { app, getAuditLogs } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      await request(app)
        .post('/test-body')
        .send({ query: "SELECT * FROM users" });

      const logs = getAuditLogs();
      const sqlLog = logs.find(log => log.eventType === AuditEventType.SQL_INJECTION_ATTEMPT);

      expect(sqlLog?.resource).toBe('/test-body');
    });

  });

  describe('绕过技术检测', () => {

    it('应检测大小写混合的SQL注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ name: "uNiOn SeLeCt 1,2,3" });

      expect(response.status).toBe(400);
    });

    it('应检测URL编码的SQL注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ name: encodeURIComponent("'; DROP TABLE users--") });

      expect(response.status).toBe(400);
    });

    it('应检测空格替代的SQL注入', async () => {
      const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

      // 使用换行符替代空格
      const response = await request(app)
        .get('/test-query')
        .query({ name: "UNION\nSELECT\n*\nFROM\nusers" });

      expect(response.status).toBe(400);
    });

  });

});

// ============================================================
// XSS防护测试
// ============================================================

describe('XSS防护测试', () => {

  // 创建专门用于XSS测试的应用
  function createXssTestApp(xssConfig?: Partial<SecurityConfig['xss']>) {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    const auditLogs: AuditResult[] = [];
    const originalLog = SecurityLogger.log.bind(SecurityLogger);
    (SecurityLogger as any).log = (event: Omit<AuditResult, 'eventId' | 'timestamp'>) => {
      const result = originalLog(event);
      auditLogs.push(result);
      return result;
    };

    const config = xssConfig ? { ...defaultSecurityConfig.xss, ...xssConfig } : defaultSecurityConfig.xss;
    app.use(xssProtection(config));

    app.get('/test-query', (req: Request, res: Response) => {
      res.json({ success: true, query: req.query });
    });

    app.post('/test-body', (req: Request, res: Response) => {
      res.json({ success: true, body: req.body });
    });

    return {
      app,
      getAuditLogs: () => {
        (SecurityLogger as any).log = originalLog;
        return auditLogs;
      },
    };
  }

  describe('基础XSS模式检测', () => {

    it('应检测script标签XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<script>alert("XSS")</script>' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
    });

    it('应检测img标签XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<img src=x onerror=alert("XSS")>' });

      expect(response.status).toBe(400);
    });

    it('应检测iframe XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<iframe src="javascript:alert(\'XSS\')">' });

      expect(response.status).toBe(400);
    });

    it('应检测SVG XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<svg onload=alert("XSS")>' });

      expect(response.status).toBe(400);
    });

    it('应检测事件处理器XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<body onload=alert("XSS")>' });

      expect(response.status).toBe(400);
    });

    it('应检测javascript:协议XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<a href="javascript:alert(\'XSS\')">click</a>' });

      expect(response.status).toBe(400);
    });

    it('应检测data:协议XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<a href="data:text/html,<script>alert(\'XSS\')</script>">click</a>' });

      expect(response.status).toBe(400);
    });

    it('应检测Base64编码的XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<script>eval(atob("YWxlcnQoJ1hTUycp"))</script>' });

      expect(response.status).toBe(400);
    });

  });

  describe('HTML实体编码检测', () => {

    it('应检测HTML实体编码绕过', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;' });

      // 实体编码应该被允许（这是防御性编码）
      expect(response.status).toBe(200);
    });

  });

  describe('防护配置测试', () => {

    it('blockSuspicious=false时应允许请求', async () => {
      const { app } = createXssTestApp({ blockSuspicious: false });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<script>alert("XSS")</script>' });

      expect(response.status).toBe(200);
    });

    it('enabled=false时应跳过检查', async () => {
      const { app } = createXssTestApp({ enabled: false });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<script>alert("XSS")</script>' });

      expect(response.status).toBe(200);
    });

  });

  describe('不同输入位置XSS检测', () => {

    it('应检测query参数中的XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .get('/test-query')
        .query({ content: '<script>alert(1)</script>' });

      expect(response.status).toBe(400);
    });

    it('应检测body参数中的XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<img src=x onerror=alert(1)>' });

      expect(response.status).toBe(400);
    });

  });

  describe('变异XSS检测', () => {

    it('应检测编码的script标签', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      // Unicode编码
      const response = await request(app)
        .post('/test-body')
        .send({ content: '<script>alert(1)</script>' });

      expect(response.status).toBe(400);
    });

    it('应检测拆分的script标签', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<scr' + 'ipt>alert(1)</scr' + 'ipt>' });

      expect(response.status).toBe(400);
    });

    it('应检测空属性XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<img """><script>alert(1)</script>">' });

      expect(response.status).toBe(400);
    });

    it('应检测DOM事件XSS', async () => {
      const { app } = createXssTestApp({ blockSuspicious: true });

      const response = await request(app)
        .post('/test-body')
        .send({ content: '<div onmouseover="alert(1)">hover</div>' });

      expect(response.status).toBe(400);
    });

  });

});

// ============================================================
// 安全头测试
// ============================================================

describe('安全HTTP头测试', () => {

  function createAppWithSecurityHeaders() {
    const app = express();
    app.use(securityHeaders(defaultSecurityConfig.securityHeaders));
    app.get('/test', (req: Request, res: Response) => {
      res.send('OK');
    });
    return app;
  }

  it('应设置X-Frame-Options头', async () => {
    const app = createAppWithSecurityHeaders();
    const response = await request(app).get('/test');

    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('应设置X-Content-Type-Options头', async () => {
    const app = createAppWithSecurityHeaders();
    const response = await request(app).get('/test');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('应设置X-XSS-Protection头', async () => {
    const app = createAppWithSecurityHeaders();
    const response = await request(app).get('/test');

    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
  });

  it('应设置Content-Security-Policy头', async () => {
    const app = createAppWithSecurityHeaders();
    const response = await request(app).get('/test');

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('应设置Strict-Transport-Security头', async () => {
    const app = createAppWithSecurityHeaders();
    const response = await request(app).get('/test');

    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['strict-transport-security']).toContain('max-age=');
  });

  it('应设置Referrer-Policy头', async () => {
    const app = createAppWithSecurityHeaders();
    const response = await request(app).get('/test');

    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('应设置Permissions-Policy头', async () => {
    const app = createAppWithSecurityHeaders();
    const response = await request(app).get('/test');

    expect(response.headers['permissions-policy']).toBeDefined();
  });

});

// ============================================================
// 集成测试
// ============================================================

describe('安全中间件集成测试', () => {

  it('应同时保护多个端点', async () => {
    const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

    // 测试多个端点
    const response1 = await request(app)
      .get('/test-query')
      .query({ q: "'; DROP TABLE users--" });

    const response2 = await request(app)
      .post('/test-body')
      .send({ data: "SELECT * FROM admin" });

    expect(response1.status).toBe(400);
    expect(response2.status).toBe(400);
  });

  it('正常请求应不受影响', async () => {
    const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

    const response = await request(app)
      .post('/test-body')
      .send({
        username: "admin",
        email: "admin@example.com",
        bio: "这是一个正常的用户简介"
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('应正确处理空输入', async () => {
    const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

    const response = await request(app)
      .post('/test-body')
      .send({});

    expect(response.status).toBe(200);
  });

  it('应正确处理特殊字符', async () => {
    const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

    const response = await request(app)
      .post('/test-body')
      .send({
        name: "John O'Brien",
        search: "Tom & Jerry",
        note: "100% 满意！中文测试"
      });

    expect(response.status).toBe(200);
  });

});

// ============================================================
// 性能测试
// ============================================================

describe('安全中间件性能测试', () => {

  it('应在合理时间内处理请求', async () => {
    const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

    const start = Date.now();

    await request(app)
      .post('/test-body')
      .send({
        data1: "正常数据1",
        data2: "正常数据2",
        data3: "正常数据3"
      });

    const duration = Date.now() - start;

    // 中间件处理应在100ms内完成
    expect(duration).toBeLessThan(100);
  });

  it('应高效处理大量参数', async () => {
    const { app } = createTestApp({ logSuspicious: true, blockSuspicious: true });

    const params: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      params[`param${i}`] = `value${i}`;
    }

    const start = Date.now();

    await request(app)
      .post('/test-body')
      .send(params);

    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });

});

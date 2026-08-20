/**
 * API E2E 测试配置和辅助工具
 * 优化项 202: 集成测试 - API端到端
 */

import request, { SuperTest, Test } from 'supertest';
import { Express } from 'express';

// 测试配置
export const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  apiPrefix: '/api',
  timeout: 30000,
};

// 测试用户凭据
export const TEST_USERS = {
  admin: {
    username: 'test-admin',
    password: 'Test@123456',
    role: 'admin',
  },
  user: {
    username: 'test-user',
    password: 'Test@123456',
    role: 'user',
  },
  locked: {
    username: 'locked-user',
    password: 'Test@123456',
    role: 'user',
  },
};

// 测试数据生成器
export function generateTestId(prefix: string = 'TEST'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateTestEmail(): string {
  return `test-${Date.now()}@example.com`;
}

// API客户端封装
export class ApiClient {
  private agent: SuperTest<Test>;
  private token: string | null = null;
  private userRole: string | null = null;

  constructor(app: Express) {
    this.agent = request(app);
  }

  // 设置认证Token
  setAuth(token: string, role: string = 'user') {
    this.token = token;
    this.userRole = role;
  }

  // 获取请求头
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // 模拟用户角色
  setUserRole(role: string) {
    this.userRole = role;
    return this;
  }

  // GET 请求
  async get(path: string, query?: Record<string, string>): Promise<supertest.Response> {
    let req = this.agent.get(path).set(this.getHeaders());
    if (query) {
      req = req.query(query);
    }
    return req.timeout(TEST_CONFIG.timeout);
  }

  // POST 请求
  async post(path: string, body?: unknown): Promise<supertest.Response> {
    return this.agent
      .post(path)
      .set(this.getHeaders())
      .send(body)
      .timeout(TEST_CONFIG.timeout);
  }

  // PUT 请求
  async put(path: string, body?: unknown): Promise<supertest.Response> {
    return this.agent
      .put(path)
      .set(this.getHeaders())
      .send(body)
      .timeout(TEST_CONFIG.timeout);
  }

  // DELETE 请求
  async delete(path: string): Promise<supertest.Response> {
    return this.agent
      .delete(path)
      .set(this.getHeaders())
      .timeout(TEST_CONFIG.timeout);
  }

  // PATCH 请求
  async patch(path: string, body?: unknown): Promise<supertest.Response> {
    return this.agent
      .patch(path)
      .set(this.getHeaders())
      .send(body)
      .timeout(TEST_CONFIG.timeout);
  }

  // 获取当前Token
  getToken(): string | null {
    return this.token;
  }

  // 获取当前角色
  getRole(): string | null {
    return this.userRole;
  }
}

// 断言辅助函数
export const assert = {
  // 验证成功响应
  success(response: supertest.Response, message?: string) {
    expect(response.status).toBeLessThan(400, message || `Expected success status, got ${response.status}`);
  },

  // 验证错误响应
  error(response: supertest.Response, expectedStatus?: number, message?: string) {
    if (expectedStatus) {
      expect(response.status).toBe(expectedStatus, message || `Expected ${expectedStatus}, got ${response.status}`);
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400, message || 'Expected error status');
    }
  },

  // 验证响应体包含字段
  hasField(response: supertest.Response, field: string) {
    expect(response.body).toHaveProperty(field);
  },

  // 验证响应体包含数据
  hasData(response: supertest.Response, dataPath?: string) {
    if (dataPath) {
      const parts = dataPath.split('.');
      let current = response.body;
      for (const part of parts) {
        expect(current).toHaveProperty(part);
        current = current[part];
      }
    } else {
      expect(response.body).toHaveProperty('data');
    }
  },

  // 验证分页响应
  paginated(response: supertest.Response) {
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page');
    expect(response.body).toHaveProperty('pageSize');
    expect(typeof response.body.total).toBe('number');
    expect(typeof response.body.page).toBe('number');
    expect(typeof response.body.pageSize).toBe('number');
  },

  // 验证数组响应
  array(response: supertest.Response, field: string = 'data') {
    expect(response.body).toHaveProperty(field);
    expect(Array.isArray(response.body[field])).toBe(true);
  },
};

// Mock数据生成
export const mockData = {
  // 合规相关
  compliance: {
    controlUpdate: (overrides = {}) => ({
      status: 'compliant',
      findings: '测试发现',
      remediation: '测试修复计划',
      evidence: {
        type: 'automated',
        timestamp: new Date().toISOString(),
      },
      ...overrides,
    }),

    securityIncident: (overrides = {}) => ({
      title: `安全事件-${generateTestId()}`,
      description: '测试安全事件描述',
      severity: 'medium',
      category: 'data-breach',
      affectedSystems: ['server-01', 'database-01'],
      reportedBy: 'test-user',
      ...overrides,
    }),

    accessRecord: (overrides = {}) => ({
      userId: generateTestId('USER'),
      resourceId: generateTestId('RES'),
      accessLevel: 'read',
      grantedBy: 'admin',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ...overrides,
    }),

    changeRequest: (overrides = {}) => ({
      title: `变更请求-${generateTestId()}`,
      description: '测试变更描述',
      type: 'standard',
      requester: 'test-user',
      rollbackPlan: '回滚到上一版本',
      affectedSystems: ['server-01'],
      riskLevel: 'medium',
      testPlan: '测试计划',
      ...overrides,
    }),

    dataAsset: (overrides = {}) => ({
      name: `数据资产-${generateTestId()}`,
      type: 'database',
      classification: 'confidential',
      owner: 'test-admin',
      location: '/data/mysql',
      retentionDays: 365,
      encryptionRequired: true,
      sensitivity: 'high',
      ...overrides,
    }),

    backupRecord: (overrides = {}) => ({
      backupType: 'full',
      size: 1024 * 1024 * 1024,
      location: '/backup/daily',
      status: 'completed',
      verified: true,
      retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides,
    }),

    recoveryTest: (overrides = {}) => ({
      testType: 'full-restore',
      duration: 3600,
      success: true,
      dataIntegrityVerified: true,
      findings: '恢复成功',
      recommendations: '建议定期测试',
      ...overrides,
    }),
  },

  // 语义搜索相关
  semantic: {
    document: (overrides = {}) => ({
      className: 'TestClass',
      content: '这是一段测试文档内容',
      properties: {
        title: '测试文档',
        category: 'test',
        tags: ['测试', '示例'],
      },
      ...overrides,
    }),

    searchQuery: (overrides = {}) => ({
      query: '测试查询',
      className: 'TestClass',
      limit: 10,
      ...overrides,
    }),

    weaviateConfig: (overrides = {}) => ({
      url: process.env.WEAVIATE_URL || 'http://localhost:8080',
      apiKey: process.env.WEAVIATE_API_KEY,
      ...overrides,
    }),
  },

  // 认证相关
  auth: {
    login: (overrides = {}) => ({
      username: TEST_USERS.admin.username,
      password: TEST_USERS.admin.password,
      ...overrides,
    }),

    invalidLogin: (overrides = {}) => ({
      username: 'invalid-user',
      password: 'wrong-password',
      ...overrides,
    }),
  },
};

// 类型声明
declare global {
  namespace supertest {
    interface Response {
      body: any;
      status: number;
      headers: Record<string, string>;
    }
  }
}

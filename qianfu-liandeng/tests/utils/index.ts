/**
 * 测试工具库
 *
 * 提供测试中常用的辅助函数和 Mock
 */

import { Request, Response, NextFunction } from 'express';
import { vi } from 'vitest';

// ============================================
// 请求/响应 Mock 工厂
// ============================================

/**
 * 创建模拟 Request 对象
 */
export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    ip: '127.0.0.1',
    path: '/api/test',
    method: 'GET',
    headers: {
      'user-agent': 'test-agent',
      'content-type': 'application/json',
    },
    body: {},
    query: {},
    params: {},
    protocol: 'http',
    secure: false,
    hostname: 'localhost',
    ...overrides,
  } as unknown as Request;
}

/**
 * 创建模拟 Response 对象
 */
export function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    statusCode: 200,
  };
  return res as Response;
}

/**
 * 创建模拟 NextFunction
 */
export function createMockNext(): NextFunction {
  return vi.fn();
}

// ============================================
// 测试数据生成器
// ============================================

/**
 * 生成随机字符串
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * 生成测试用户数据
 */
export function generateTestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: randomString(),
    username: `test_${randomString(6)}`,
    email: `test_${randomString(6)}@example.com`,
    password: 'Test@123456',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * 生成测试服务器数据
 */
export function generateTestServer(overrides: Record<string, unknown> = {}) {
  return {
    id: randomString(),
    name: `测试服务器_${randomString(6)}`,
    address: `${randomString(8)}.example.com`,
    port: 25565,
    version: '1.20.4',
    type: '生存服',
    status: 'online',
    players: 0,
    maxPlayers: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================
// Mock 辅助函数
// ============================================

/**
 * Mock 模块并返回导出
 */
export async function mockModule<T>(modulePath: string, mockExports: Record<string, unknown>): Promise<T> {
  const module = await vi.importActual(modulePath);
  return {
    ...module,
    ...mockExports,
  } as T;
}

/**
 * 模拟数据库错误
 */
export function simulateDBError(): Error {
  const error = new Error('Database connection error');
  (error as any).code = 'ECONNREFUSED';
  return error;
}

/**
 * 模拟网络错误
 */
export function simulateNetworkError(): Error {
  const error = new Error('Network request failed');
  (error as any).code = 'ENOTFOUND';
  return error;
}

// ============================================
// 异步测试辅助
// ============================================

/**
 * 等待指定时间
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 等待直到条件满足
 */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    if (result) return true;
    await wait(interval);
  }

  return false;
}

// ============================================
// 快照和比较
// ============================================

/**
 * 深比较两个对象
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 去除时间戳进行比较
 */
export function excludeTimestamps(obj: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...obj };

  Object.keys(clone).forEach(key => {
    const value = clone[key];
    if (value instanceof Date) {
      delete clone[key];
    } else if (typeof value === 'object' && value !== null) {
      clone[key] = excludeTimestamps(value as Record<string, unknown>);
    }
  });

  return clone;
}

// ============================================
// 性能测试辅助
// ============================================

/**
 * 测量函数执行时间
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * 断言性能要求
 */
export function assertPerformance(
  duration: number,
  maxDuration: number,
  operationName: string
): void {
  expect(duration).toBeLessThanOrEqual(maxDuration);
  console.log(`${operationName} 执行时间: ${duration}ms (最大: ${maxDuration}ms)`);
}

// ============================================
// 日志捕获
// ============================================

/**
 * 捕获控制台输出
 */
export function captureConsole() {
  const logs: Array<{ type: string; args: unknown[] }> = [];

  const mockConsole = {
    log: vi.fn((...args: unknown[]) => logs.push({ type: 'log', args })),
    info: vi.fn((...args: unknown[]) => logs.push({ type: 'info', args })),
    warn: vi.fn((...args: unknown[]) => logs.push({ type: 'warn', args })),
    error: vi.fn((...args: unknown[]) => logs.push({ type: 'error', args })),
    debug: vi.fn((...args: unknown[]) => logs.push({ type: 'debug', args })),
  };

  return {
    logs,
    mockConsole,
  };
}

// ============================================
// 导出
// ============================================

export default {
  createMockRequest,
  createMockResponse,
  createMockNext,
  randomString,
  generateTestUser,
  generateTestServer,
  mockModule,
  simulateDBError,
  simulateNetworkError,
  wait,
  waitUntil,
  deepEqual,
  excludeTimestamps,
  measureTime,
  assertPerformance,
  captureConsole,
};

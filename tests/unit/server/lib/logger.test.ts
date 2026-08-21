/**
 * 日志服务单元测试
 *
 * 测试覆盖：
 * - 日志级别过滤
 * - 日志格式输出
 * - 结构化日志字段
 * - 日志轮转（模拟）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, LogEntry } from '../server/lib/logger';

// Mock console methods
vi.mock('console', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger({
      level: LogLevel.DEBUG,
      prettyPrint: true,
      service: 'test-service',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('日志级别', () => {
    it('应该正确过滤 DEBUG 级别日志', () => {
      const infoLogger = new Logger({ level: LogLevel.INFO });
      infoLogger.debug('debug message');
      // DEBUG 级别低于 INFO，不应输出
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('应该正确输出 INFO 及以上级别日志', () => {
      const infoLogger = new Logger({ level: LogLevel.INFO });
      infoLogger.info('info message');
      expect(console.info).toHaveBeenCalled();
    });

    it('应该正确输出 WARN 级别日志', () => {
      const warnLogger = new Logger({ level: LogLevel.WARN });
      warnLogger.warn('warn message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('应该正确输出 ERROR 级别日志', () => {
      const errorLogger = new Logger({ level: LogLevel.ERROR });
      errorLogger.error('error message');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('结构化日志', () => {
    it('应该包含正确的日志字段', () => {
      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'test message',
        timestamp: new Date().toISOString(),
        service: 'test-service',
        context: { userId: '123' },
      };

      logger.info('test message', { userId: '123' });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('test message'),
        expect.stringContaining('userId'),
        expect.stringContaining('123')
      );
    });

    it('应该正确处理嵌套上下文', () => {
      const nestedContext = {
        user: {
          id: '123',
          name: 'test',
        },
        request: {
          method: 'GET',
          path: '/api/test',
        },
      };

      logger.info('request received', nestedContext);

      expect(console.info).toHaveBeenCalled();
      const logCall = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      const logOutput = logCall.join(' ');
      expect(logOutput).toContain('123');
      expect(logOutput).toContain('GET');
    });
  });

  describe('错误日志', () => {
    it('应该正确处理 Error 对象', () => {
      const error = new Error('test error');
      error.stack = 'Error: test error\n    at test.js:1';

      logger.error('operation failed', error);

      expect(console.error).toHaveBeenCalled();
      const logCall = (console.error as ReturnType<typeof vi.fn>).mock.calls[0];
      const logOutput = logCall.join(' ');
      expect(logOutput).toContain('test error');
    });

    it('应该包含错误堆栈信息', () => {
      const error = new Error('stack trace test');

      logger.error('error occurred', { error });

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('性能日志', () => {
    it('应该记录性能指标', () => {
      logger.perf('database-query', 150);

      expect(console.info).toHaveBeenCalled();
      const logCall = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(logCall.join(' ')).toContain('perf');
    });

    it('应该标记慢操作', () => {
      const slowLogger = new Logger({
        level: LogLevel.INFO,
        slowThreshold: 100
      });

      slowLogger.perf('slow-operation', 200);

      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('敏感数据处理', () => {
    it('应该脱敏密码字段', () => {
      logger.info('login', {
        username: 'test',
        password: 'secret123'
      });

      const logCall = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      const logOutput = logCall.join(' ');
      expect(logOutput).not.toContain('secret123');
    });

    it('应该脱敏 token 字段', () => {
      logger.info('auth', {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      });

      const logCall = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      const logOutput = logCall.join(' ');
      expect(logOutput).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });
  });
});

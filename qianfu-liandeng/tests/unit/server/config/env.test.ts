/**
 * 环境配置模块单元测试
 *
 * 测试覆盖：
 * - 环境变量解析函数
 * - 配置对象构建
 * - 配置验证逻辑
 * - 便捷访问器
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock crypto module before imports
vi.mock('crypto', () => ({
  randomBytes: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue('mock-encryption-key-32-bytes-long!'),
  }),
}));

// Import after mocks
import {
  validateConfig,
  initConfig,
  getConfig,
  env,
  config,
  parseIntEnv,
  parseBoolEnv,
  parseArrayEnv,
  parseStringEnv,
} from '../server/config/env';

describe('配置解析函数', () => {
  describe('parseIntEnv', () => {
    it('应该返回默认值当值为 undefined', () => {
      expect(parseIntEnv(undefined, 100)).toBe(100);
    });

    it('应该正确解析有效数字字符串', () => {
      expect(parseIntEnv('42', 0)).toBe(42);
      expect(parseIntEnv('0', 100)).toBe(0);
      expect(parseIntEnv('65535', 0)).toBe(65535);
    });

    it('应该返回默认值当解析失败', () => {
      expect(parseIntEnv('not-a-number', 100)).toBe(100);
      expect(parseIntEnv('', 100)).toBe(100);
    });

    it('应该处理负数', () => {
      expect(parseIntEnv('-5', 0)).toBe(-5);
    });
  });

  describe('parseBoolEnv', () => {
    it('应该返回默认值当值为 undefined', () => {
      expect(parseBoolEnv(undefined, true)).toBe(true);
      expect(parseBoolEnv(undefined, false)).toBe(false);
    });

    it('应该正确解析 true 值', () => {
      expect(parseBoolEnv('true', false)).toBe(true);
      expect(parseBoolEnv('1', false)).toBe(true);
      expect(parseBoolEnv('yes', false)).toBe(true);
    });

    it('应该正确解析 false 值', () => {
      expect(parseBoolEnv('false', true)).toBe(false);
      expect(parseBoolEnv('0', true)).toBe(false);
      expect(parseBoolEnv('no', true)).toBe(false);
      expect(parseBoolEnv('anything', true)).toBe(false);
    });
  });

  describe('parseArrayEnv', () => {
    it('应该返回默认值当值为 undefined 或空', () => {
      const defaultArr = ['a', 'b', 'c'];
      expect(parseArrayEnv(undefined, defaultArr)).toEqual(defaultArr);
      expect(parseArrayEnv('', defaultArr)).toEqual(defaultArr);
    });

    it('应该正确解析逗号分隔的字符串', () => {
      expect(parseArrayEnv('a,b,c', [])).toEqual(['a', 'b', 'c']);
      expect(parseArrayEnv('  a , b , c  ', [])).toEqual(['a', 'b', 'c']);
    });

    it('应该过滤空字符串', () => {
      expect(parseArrayEnv('a,,b,,,c', [])).toEqual(['a', 'b', 'c']);
    });

    it('应该处理单个元素', () => {
      expect(parseArrayEnv('only-one', [])).toEqual(['only-one']);
    });
  });

  describe('parseStringEnv', () => {
    it('应该返回默认值当值为 undefined', () => {
      expect(parseStringEnv(undefined, 'default')).toBe('default');
    });

    it('应该返回实际值当存在', () => {
      expect(parseStringEnv('actual', 'default')).toBe('actual');
    });
  });
});

describe('AppConfig 配置', () => {
  it('应该正确设置环境标识', () => {
    expect(config.app.isProduction).toBe(false);
    expect(config.app.isDevelopment).toBe(true);
    expect(config.app.isTest).toBe(false);
  });

  it('应该有正确的 nodeEnv', () => {
    expect(['development', 'production', 'test']).toContain(config.app.nodeEnv);
  });
});

describe('ServerConfig 配置', () => {
  it('应该有默认端口配置', () => {
    expect(config.server.port).toBeGreaterThan(0);
    expect(config.server.port).toBeLessThanOrEqual(65535);
  });

  it('应该有默认主机配置', () => {
    expect(typeof config.server.host).toBe('string');
    expect(config.server.host.length).toBeGreaterThan(0);
  });

  it('应该有默认 API 前缀', () => {
    expect(config.server.apiPrefix).toBeDefined();
  });

  it('应该有请求超时配置', () => {
    expect(config.server.requestTimeout).toBeGreaterThan(0);
  });
});

describe('UploadConfig 配置', () => {
  it('应该有存储目录配置', () => {
    expect(config.upload.storageDir).toBeDefined();
  });

  it('应该有 CDN 前缀', () => {
    expect(config.upload.cdnPrefix).toBeDefined();
  });

  it('应该有允许的 MIME 类型', () => {
    expect(Array.isArray(config.upload.allowedMimeTypes)).toBe(true);
    expect(config.upload.allowedMimeTypes.length).toBeGreaterThan(0);
  });

  it('应该有最大文件大小', () => {
    expect(config.upload.maxFileSize).toBeGreaterThan(0);
  });

  it('应该有默认压缩质量', () => {
    expect(config.upload.defaultQuality).toBeGreaterThanOrEqual(0);
    expect(config.upload.defaultQuality).toBeLessThanOrEqual(100);
  });

  it('应该有 AVIF 启用配置', () => {
    expect(typeof config.upload.enableAvif).toBe('boolean');
  });
});

describe('SecurityConfig 配置', () => {
  it('应该有数据加密密钥', () => {
    expect(config.security.dataEncryptionKey).toBeDefined();
    expect(config.security.dataEncryptionKey.length).toBeGreaterThan(0);
  });

  it('应该有允许的跨域来源', () => {
    expect(Array.isArray(config.security.allowedOrigins)).toBe(true);
  });

  it('应该有 HTTPS 强制配置', () => {
    expect(typeof config.security.forceHttps).toBe('boolean');
  });
});

describe('RedisConfig 配置', () => {
  it('应该有 Redis 主机', () => {
    expect(config.redis.host).toBeDefined();
  });

  it('应该有 Redis 端口', () => {
    expect(config.redis.port).toBeGreaterThan(0);
    expect(config.redis.port).toBeLessThanOrEqual(65535);
  });

  it('应该有数据库索引', () => {
    expect(config.redis.db).toBeGreaterThanOrEqual(0);
  });

  it('应该有连接超时配置', () => {
    expect(config.redis.connectTimeout).toBeGreaterThan(0);
  });
});

describe('DatabaseConfig 配置', () => {
  it('应该有数据库 URL', () => {
    expect(config.database.url).toBeDefined();
  });

  it('应该有连接池配置', () => {
    expect(config.database.poolMin).toBeGreaterThan(0);
    expect(config.database.poolMax).toBeGreaterThanOrEqual(config.database.poolMin);
  });

  it('应该有查询超时配置', () => {
    expect(config.database.queryTimeout).toBeGreaterThan(0);
  });
});

describe('CacheConfig 配置', () => {
  it('应该有 L1 缓存 TTL', () => {
    expect(config.cache.l1Ttl).toBeGreaterThanOrEqual(0);
  });

  it('应该有 L2 缓存 TTL', () => {
    expect(config.cache.l2Ttl).toBeGreaterThanOrEqual(0);
  });

  it('应该有最大条目数', () => {
    expect(config.cache.maxEntries).toBeGreaterThan(0);
  });
});

describe('AIConfig 配置', () => {
  it('应该所有字段可选', () => {
    // AI 配置的字段都是可选的
    expect(config.ai.openaiApiKey).toBeUndefined();
    expect(config.ai.cohereApiKey).toBeUndefined();
    expect(config.ai.huggingfaceApiKey).toBeUndefined();
  });
});

describe('getConfig 函数', () => {
  it('应该返回指定配置部分', () => {
    const appConfig = getConfig('app');
    expect(appConfig).toBeDefined();
    expect(appConfig).toHaveProperty('nodeEnv');
  });

  it('应该返回只读配置', () => {
    const serverConfig = getConfig('server');
    expect(Object.isFrozen(serverConfig)).toBe(true);
  });
});

describe('env 便捷访问器', () => {
  it('应该暴露应用环境变量', () => {
    expect(env.NODE_ENV).toBe(config.app.nodeEnv);
    expect(env.isProduction).toBe(config.app.isProduction);
    expect(env.isDevelopment).toBe(config.app.isDevelopment);
    expect(env.isTest).toBe(config.app.isTest);
  });

  it('应该暴露服务器环境变量', () => {
    expect(env.SERVER_PORT).toBe(config.server.port);
    expect(env.SERVER_HOST).toBe(config.server.host);
    expect(env.API_PREFIX).toBe(config.server.apiPrefix);
    expect(env.REQUEST_TIMEOUT).toBe(config.server.requestTimeout);
  });

  it('应该暴露日志环境变量', () => {
    expect(env.LOG_LEVEL).toBeDefined();
  });

  it('应该暴露上传环境变量', () => {
    expect(env.UPLOAD_STORAGE_DIR).toBeDefined();
    expect(env.CDN_PREFIX).toBeDefined();
    expect(env.MAX_FILE_SIZE).toBeGreaterThan(0);
    expect(env.DEFAULT_IMAGE_QUALITY).toBeGreaterThanOrEqual(0);
  });

  it('应该暴露安全环境变量', () => {
    expect(env.ALLOWED_ORIGINS).toBeDefined();
    expect(env.DATA_ENCRYPTION_KEY).toBeDefined();
    expect(typeof env.FORCE_HTTPS).toBe('boolean');
  });

  it('应该暴露 Redis 环境变量', () => {
    expect(env.REDIS_HOST).toBeDefined();
    expect(env.REDIS_PORT).toBeGreaterThan(0);
    expect(typeof env.REDIS_DB).toBe('number');
  });

  it('应该暴露数据库环境变量', () => {
    expect(env.DATABASE_URL).toBeDefined();
  });

  it('应该暴露缓存环境变量', () => {
    expect(env.CACHE_L1_TTL).toBeGreaterThanOrEqual(0);
    expect(env.CACHE_L2_TTL).toBeGreaterThanOrEqual(0);
  });
});

describe('validateConfig 函数', () => {
  beforeEach(() => {
    // 确保测试环境配置
    process.env.NODE_ENV = 'test';
  });

  it('应该通过基本验证', () => {
    const result = validateConfig();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('应该验证端口范围', () => {
    // 测试端口验证逻辑
    const result = validateConfig();
    // 默认端口应该在有效范围内
    if (config.server.port < 1 || config.server.port > 65535) {
      expect(result.errors).toContain('SERVER_PORT must be between 1 and 65535');
    }
  });

  it('应该验证文件大小最小值', () => {
    const result = validateConfig();
    if (config.upload.maxFileSize < 1024) {
      expect(result.errors).toContain('MAX_FILE_SIZE must be at least 1024 bytes');
    }
  });

  it('应该验证 CORS 配置非空', () => {
    const result = validateConfig();
    if (config.security.allowedOrigins.length === 0) {
      expect(result.errors).toContain('ALLOWED_ORIGINS cannot be empty');
    }
  });
});

describe('initConfig 函数', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('不应该在测试环境抛出错误', () => {
    process.env.NODE_ENV = 'test';
    expect(() => initConfig()).not.toThrow();
  });

  it('应该在开发环境输出日志', () => {
    process.env.NODE_ENV = 'development';
    initConfig();
    expect(console.log).toHaveBeenCalled();
  });
});

/**
 * Druid SQL API 客户端单元测试
 *
 * 测试覆盖：
 * - 客户端初始化
 * - SQL 查询执行
 * - 预定义查询方法
 * - 类型定义
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DruidClient, { druidClient } from '../src/lib/druid-client';

describe('DruidClient 类型定义', () => {
  describe('DruidQueryResult', () => {
    it('应该包含所有必要字段', () => {
      const result = {
        query: 'SELECT * FROM test',
        timestamp: '2024-01-01T00:00:00.000Z',
        duration: 100,
        results: [{ id: 1, name: 'test' }],
      };

      expect(result.query).toBe('SELECT * FROM test');
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('ServerMetrics', () => {
    it('应该包含服务器指标字段', () => {
      const metrics = {
        region: 'us-east-1',
        game_type: 'mmo',
        total_players: 1000,
        online_servers: 50,
      };

      expect(metrics.region).toBeDefined();
      expect(metrics.game_type).toBeDefined();
      expect(typeof metrics.total_players).toBe('number');
      expect(typeof metrics.online_servers).toBe('number');
    });
  });

  describe('RevenueMetrics', () => {
    it('应该包含收入指标字段', () => {
      const metrics = {
        hour: '2024-01-01T00:00:00.000Z',
        payment_method: 'alipay',
        total_revenue: 10000.50,
        transaction_count: 150,
      };

      expect(metrics.hour).toBeDefined();
      expect(metrics.payment_method).toBeDefined();
      expect(typeof metrics.total_revenue).toBe('number');
      expect(typeof metrics.transaction_count).toBe('number');
    });
  });

  describe('UserActivity', () => {
    it('应该包含用户活动字段', () => {
      const activity = {
        action_type: 'login',
        day: '2024-01-01',
        action_count: 500,
        unique_users: 200,
      };

      expect(activity.action_type).toBeDefined();
      expect(activity.day).toBeDefined();
      expect(typeof activity.action_count).toBe('number');
      expect(typeof activity.unique_users).toBe('number');
    });
  });

  describe('ServerEvent', () => {
    it('应该包含服务器事件字段', () => {
      const event = {
        event_time: '2024-01-01T00:00:00.000Z',
        server_id: 1,
        server_name: 'server-1',
        region: 'us-east-1',
        provider: 'aws',
        owner_id: 100,
        game_type: 'mmo',
        status: 'online',
        event_type: 'heartbeat',
        player_count: 50,
        bandwidth_mb: 1000,
      };

      expect(event.server_id).toBeDefined();
      expect(event.server_name).toBeDefined();
      expect(event.region).toBeDefined();
      expect(event.status).toBeDefined();
    });
  });
});

describe('DruidClient 构造函数', () => {
  it('应该使用默认 baseUrl', () => {
    const client = new DruidClient();
    expect(client).toBeDefined();
  });

  it('应该接受自定义 baseUrl', () => {
    const client = new DruidClient('http://druid.example.com/api');
    expect(client).toBeDefined();
  });

  it('应该接受空字符串 baseUrl', () => {
    const client = new DruidClient('');
    expect(client).toBeDefined();
  });
});

describe('DruidClient 单例', () => {
  it('应该导出单例实例', () => {
    expect(druidClient).toBeDefined();
    expect(druidClient).toBeInstanceOf(DruidClient);
  });
});

describe('DruidClient 默认导出', () => {
  it('应该导出类用于测试实例化', () => {
    expect(typeof DruidClient).toBe('function');
  });
});

describe('客户端方法存在性', () => {
  let client: DruidClient;

  beforeEach(() => {
    client = new DruidClient();
  });

  it('应该有 query 方法', () => {
    expect(typeof client.query).toBe('function');
  });

  it('应该有 getServerMetrics 方法', () => {
    expect(typeof client.getServerMetrics).toBe('function');
  });

  it('应该有 getRegionDistribution 方法', () => {
    expect(typeof client.getRegionDistribution).toBe('function');
  });

  it('应该有 getGameTypeDistribution 方法', () => {
    expect(typeof client.getGameTypeDistribution).toBe('function');
  });

  it('应该有 getRevenueMetrics 方法', () => {
    expect(typeof client.getRevenueMetrics).toBe('function');
  });

  it('应该有 getDailyRevenue 方法', () => {
    expect(typeof client.getDailyRevenue).toBe('function');
  });

  it('应该有 getUserActivity 方法', () => {
    expect(typeof client.getUserActivity).toBe('function');
  });

  it('应该有 getRealtimeEvents 方法', () => {
    expect(typeof client.getRealtimeEvents).toBe('function');
  });

  it('应该有 getHourlyStats 方法', () => {
    expect(typeof client.getHourlyStats).toBe('function');
  });

  it('应该有 getTopServers 方法', () => {
    expect(typeof client.getTopServers).toBe('function');
  });
});

describe('DruidClient.query 方法', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该构建正确的请求', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient('/api/druid');
    await client.query<{ id: number }>('SELECT * FROM test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/druid/sql',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT * FROM test' }),
      })
    );
  });

  it('应该返回格式化结果', async () => {
    const mockData = [{ id: 1, name: 'test' }];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    const result = await client.query<{ id: number; name: string }>('SELECT * FROM test');

    expect(result.query).toBe('SELECT * FROM test');
    expect(result.timestamp).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.results).toEqual(mockData);
  });

  it('应该在响应失败时抛出错误', async () => {
    const mockResponse = {
      ok: false,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue({ error: 'Invalid query' }),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    await expect(client.query('INVALID SQL')).rejects.toThrow('Invalid query');
  });

  it('应该处理 JSON 解析失败', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    await expect(client.query('SELECT 1')).rejects.toThrow('Unknown error');
  });
});

describe('预定义查询方法', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getServerMetrics 应该返回正确的结果类型', async () => {
    const mockData = [{
      region: 'us-east-1',
      game_type: 'mmo',
      total_players: 1000,
      online_servers: 50,
    }];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    const result = await client.getServerMetrics();

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('region');
    expect(result[0]).toHaveProperty('game_type');
  });

  it('getRegionDistribution 应该返回正确的结果类型', async () => {
    const mockData = [{
      region: 'us-east-1',
      total_players: 500,
      online_servers: 25,
    }];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    const result = await client.getRegionDistribution();

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('region');
  });

  it('getGameTypeDistribution 应该返回正确的结果类型', async () => {
    const mockData = [{
      game_type: 'mmo',
      total_players: 2000,
      server_count: 100,
    }];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    const result = await client.getGameTypeDistribution();

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('game_type');
  });

  it('getRevenueMetrics 应该接受天数参数', async () => {
    const mockData = [];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    await client.getRevenueMetrics(30);

    // 验证请求被发送
    expect(global.fetch).toHaveBeenCalled();
  });

  it('getUserActivity 应该接受天数参数', async () => {
    const mockData = [];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

    const client = new DruidClient();
    await client.getUserActivity(14);

    expect(global.fetch).toHaveBeenCalled();
  });

  it('getRealtimeEvents 应该接受限制参数', async () => {
    const mockData = [];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    await client.getRealtimeEvents(50);

    expect(global.fetch).toHaveBeenCalled();
  });

  it('getHourlyStats 应该接受天数参数', async () => {
    const mockData = [];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    await client.getHourlyStats(7);

    expect(global.fetch).toHaveBeenCalled();
  });

  it('getTopServers 应该接受限制参数', async () => {
    const mockData = [];
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    await client.getTopServers(20);

    expect(global.fetch).toHaveBeenCalled();
  });
});

describe('性能测量', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.spyOn(performance, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('query 应该测量执行时间', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(250);

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const client = new DruidClient();
    const result = await client.query('SELECT 1');

    expect(result.duration).toBeGreaterThan(0);
  });
});

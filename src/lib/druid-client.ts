/**
 * Druid SQL API 客户端
 *
 * 提供对 Apache Druid SQL API 的类型安全访问
 */

export interface DruidQueryResult<T> {
  query: string;
  timestamp: string;
  duration: number;
  results: T[];
}

export interface ServerMetrics {
  region: string;
  game_type: string;
  total_players: number;
  online_servers: number;
}

export interface RevenueMetrics {
  hour: string;
  payment_method: string;
  total_revenue: number;
  transaction_count: number;
}

export interface UserActivity {
  action_type: string;
  day: string;
  action_count: number;
  unique_users: number;
}

export interface ServerEvent {
  event_time: string;
  server_id: number;
  server_name: string;
  region: string;
  provider: string;
  owner_id: number;
  game_type: string;
  status: string;
  event_type: string;
  player_count: number;
  bandwidth_mb: number;
}

class DruidClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/druid') {
    this.baseUrl = baseUrl;
  }

  /**
   * 执行 Druid SQL 查询
   */
  async query<T>(sql: string): Promise<DruidQueryResult<T>> {
    const startTime = performance.now();

    const response = await fetch(`${this.baseUrl}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Druid query failed: ${response.statusText}`);
    }

    const results: T[] = await response.json();
    const duration = performance.now() - startTime;

    return {
      query: sql,
      timestamp: new Date().toISOString(),
      duration,
      results,
    };
  }

  /**
   * 获取服务器实时指标
   */
  async getServerMetrics(): Promise<ServerMetrics[]> {
    const sql = `
      SELECT
        region,
        game_type,
        SUM(player_count) AS total_players,
        COUNT(DISTINCT server_id) AS online_servers
      FROM server_events
      WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR
      GROUP BY region, game_type
    `;
    return this.query<ServerMetrics>(sql).then(r => r.results);
  }

  /**
   * 获取区域分布统计
   */
  async getRegionDistribution(): Promise<Array<{
    region: string;
    total_players: number;
    online_servers: number;
  }>> {
    const sql = `
      SELECT
        region,
        SUM(player_count) AS total_players,
        COUNT(DISTINCT server_id) AS online_servers
      FROM server_events
      WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
      GROUP BY region
      ORDER BY total_players DESC
    `;
    return this.query<{ region: string; total_players: number; online_servers: number }>(sql).then(r => r.results);
  }

  /**
   * 获取游戏类型分布
   */
  async getGameTypeDistribution(): Promise<Array<{
    game_type: string;
    total_players: number;
    server_count: number;
  }>> {
    const sql = `
      SELECT
        game_type,
        SUM(player_count) AS total_players,
        COUNT(DISTINCT server_id) AS server_count
      FROM server_events
      WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
      GROUP BY game_type
      ORDER BY total_players DESC
    `;
    return this.query<{ game_type: string; total_players: number; server_count: number }>(sql).then(r => r.results);
  }

  /**
   * 获取收入统计
   */
  async getRevenueMetrics(days: number = 7): Promise<RevenueMetrics[]> {
    const sql = `
      SELECT
        FLOOR(__time TO HOUR) AS hour,
        payment_method,
        SUM(amount) AS total_revenue,
        COUNT(*) AS transaction_count
      FROM payment_transactions
      WHERE status = 'completed'
        AND __time >= CURRENT_TIMESTAMP - INTERVAL '${days}' DAY
      GROUP BY FLOOR(__time TO HOUR), payment_method
      ORDER BY hour DESC
    `;
    return this.query<RevenueMetrics>(sql).then(r => r.results);
  }

  /**
   * 获取日收入趋势
   */
  async getDailyRevenue(days: number = 30): Promise<Array<{
    day: string;
    total_revenue: number;
    transaction_count: number;
  }>> {
    const sql = `
      SELECT
        FLOOR(__time TO DAY) AS day,
        SUM(amount) AS total_revenue,
        COUNT(*) AS transaction_count
      FROM payment_transactions
      WHERE status = 'completed'
        AND __time >= CURRENT_TIMESTAMP - INTERVAL '${days}' DAY
      GROUP BY FLOOR(__time TO DAY)
      ORDER BY day DESC
    `;
    return this.query<{ day: string; total_revenue: number; transaction_count: number }>(sql).then(r => r.results);
  }

  /**
   * 获取用户活跃度统计
   */
  async getUserActivity(days: number = 7): Promise<UserActivity[]> {
    const sql = `
      SELECT
        action_type,
        FLOOR(__time TO DAY) AS day,
        COUNT(*) AS action_count,
        COUNT(DISTINCT user_id) AS unique_users
      FROM user_actions
      WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '${days}' DAY
      GROUP BY action_type, FLOOR(__time TO DAY)
      ORDER BY day DESC, action_count DESC
    `;
    return this.query<UserActivity>(sql).then(r => r.results);
  }

  /**
   * 获取实时事件流
   */
  async getRealtimeEvents(limit: number = 100): Promise<ServerEvent[]> {
    const sql = `
      SELECT *
      FROM server_events
      WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR
      ORDER BY __time DESC
      LIMIT ${limit}
    `;
    return this.query<ServerEvent>(sql).then(r => r.results);
  }

  /**
   * 获取每小时统计
   */
  async getHourlyStats(days: number = 1): Promise<Array<{
    hour: string;
    total_players: number;
    total_bandwidth: number;
    event_count: number;
  }>> {
    const sql = `
      SELECT
        FLOOR(__time TO HOUR) AS hour,
        SUM(player_count) AS total_players,
        SUM(bandwidth_mb) AS total_bandwidth,
        COUNT(*) AS event_count
      FROM server_events
      WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '${days}' DAY
      GROUP BY FLOOR(__time TO HOUR)
      ORDER BY hour DESC
    `;
    return this.query<{ hour: string; total_players: number; total_bandwidth: number; event_count: number }>(sql).then(r => r.results);
  }

  /**
   * 获取 Top 服务器
   */
  async getTopServers(limit: number = 10): Promise<Array<{
    server_name: string;
    region: string;
    game_type: string;
    max_players: number;
    total_bandwidth: number;
  }>> {
    const sql = `
      SELECT
        server_name,
        ANY_VALUE(region) AS region,
        ANY_VALUE(game_type) AS game_type,
        MAX(player_count) AS max_players,
        SUM(bandwidth_mb) AS total_bandwidth
      FROM server_events
      WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
      GROUP BY server_name
      ORDER BY max_players DESC
      LIMIT ${limit}
    `;
    return this.query<{ server_name: string; region: string; game_type: string; max_players: number; total_bandwidth: number }>(sql).then(r => r.results);
  }
}

// 导出单例
export const druidClient = new DruidClient();

// 默认导出客户端类，便于测试时创建新实例
export default DruidClient;

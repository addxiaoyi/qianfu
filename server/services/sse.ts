/**
 * Server-Sent Events (SSE) 实时推送服务
 * 优化项 24: 实时订阅 - Server-Sent Events
 *
 * 功能:
 * - SSE 连接管理
 * - 事件广播
 * - 心跳保活
 * - 认证与授权
 * - 连接限流
 */

import { Request, Response } from 'express';

// 简化的日志输出
const log = {
  info: (message: string, meta?: object) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[SSE] ${message}`, meta || '');
    }
  },
  error: (message: string, meta?: object) => {
    console.error(`[SSE] ${message}`, meta || '');
  },
  debug: (message: string, meta?: object) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SSE] ${message}`, meta || '');
    }
  },
};

// ============== 类型定义 ==============

/** SSE 事件数据 */
export interface SSEEvent {
  /** 事件类型 */
  event: string;
  /** 事件数据 */
  data: unknown;
  /** 事件 ID (可选，用于断点重连) */
  id?: string;
  /** 重试间隔 (毫秒，可选) */
  retry?: number;
}

/** SSE 连接信息 */
export interface SSEConnection {
  /** 连接 ID */
  id: string;
  /** 用户 ID (如果有) */
  userId?: string;
  /** 客户端 ID (用于无用户场景) */
  clientId?: string;
  /** 订阅的事件频道 */
  channels: Set<string>;
  /** 创建时间 */
  createdAt: Date;
  /** 最后活动时间 */
  lastActivity: Date;
  /** 请求对象 (用于关闭连接) */
  response: Response;
}

/** SSE 配置 */
export interface SSEConfig {
  /** 心跳间隔 (毫秒) */
  heartbeatInterval: number;
  /** 最大连接数 */
  maxConnections: number;
  /** 连接超时 (毫秒) */
  connectionTimeout: number;
  /** 最大事件队列长度 */
  maxEventQueueSize: number;
  /** 是否启用认证 */
  requireAuth: boolean;
  /** 允许的频道 */
  allowedChannels: string[];
}

/** 事件处理器类型 */
export type EventHandler = (data: unknown, connection: SSEConnection) => void | Promise<void>;

// ============== 默认配置 ==============

const DEFAULT_CONFIG: SSEConfig = {
  heartbeatInterval: 30000,        // 30秒心跳
  maxConnections: 1000,           // 最多1000并发连接
  connectionTimeout: 3600000,     // 1小时超时
  maxEventQueueSize: 100,        // 最多100条待发送事件
  requireAuth: true,             // 默认需要认证
  allowedChannels: ['notification', 'progress', 'chat', 'order', 'system'],
};

// ============== SSE 服务类 =============

class SSEService {
  private connections: Map<string, SSEConnection> = new Map();
  private config: SSEConfig;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, EventHandler> = new Map();

  constructor(config: Partial<SSEConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHeartbeat();
    this.startCleanup();
  }

  // ============== 公开方法 =============

  /**
   * 建立 SSE 连接
   */
  connect(
    req: Request,
    res: Response,
    options: {
      userId?: string;
      clientId?: string;
      channels?: string[];
    } = {}
  ): string {
    // 连接数限制
    if (this.connections.size >= this.config.maxConnections) {
      res.status(503).json({
        success: false,
        error: 'SERVER_BUSY',
        message: '服务器繁忙，请稍后再试',
      });
      throw new Error('Max connections reached');
    }

    const { userId, clientId, channels = ['notification'] } = options;

    // 权限检查
    if (this.config.requireAuth && !userId && !clientId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '需要认证才能建立 SSE 连接',
      });
      throw new Error('Authentication required');
    }

    // 频道验证
    const validChannels = channels.filter(ch =>
      this.config.allowedChannels.includes(ch)
    );

    if (validChannels.length === 0) {
      res.status(400).json({
        success: false,
        error: 'INVALID_CHANNEL',
        message: '未授权的频道',
      });
      throw new Error('No valid channels');
    }

    // 生成连接 ID
    const connectionId = this.generateConnectionId();

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // 禁用 Nginx 缓冲
    });

    // 发送初始连接事件
    this.sendEvent(res, {
      event: 'connected',
      data: {
        connectionId,
        channels: validChannels,
        heartbeat: this.config.heartbeatInterval,
      },
    });

    // 创建连接对象
    const connection: SSEConnection = {
      id: connectionId,
      userId,
      clientId,
      channels: new Set(validChannels),
      createdAt: new Date(),
      lastActivity: new Date(),
      response: res,
    };

    this.connections.set(connectionId, connection);

    log.info('[SSE] New connection', {
      connectionId,
      userId,
      clientId,
      channels: validChannels,
      totalConnections: this.connections.size,
    });

    // 处理客户端关闭连接
    req.on('close', () => {
      this.disconnect(connectionId);
    });

    return connectionId;
  }

  /**
   * 断开 SSE 连接
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      connection.response.end();
    } catch (e) {
      // 忽略关闭错误
    }

    this.connections.delete(connectionId);

    log.info('[SSE] Connection closed', {
      connectionId,
      userId: connection.userId,
      totalConnections: this.connections.size,
    });
  }

  /**
   * 向指定连接发送事件
   */
  send(connectionId: string, event: SSEEvent): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    // 检查是否订阅了该事件频道
    if (!connection.channels.has(event.event) && event.event !== 'connected') {
      return false;
    }

    try {
      this.sendEvent(connection.response, event);
      connection.lastActivity = new Date();
      return true;
    } catch (error) {
      log.error('[SSE] Failed to send event', { error, connectionId });
      this.disconnect(connectionId);
      return false;
    }
  }

  /**
   * 广播事件到指定频道
   */
  broadcast(channel: string, event: Omit<SSEEvent, 'event'>): number {
    let sentCount = 0;

    for (const [id, connection] of this.connections) {
      if (!connection.channels.has(channel)) continue;

      try {
        this.sendEvent(connection.response, {
          event: channel,
          ...event,
        });
        connection.lastActivity = new Date();
        sentCount++;
      } catch (error) {
        log.error('[SSE] Broadcast error', { error, connectionId: id });
        this.disconnect(id);
      }
    }

    log.debug('[SSE] Broadcast', { channel, sentCount });
    return sentCount;
  }

  /**
   * 向用户发送事件 (根据 userId)
   */
  sendToUser(userId: string, event: SSEEvent): number {
    let sentCount = 0;

    for (const [id, connection] of this.connections) {
      if (connection.userId !== userId) continue;

      if (this.send(id, event)) sentCount++;
    }

    return sentCount;
  }

  /**
   * 向客户端发送事件 (根据 clientId)
   */
  sendToClient(clientId: string, event: SSEEvent): number {
    let sentCount = 0;

    for (const [id, connection] of this.connections) {
      if (connection.clientId !== clientId) continue;

      if (this.send(id, event)) sentCount++;
    }

    return sentCount;
  }

  /**
   * 注册事件处理器
   */
  on(event: string, handler: EventHandler): void {
    this.eventHandlers.set(event, handler);
  }

  /**
   * 移除事件处理器
   */
  off(event: string): void {
    this.eventHandlers.delete(event);
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    totalConnections: number;
    byChannel: Record<string, number>;
    byUser: number;
    uptime: number;
  } {
    const byChannel: Record<string, number> = {};
    let byUser = 0;

    for (const connection of this.connections.values()) {
      // 统计频道
      for (const channel of connection.channels) {
        byChannel[channel] = (byChannel[channel] || 0) + 1;
      }
      // 统计用户连接
      if (connection.userId) byUser++;
    }

    return {
      totalConnections: this.connections.size,
      byChannel,
      byUser,
      uptime: process.uptime(),
    };
  }

  /**
   * 获取连接信息
   */
  getConnection(connectionId: string): SSEConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 关闭所有连接 (用于服务停止)
   */
  closeAll(): void {
    for (const [id] of this.connections) {
      this.disconnect(id);
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    log.info('[SSE] All connections closed');
  }

  // ============== 私有方法 =============

  /**
   * 发送 SSE 事件
   */
  private sendEvent(res: Response, event: SSEEvent): void {
    const parts: string[] = [];

    if (event.event) {
      parts.push(`event: ${event.event}`);
    }

    if (event.id !== undefined) {
      parts.push(`id: ${event.id}`);
    }

    if (event.retry !== undefined) {
      parts.push(`retry: ${event.retry}`);
    }

    // 多行数据处理
    const dataStr = JSON.stringify(event.data);
    parts.push(`data: ${dataStr.replace(/\n/g, '\ndata: ')}`);

    res.write(parts.join('\n') + '\n\n');
  }

  /**
   * 生成连接 ID
   */
  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [id, connection] of this.connections) {
        try {
          this.sendEvent(connection.response, {
            event: 'heartbeat',
            data: { timestamp: new Date().toISOString() },
          });
        } catch (error) {
          // 连接已断开
          this.disconnect(id);
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 启动清理定时器
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.connectionTimeout;

      for (const [id, connection] of this.connections) {
        const inactive = now - connection.lastActivity.getTime();
        if (inactive > timeout) {
          log.info('[SSE] Connection timeout', { id, inactive });
          this.disconnect(id);
        }
      }
    }, 60000); // 每分钟检查一次
  }
}

// ============== 单例导出 =============

let sseServiceInstance: SSEService | null = null;

export function initSSE(config?: Partial<SSEConfig>): SSEService {
  sseServiceInstance = new SSEService(config);
  return sseServiceInstance;
}

export function getSSE(): SSEService | null {
  return sseServiceInstance;
}

export function getSSEOrThrow(): SSEService {
  if (!sseServiceInstance) {
    throw new Error('SSE service not initialized. Call initSSE first.');
  }
  return sseServiceInstance;
}

export type { SSEEvent, SSEConnection, SSEConfig, EventHandler };

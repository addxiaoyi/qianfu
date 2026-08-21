# 优化项24: 实时订阅 - Server-Sent Events

## 功能概述

Server-Sent Events (SSE) 是一种服务器向客户端推送数据的轻量级实时通信方案。与 WebSocket 相比，SSE 更适合单向数据流场景，具有以下优势：

- 基于 HTTP 协议，无需特殊协议支持
- 自动重连机制
- 简单易用，兼容性好
- 占用资源少，适合大规模连接

## 应用场景

1. **实时通知** - 系统公告、消息推送、告警通知
2. **进度更新** - 长任务进度、大文件处理进度
3. **数据同步** - 仪表盘数据实时刷新、排行榜更新
4. **客服状态** - 智能客服响应流式输出
5. **订单状态** - 订单处理状态实时更新

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (浏览器)                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              EventSource API                         │  │
│  │  - 自动重连                                          │  │
│  │  - 事件处理                                          │  │
│  │  - 连接管理                                          │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP / SSE
┌─────────────────────────────────────────────────────────────┐
│                      Server (Express)                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              SSE 中间件                               │  │
│  │  - 连接管理 (Map<id, Response>)                      │  │
│  │  - 心跳保活                                          │  │
│  │  - 认证验证                                          │  │
│  │  - 事件广播                                          │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              事件类型处理器                          │  │
│  │  - notification (系统通知)                          │  │
│  │  - progress (进度更新)                               │  │
│  │  - chat (客服消息)                                  │  │
│  │  - order (订单状态)                                 │  │
│  │  - custom (自定义事件)                              │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 实现代码

### 1. SSE 服务模块

创建文件: `server/services/sse.ts`

```typescript
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
import { logger } from '../lib/logger';
import { env } from '../config/env';

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

// ============== SSE 服务类 ==============

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

  // ============== 公开方法 ==============

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

    logger.info('[SSE] New connection', {
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

    logger.info('[SSE] Connection closed', {
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
      logger.error('[SSE] Failed to send event', { error, connectionId });
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
        logger.error('[SSE] Broadcast error', { error, connectionId: id });
        this.disconnect(id);
      }
    }

    logger.debug('[SSE] Broadcast', { channel, sentCount });
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

    logger.info('[SSE] All connections closed');
  }

  // ============== 私有方法 ==============

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
          logger.info('[SSE] Connection timeout', { id, inactive });
          this.disconnect(id);
        }
      }
    }, 60000); // 每分钟检查一次
  }
}

// ============== 单例导出 ==============

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
```

### 2. SSE 路由

创建文件: `server/routes/sse.ts`

```typescript
/**
 * SSE 实时推送 API 路由
 * 优化项 24: 实时订阅 - Server-Sent Events
 *
 * 提供以下 API 端点:
 * - GET  /api/sse/connect     - 建立 SSE 连接
 * - GET  /api/sse/channels    - 获取可用频道
 * - POST /api/sse/broadcast   - 广播事件 (需要管理员权限)
 * - POST /api/sse/send        - 发送事件到指定用户/客户端
 * - GET  /api/sse/status      - 获取 SSE 服务状态
 */

import { Router, Request, Response } from 'express';
import { getSSE, SSEEvent } from '../services/sse';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ============== 中间件 ==============

/**
 * SSE 连接认证中间件
 */
function requireSSEAuth(req: Request, res: Response, next: Function): void {
  // 检查是否有用户信息
  const userId = (req as any).userId;
  const clientId = req.query.clientId as string | undefined;

  if (!userId && !clientId) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '需要登录或提供 clientId',
    });
    return;
  }

  next();
}

// ============== 路由处理 ==============

/**
 * GET /api/sse/connect
 * 建立 SSE 连接
 * 
 * Query 参数:
 * - channels: 订阅的频道,逗号分隔 (默认: notification)
 * - clientId: 客户端 ID (未登录用户需要)
 * 
 * 响应: SSE 流
 */
router.get('/connect', requireSSEAuth, (req: Request, res: Response) => {
  const sse = getSSE();
  if (!sse) {
    res.status(500).json({
      success: false,
      error: 'SSE_NOT_INITIALIZED',
      message: 'SSE 服务未初始化',
    });
    return;
  }

  const userId = (req as any).userId;
  const clientId = req.query.clientId as string | undefined;
  const channelsParam = req.query.channels as string;
  
  const channels = channelsParam 
    ? channelsParam.split(',').map(c => c.trim()).filter(Boolean)
    : ['notification'];

  try {
    sse.connect(req, res, {
      userId,
      clientId,
      channels,
    });
  } catch (error) {
    // 连接失败,错误已在 connect 方法中处理
    logger.error('[SSE] Connection failed', { error });
  }
});

/**
 * GET /api/sse/channels
 * 获取可用频道列表
 */
router.get('/channels', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      channels: [
        {
          name: 'notification',
          description: '系统通知',
          requiresAuth: true,
        },
        {
          name: 'progress',
          description: '任务进度',
          requiresAuth: false,
        },
        {
          name: 'chat',
          description: '客服消息',
          requiresAuth: true,
        },
        {
          name: 'order',
          description: '订单状态',
          requiresAuth: true,
        },
        {
          name: 'system',
          description: '系统消息',
          requiresAuth: false,
        },
      ],
    },
  });
});

/**
 * POST /api/sse/broadcast
 * 广播事件到指定频道 (需要管理员权限)
 * 
 * 请求体:
 * {
 *   channel: string,        // 频道名称
 *   event: string,          // 事件类型
 *   data: unknown,          // 事件数据
 *   id?: string,            // 事件 ID
 *   retry?: number          // 重试间隔
 * }
 */
router.post('/broadcast', requireRole('admin', 'super_admin'), (req: Request, res: Response) => {
  const sse = getSSE();
  if (!sse) {
    res.status(500).json({
      success: false,
      error: 'SSE_NOT_INITIALIZED',
      message: 'SSE 服务未初始化',
    });
    return;
  }

  const { channel, event, data, id, retry } = req.body;

  if (!channel || !event || data === undefined) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必要参数: channel, event, data',
    });
    return;
  }

  const sentCount = sse.broadcast(channel, {
    event,
    data,
    id,
    retry,
  });

  res.json({
    success: true,
    data: {
      channel,
      event,
      sentCount,
    },
  });
});

/**
 * POST /api/sse/send
 * 发送事件到指定用户或客户端 (需要管理员权限)
 * 
 * 请求体:
 * {
 *   userId?: string,       // 用户 ID
 *   clientId?: string,     // 客户端 ID
 *   event: string,        // 事件类型
 *   data: unknown,        // 事件数据
 *   id?: string,          // 事件 ID
 * }
 */
router.post('/send', requireRole('admin', 'super_admin'), (req: Request, res: Response) => {
  const sse = getSSE();
  if (!sse) {
    res.status(500).json({
      success: false,
      error: 'SSE_NOT_INITIALIZED',
      message: 'SSE 服务未初始化',
    });
    return;
  }

  const { userId, clientId, event, data, id } = req.body;

  if (!event || data === undefined) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必要参数: event, data',
    });
    return;
  }

  if (!userId && !clientId) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '需要提供 userId 或 clientId',
    });
    return;
  }

  let sentCount = 0;
  const eventObj: SSEEvent = { event, data, id };

  if (userId) {
    sentCount = sse.sendToUser(userId, eventObj);
  } else if (clientId) {
    sentCount = sse.sendToClient(clientId, eventObj);
  }

  res.json({
    success: true,
    data: {
      target: userId || clientId,
      event,
      sentCount,
    },
  });
});

/**
 * GET /api/sse/status
 * 获取 SSE 服务状态 (需要管理员权限)
 */
router.get('/status', requireRole('admin', 'super_admin'), (req: Request, res: Response) => {
  const sse = getSSE();
  if (!sse) {
    res.status(500).json({
      success: false,
      error: 'SSE_NOT_INITIALIZED',
      message: 'SSE 服务未初始化',
    });
    return;
  }

  const status = sse.getStatus();

  res.json({
    success: true,
    data: status,
  });
});

// ============== 导入 ==============

import { logger } from '../lib/logger';

export default router;
```

### 3. 前端使用示例

```typescript
/**
 * SSE 客户端 Hook
 * 使用示例
 */

// 建立连接
const connectSSE = (userId: string, channels: string[] = ['notification']) => {
  const eventSource = new EventSource(
    `/api/sse/connect?userId=${userId}&channels=${channels.join(',')}`
  );

  // 连接成功
  eventSource.addEventListener('connected', (event) => {
    console.log('SSE Connected:', JSON.parse(event.data));
  });

  // 心跳
  eventSource.addEventListener('heartbeat', (event) => {
    console.log('Heartbeat:', JSON.parse(event.data));
  });

  // 系统通知
  eventSource.addEventListener('notification', (event) => {
    const data = JSON.parse(event.data);
    console.log('Notification:', data);
    // 显示通知 toast
    showNotification(data);
  });

  // 进度更新
  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    console.log('Progress:', data);
    updateProgressBar(data);
  });

  // 客服消息
  eventSource.addEventListener('chat', (event) => {
    const data = JSON.parse(event.data);
    console.log('Chat message:', data);
    appendChatMessage(data);
  });

  // 错误处理
  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      console.log('Connection closed, will retry...');
    }
  };

  return eventSource;
};

// 断开连接
const disconnectSSE = (eventSource: EventSource) => {
  if (eventSource) {
    eventSource.close();
  }
};

// 在 React 中使用
import { useEffect, useRef, useState } from 'react';

function useSSE(userId: string, channels: string[]) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) return;

    const es = connectSSE(userId, channels);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
    });

    es.addEventListener('notification', (event) => {
      setNotifications(prev => [...prev, JSON.parse(event.data)]);
    });

    return () => {
      disconnectSSE(es);
      setConnected(false);
    };
  }, [userId, channels.join(',')]);

  return { connected, notifications };
}
```

### 4. 在客服服务中集成 SSE

在 `server/services/customerService.ts` 中添加流式响应支持：

```typescript
/**
 * 发送流式响应到客户端
 */
async function sendStreamResponse(
  sessionId: string,
  chunks: AsyncGenerator<string>
): Promise<void> {
  const sse = getSSE();
  if (!sse) return;

  const connections = sse.getAllConnections().filter(
    c => c.userId && c.channels.has('chat')
  );

  for await (const chunk of chunks) {
    for (const connection of connections) {
      sse.send(connection.id, {
        event: 'chat',
        data: {
          sessionId,
          chunk,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // 发送完成信号
  for (const connection of connections) {
    sse.send(connection.id, {
      event: 'chat',
      data: {
        sessionId,
        done: true,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

## 配置项

在 `server/config/env.ts` 中添加 SSE 相关配置：

```typescript
// SSE 配置
export interface SSEConfig {
  enabled: boolean;
  heartbeatInterval: number;
  maxConnections: number;
  connectionTimeout: number;
}

function buildSSEConfig(): SSEConfig {
  return {
    enabled: parseBoolEnv(process.env.SSE_ENABLED, true),
    heartbeatInterval: parseIntEnv(process.env.SSE_HEARTBEAT_INTERVAL, 30000),
    maxConnections: parseIntEnv(process.env.SSE_MAX_CONNECTIONS, 1000),
    connectionTimeout: parseIntEnv(process.env.SSE_CONNECTION_TIMEOUT, 3600000),
  };
}
```

## 环境变量

```bash
# SSE 配置
SSE_ENABLED=true
SSE_HEARTBEAT_INTERVAL=30000
SSE_MAX_CONNECTIONS=1000
SSE_CONNECTION_TIMEOUT=3600000
```

## 性能优化建议

1. **连接数限制** - 根据服务器资源设置合理的最大连接数
2. **频道分组** - 按功能分组，减少不必要的广播
3. **消息队列** - 对于高并发场景，使用 Redis 发布/订阅
4. **负载均衡** - SSE 不适合水平扩展，建议使用粘性会话
5. **Nginx 配置** - 禁用缓冲，确保实时性

```nginx
# Nginx SSE 配置
location /api/sse/connect {
    proxy_pass http://backend;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400;
}
```

## 测试用例

创建文件: `tests/unit/server/services/sse.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initSSE, getSSE, SSEEvent } from '@server/services/sse';

describe('SSE Service', () => {
  let sse: ReturnType<typeof initSSE>;

  beforeEach(() => {
    sse = initSSE({
      heartbeatInterval: 5000,
      maxConnections: 10,
      connectionTimeout: 60000,
    });
  });

  afterEach(() => {
    sse.closeAll();
  });

  describe('connect', () => {
    it('should create new connection', () => {
      const mockReq = { on: vi.fn() } as any;
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      } as any;

      const connectionId = sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      expect(connectionId).toMatch(/^sse_/);
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));
    });
  });

  describe('broadcast', () => {
    it('should broadcast to subscribed connections', () => {
      const mockReq = { on: vi.fn() } as any;
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      } as any;

      // 创建两个连接
      sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      const sentCount = sse.broadcast('notification', {
        event: 'test',
        data: { message: 'hello' },
      });

      expect(sentCount).toBe(1);
    });
  });

  describe('sendToUser', () => {
    it('should send event to specific user', () => {
      const mockReq = { on: vi.fn() } as any;
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      } as any;

      sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      const sentCount = sse.sendToUser('user1', {
        event: 'notification',
        data: { message: 'Hello User1' },
      });

      expect(sentCount).toBe(1);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      const mockReq = { on: vi.fn() } as any;
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      } as any;

      sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification', 'chat'],
      });

      const status = sse.getStatus();

      expect(status.totalConnections).toBe(1);
      expect(status.byChannel.notification).toBe(1);
      expect(status.byChannel.chat).toBe(1);
      expect(status.byUser).toBe(1);
    });
  });
});
```

## 安全考虑

1. **认证与授权** - SSE 连接需要验证用户身份
2. **连接限流** - 防止恶意大量连接
3. **消息验证** - 验证广播消息的来源和内容
4. **敏感数据** - 避免通过 SSE 传输敏感信息
5. **CSRF 防护** - 使用 JWT 或 Session 验证连接

## 扩展场景

### 与 WebSocket 对比

| 特性 | SSE | WebSocket |
|------|-----|-----------|
| 协议 | HTTP | WS/WSS |
| 方向 | 单向 (服务端→客户端) | 双向 |
| 自动重连 | 原生支持 | 需要手动实现 |
| 二进制数据 | 需要 Base64 | 原生支持 |
| 浏览器兼容 | IE 不支持 | 广泛支持 |
| 负载均衡 | 需要粘性会话 | 支持 |

### 适用场景选择

- **选择 SSE**: 通知推送、进度更新、实时仪表盘、客服消息
- **选择 WebSocket**: 实时聊天、游戏、协作编辑、金融交易

## 更新日志

- 2026-07-06: 初始版本

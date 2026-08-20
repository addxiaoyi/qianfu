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
import { requireRole } from '../middleware/auth';

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

/**
 * DELETE /api/sse/connection/:id
 * 强制断开指定连接 (需要管理员权限)
 */
router.delete('/connection/:id', requireRole('admin', 'super_admin'), (req: Request, res: Response) => {
  const sse = getSSE();
  if (!sse) {
    res.status(500).json({
      success: false,
      error: 'SSE_NOT_INITIALIZED',
      message: 'SSE 服务未初始化',
    });
    return;
  }

  const { id } = req.params;
  const connection = sse.getConnection(id);

  if (!connection) {
    res.status(404).json({
      success: false,
      error: 'CONNECTION_NOT_FOUND',
      message: '连接不存在',
    });
    return;
  }

  sse.disconnect(id);

  res.json({
    success: true,
    message: '连接已断开',
  });
});

export default router;

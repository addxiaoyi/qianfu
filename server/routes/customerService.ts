/**
 * 智能客服路由
 *
 * 提供 REST API 接口访问智能客服功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getCustomerService,
  getCustomerServiceOrThrow,
  ChatRequest,
  ChatSession,
} from '../services/customerService';
import { logger } from '../lib/logger';

const router = Router();

/**
 * 通用错误处理包装
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============== 服务状态 ==============

/**
 * 获取客服服务状态
 * GET /api/customer-service/status
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const service = getCustomerService();

  if (!service) {
    res.json({
      enabled: false,
      activeSessions: 0,
      totalSessions: 0,
    });
    return;
  }

  const status = service.getStatus();
  res.json(status);
}));

// ============== 聊天功能 ==============

/**
 * 发送消息
 * POST /api/customer-service/chat
 *
 * Body:
 * {
 *   "message": "如何重置密码？",
 *   "sessionId": "可选，用于继续对话",
 *   "userId": "可选，用户ID",
 *   "collection": "可选，知识库集合",
 *   "topK": 3
 * }
 */
router.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  const service = getCustomerServiceOrThrow();
  const {
    message,
    sessionId,
    userId,
    collection,
    temperature,
    topK,
  } = req.body as ChatRequest;

  // 参数验证
  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Missing or invalid required field: message',
    });
    return;
  }

  // 消息长度限制
  if (message.length > 2000) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Message too long. Maximum length is 2000 characters.',
    });
    return;
  }

  try {
    const response = await service.chat({
      message: message.trim(),
      sessionId,
      userId,
      collection,
      temperature,
      topK,
    });

    res.json(response);
  } catch (error: any) {
    logger.error('[CustomerService] Chat failed', {
      error: error.message,
      message: message.substring(0, 100),
    });

    res.status(500).json({
      error: 'Chat failed',
      message: 'Failed to process your message. Please try again.',
    });
  }
}));

/**
 * 流式发送消息
 * POST /api/customer-service/chat/stream
 *
 * 与普通聊天相同，但支持流式响应
 */
router.post('/chat/stream', asyncHandler(async (req: Request, res: Response) => {
  const service = getCustomerServiceOrThrow();
  const { message, sessionId, userId, collection } = req.body as ChatRequest;

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Missing or invalid required field: message',
    });
    return;
  }

  // 设置流式响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // 先获取会话或创建新的
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const newResponse = await service.chat({
        message: '初始化',
        userId,
      });
      currentSessionId = newResponse.sessionId;
    }

    // 发送初始会话信息
    res.write(`data: ${JSON.stringify({
      type: 'session',
      sessionId: currentSessionId,
    })}\n\n`);

    // 发送用户消息确认
    res.write(`data: ${JSON.stringify({
      type: 'user_message',
      content: message,
      timestamp: new Date().toISOString(),
    })}\n\n`);

    // 调用聊天服务
    const response = await service.chat({
      message,
      sessionId: currentSessionId,
      userId,
      collection,
    });

    // 发送来源信息
    if (response.sources && response.sources.length > 0) {
      res.write(`data: ${JSON.stringify({
        type: 'sources',
        sources: response.sources,
      })}\n\n`);
    }

    // 发送完整回复
    res.write(`data: ${JSON.stringify({
      type: 'assistant_message',
      content: response.message,
      requiresEscalation: response.requiresEscalation,
      intent: response.intent,
    })}\n\n`);

    // 发送完成信号
    res.write(`data: ${JSON.stringify({
      type: 'done',
      metadata: response.metadata,
    })}\n\n`);

    res.end();
  } catch (error: any) {
    logger.error('[CustomerService] Stream chat failed', {
      error: error.message,
    });

    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message || 'Failed to process message',
    })}\n\n`);

    res.end();
  }
}));

// ============== 会话管理 ==============

/**
 * 获取会话详情
 * GET /api/customer-service/session/:sessionId
 */
router.get('/session/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const service = getCustomerServiceOrThrow();
  const { sessionId } = req.params;

  const session = service.getSession(sessionId);

  if (!session) {
    res.status(404).json({
      error: 'Session not found',
      sessionId,
    });
    return;
  }

  res.json({
    id: session.id,
    userId: session.userId,
    messages: session.messages,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
  });
}));

/**
 * 获取用户会话列表
 * GET /api/customer-service/sessions?userId=xxx
 */
router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
  const service = getCustomerServiceOrThrow();
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Missing required query parameter: userId',
    });
    return;
  }

  const sessions = service.getUserSessions(userId);

  res.json({
    userId,
    sessions: sessions.map(s => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.messages.length,
      lastMessage: s.messages[s.messages.length - 1]?.content || '',
    })),
  });
}));

/**
 * 关闭会话
 * POST /api/customer-service/session/:sessionId/close
 */
router.post('/session/:sessionId/close', asyncHandler(async (req: Request, res: Response) => {
  const service = getCustomerServiceOrThrow();
  const { sessionId } = req.params;

  const closed = service.closeSession(sessionId);

  if (!closed) {
    res.status(404).json({
      error: 'Session not found',
      sessionId,
    });
    return;
  }

  res.json({
    status: 'closed',
    sessionId,
  });
}));

/**
 * 获取会话历史消息
 * GET /api/customer-service/session/:sessionId/messages
 */
router.get('/session/:sessionId/messages', asyncHandler(async (req: Request, res: Response) => {
  const service = getCustomerServiceOrThrow();
  const { sessionId } = req.params;
  const { limit, offset } = req.query;

  const session = service.getSession(sessionId);

  if (!session) {
    res.status(404).json({
      error: 'Session not found',
      sessionId,
    });
    return;
  }

  let messages = session.messages;

  // 分页
  if (limit) {
    const limitNum = parseInt(String(limit), 10);
    const offsetNum = offset ? parseInt(String(offset), 10) : 0;
    messages = messages.slice(offsetNum, offsetNum + limitNum);
  }

  res.json({
    sessionId,
    messages,
    total: session.messages.length,
    hasMore: offset ? (parseInt(String(offset), 10) + messages.length) < session.messages.length : false,
  });
}));

// ============== 工具接口 ==============

/**
 * 检测意图
 * POST /api/customer-service/detect-intent
 *
 * Body:
 * {
 *   "message": "要投诉"
 * }
 */
router.post('/detect-intent', asyncHandler(async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Missing required field: message',
    });
    return;
  }

  // 意图检测逻辑
  const intents = ['greeting', 'inquiry', 'complaint', 'feedback', 'thanks', 'farewell', 'escalation', 'unknown'];
  const keywords: Record<string, string[]> = {
    greeting: ['你好', '您好', 'hi', 'hello', '嗨'],
    inquiry: ['怎么', '如何', '请问', '什么'],
    complaint: ['投诉', '不满', '差评'],
    feedback: ['建议', '反馈', '意见'],
    thanks: ['谢谢', '感谢'],
    farewell: ['再见', '拜拜'],
    escalation: ['人工', '转人工', '客服'],
  };

  const lowerMessage = message.toLowerCase();
  let detectedIntent = 'unknown';

  for (const [intent, words] of Object.entries(keywords)) {
    if (words.some(w => lowerMessage.includes(w))) {
      detectedIntent = intent;
      break;
    }
  }

  res.json({
    message,
    intent: detectedIntent,
    confidence: detectedIntent !== 'unknown' ? 0.9 : 0.5,
  });
}));

/**
 * 知识库问答测试
 * POST /api/customer-service/test-query
 *
 * 用于测试知识库问答，不创建会话
 */
router.post('/test-query', asyncHandler(async (req: Request, res: Response) => {
  const service = getCustomerServiceOrThrow();
  const { message, collection, topK } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Missing required field: message',
    });
    return;
  }

  const response = await service.chat({
    message,
    collection,
    topK,
  });

  res.json({
    query: message,
    response: {
      message: response.message,
      sources: response.sources,
      intent: response.intent,
    },
  });
}));

export default router;

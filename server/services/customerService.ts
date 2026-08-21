/**
 * 智能客服服务
 *
 * 功能:
 * - 多轮会话管理
 * - RAG 知识库问答
 * - 意图识别与转人工
 * - 对话上下文维护
 *
 * 依赖:
 * - server/services/rag: RAG 知识增强服务
 * - server/config/env: 配置管理
 */

import { getRAGService } from './rag';
import { logger } from '../lib/logger';
import { env } from '../config/env';

// ============== 类型定义 ==============

export interface ChatMessage {
  /** 消息 ID */
  id: string;
  /** 角色: user(用户) | assistant(助手) | system(系统) */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp: Date;
  /** 引用来源 (仅助手消息) */
  sources?: SourceReference[];
}

export interface SourceReference {
  /** 来源 ID */
  id: string;
  /** 来源标题 */
  title?: string;
  /** 来源 URL */
  url?: string;
  /** 相关性分数 */
  score: number;
}

export interface ChatSession {
  /** 会话 ID */
  id: string;
  /** 用户 ID (可选) */
  userId?: string;
  /** 消息历史 */
  messages: ChatMessage[];
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
  /** 会话状态 */
  status: 'active' | 'closed' | 'escalated';
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

export interface ChatRequest {
  /** 用户消息 */
  message: string;
  /** 会话 ID (可选，用于继续对话) */
  sessionId?: string;
  /** 用户 ID (可选) */
  userId?: string;
  /** 知识库集合名称 (可选，默认使用配置) */
  collection?: string;
  /** 温度系数 (可选) */
  temperature?: number;
  /** 知识库搜索结果数量 (可选) */
  topK?: number;
}

export interface ChatResponse {
  /** 会话 ID */
  sessionId: string;
  /** 助手回复 */
  message: string;
  /** 引用来源 */
  sources?: SourceReference[];
  /** 是否需要转人工 */
  requiresEscalation: boolean;
  /** 意图分类 */
  intent?: string;
  /** 元数据 */
  metadata?: {
    retrievalTime: number;
    generationTime: number;
    tokensUsed: number;
  };
}

export interface CustomerServiceConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 知识库集合名称 */
  collection: string;
  /** 转人工关键词 */
  escalationKeywords: string[];
  /** 客服模型 */
  llmModel: string;
  /** 温度系数 */
  temperature: number;
  /** 最大历史消息数 */
  maxHistoryLength: number;
  /** 会话超时时间 (毫秒) */
  sessionTimeout: number;
  /** 是否启用意图识别 */
  enableIntentDetection: boolean;
  /** 是否启用情感分析 */
  enableSentimentAnalysis: boolean;
}

// ============== 默认配置 ==============

const DEFAULT_CONFIG: CustomerServiceConfig = {
  enabled: env.CUSTOMER_SERVICE_ENABLED ?? true,
  collection: env.CUSTOMER_SERVICE_COLLECTION || 'customer_service',
  escalationKeywords: ['人工', '转人工', '客服', '投诉', '升级', '经理'],
  llmModel: env.CUSTOMER_SERVICE_LLM_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(String(env.CUSTOMER_SERVICE_TEMPERATURE || '0.7')),
  maxHistoryLength: 20,
  sessionTimeout: 30 * 60 * 1000, // 30 分钟
  enableIntentDetection: false,
  enableSentimentAnalysis: false,
};

// ============== 意图定义 ==============

enum Intent {
  GREETING = 'greeting',           // 问候
  INQUIRY = 'inquiry',             // 咨询
  COMPLAINT = 'complaint',          // 投诉
  FEEDBACK = 'feedback',            // 反馈
  THANKS = 'thanks',                // 感谢
  FAREWELL = 'farewell',            // 道别
  ESCALATION = 'escalation',        // 转人工请求
  UNKNOWN = 'unknown',              // 未知
}

// ============== 客服服务主类 =============

export class CustomerService {
  private config: CustomerServiceConfig;
  private sessions: Map<string, ChatSession> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();

  // 问候语集合
  private greetings = [
    '您好！我是智能客服小千，很高兴为您服务。请问有什么可以帮助您的？',
    '您好！有什么问题我可以帮您解答吗？',
    '欢迎来到客服中心，我是您的智能助手，随时为您服务。',
  ];

  // 感谢回复集合
  private thanksReplies = [
    '不客气！很高兴能帮到您。还有其他问题吗？',
    '谢谢您的认可！如有需要随时联系我。',
    '很高兴为您服务，祝您使用愉快！',
  ];

  // 道别回复集合
  private farewellReplies = [
    '再见！祝您生活愉快！',
    '感谢您的咨询，再见！',
    '祝您一切顺利，再见！',
  ];

  // 意图关键词映射
  private intentKeywords: Record<Intent, string[]> = {
    [Intent.GREETING]: ['你好', '您好', 'hi', 'hello', '嗨', '在吗'],
    [Intent.INQUIRY]: ['怎么', '如何', '请问', '什么', '多少', '哪里', '什么时候', '为什么'],
    [Intent.COMPLAINT]: ['投诉', '不满', '差评', '垃圾', '骗子', '坑', '太差'],
    [Intent.FEEDBACK]: ['建议', '反馈', '意见', '希望', '能不能'],
    [Intent.THANKS]: ['谢谢', '感谢', '辛苦了', '多谢'],
    [Intent.FAREWELL]: ['再见', '拜拜', 'bye', '好哒'],
    [Intent.ESCALATION]: ['人工', '转人工', '客服', '升级', '经理', '真人'],
    [Intent.UNKNOWN]: [],
  };

  constructor(config: Partial<CustomerServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============== 公开方法 ==============

  /**
   * 处理用户消息
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const { message, sessionId, userId, collection, temperature, topK } = request;

    // 获取或创建会话
    let session = sessionId ? this.sessions.get(sessionId) : null;
    const isNewSession = !session;

    if (!session) {
      session = this.createSession(userId);
    }

    // 重置会话超时
    this.resetSessionTimer(session.id);

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    // 意图识别
    const intent = this.detectIntent(message);

    // 意图处理
    let response: ChatResponse;

    switch (intent) {
      case Intent.GREETING:
        response = this.handleGreeting(session, isNewSession);
        break;
      case Intent.THANKS:
        response = this.handleThanks(session);
        break;
      case Intent.FAREWELL:
        response = this.handleFarewell(session);
        break;
      case Intent.ESCALATION:
        response = this.handleEscalation(session, message);
        break;
      default:
        response = await this.handleInquiry(session, message, collection, temperature, topK);
    }

    // 添加助手消息
    const assistantMsg: ChatMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      sources: response.sources,
    };
    session.messages.push(assistantMsg);

    // 修剪历史消息
    this.trimHistory(session);

    // 更新会话
    session.updatedAt = new Date();
    this.sessions.set(session.id, session);

    // 添加元数据
    response.metadata = {
      retrievalTime: response.metadata?.retrievalTime || 0,
      generationTime: Date.now() - startTime,
      tokensUsed: response.metadata?.tokensUsed || 0,
    };

    return response;
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取用户会话列表
   */
  getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * 关闭会话
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'closed';
    this.clearSessionTimer(sessionId);
    logger.info('[CustomerService] Session closed', { sessionId });
    return true;
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    enabled: boolean;
    activeSessions: number;
    totalSessions: number;
  } {
    return {
      enabled: this.config.enabled,
      activeSessions: Array.from(this.sessions.values())
        .filter(s => s.status === 'active').length,
      totalSessions: this.sessions.size,
    };
  }

  // ============== 私有方法 ==============

  /**
   * 创建新会话
   */
  private createSession(userId?: string): ChatSession {
    const session: ChatSession = {
      id: this.generateId(),
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    };

    this.sessions.set(session.id, session);

    logger.info('[CustomerService] New session created', {
      sessionId: session.id,
      userId,
    });

    return session;
  }

  /**
   * 意图识别
   */
  private detectIntent(message: string): Intent {
    const lowerMessage = message.toLowerCase().trim();

    // 检查是否匹配任何意图关键词
    for (const [intent, keywords] of Object.entries(this.intentKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
        return intent as Intent;
      }
    }

    // 默认按咨询处理
    return Intent.INQUIRY;
  }

  /**
   * 处理问候
   */
  private handleGreeting(session: ChatSession, isNewSession: boolean): ChatResponse {
    const greeting = isNewSession
      ? this.greetings[Math.floor(Math.random() * this.greetings.length)]
      : '您好！很高兴再次为您服务。请问有什么问题吗？';

    return {
      sessionId: session.id,
      message: greeting,
      requiresEscalation: false,
      intent: Intent.GREETING,
    };
  }

  /**
   * 处理感谢
   */
  private handleThanks(session: ChatSession): ChatResponse {
    return {
      sessionId: session.id,
      message: this.thanksReplies[Math.floor(Math.random() * this.thanksReplies.length)],
      requiresEscalation: false,
      intent: Intent.THANKS,
    };
  }

  /**
   * 处理道别
   */
  private handleFarewell(session: ChatSession): ChatResponse {
    session.status = 'closed';
    this.closeSession(session.id);

    return {
      sessionId: session.id,
      message: this.farewellReplies[Math.floor(Math.random() * this.farewellReplies.length)],
      requiresEscalation: false,
      intent: Intent.FAREWELL,
    };
  }

  /**
   * 处理转人工请求
   */
  private handleEscalation(session: ChatSession, message: string): ChatResponse {
    session.status = 'escalated';

    // 检查是否已多次请求转人工
    const escalationCount = session.messages.filter(
      m => m.role === 'assistant' && m.content.includes('转接人工')
    ).length;

    if (escalationCount > 0) {
      return {
        sessionId: session.id,
        message: '您的问题我已经记录，正在为您转接人工客服，请稍候...',
        requiresEscalation: true,
        intent: Intent.ESCALATION,
      };
    }

    return {
      sessionId: session.id,
      message: '好的，我理解您需要人工服务。现在为您转接人工客服，请稍候...',
      requiresEscalation: true,
      intent: Intent.ESCALATION,
    };
  }

  /**
   * 处理咨询问答
   */
  private async handleInquiry(
    session: ChatSession,
    message: string,
    collection?: string,
    temperature?: number,
    topK?: number,
  ): Promise<ChatResponse> {
    const rag = getRAGService();

    if (!rag?.isConnected()) {
      logger.warn('[CustomerService] RAG service not connected');
      return {
        sessionId: session.id,
        message: '抱歉，当前知识库服务暂不可用。请稍后再试，或输入"转人工"联系人工客服。',
        requiresEscalation: true,
        intent: Intent.UNKNOWN,
      };
    }

    try {
      // 构建增强提示词
      const enhancedQuery = this.enhanceQuery(message, session);

      // 调用 RAG 服务
      const ragResponse = await rag.query({
        query: enhancedQuery,
        collection: collection || this.config.collection,
        topK: topK || 3,
      });

      // 检查是否有结果
      if (ragResponse.sources.length === 0) {
        return {
          sessionId: session.id,
          message: '抱歉，我没有找到与您问题相关的答案。建议您：\n1. 换个方式描述您的问题\n2. 拨打客服热线获取帮助\n3. 输入"转人工"联系人工客服',
          requiresEscalation: false,
          intent: Intent.INQUIRY,
          metadata: ragResponse.metadata,
        };
      }

      // 转换来源格式
      const sources: SourceReference[] = ragResponse.sources.map(s => ({
        id: s.id,
        title: s.metadata?.title as string || undefined,
        url: s.metadata?.url as string || undefined,
        score: s.score,
      }));

      // 添加追问提示
      let answer = ragResponse.answer;
      if (!answer.includes('请问还有什么')) {
        answer += '\n\n请问还有什么可以帮助您的吗？';
      }

      return {
        sessionId: session.id,
        message: answer,
        sources,
        requiresEscalation: false,
        intent: Intent.INQUIRY,
        metadata: ragResponse.metadata,
      };
    } catch (error) {
      logger.error('[CustomerService] RAG query failed', { error, message });

      return {
        sessionId: session.id,
        message: '抱歉，处理您的请求时出现了一些问题。请稍后再试，或输入"转人工"联系人工客服。',
        requiresEscalation: true,
        intent: Intent.UNKNOWN,
      };
    }
  }

  /**
   * 增强查询
   */
  private enhanceQuery(message: string, session: ChatSession): string {
    // 添加对话上下文
    const recentMessages = session.messages.slice(-4);
    const contextSummary = recentMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');

    // 如果有上下文，组合查询
    if (contextSummary && contextSummary !== message) {
      return `当前问题: ${message}\n相关上下文: ${contextSummary}`;
    }

    return message;
  }

  /**
   * 修剪历史消息
   */
  private trimHistory(session: ChatSession): void {
    if (session.messages.length > this.config.maxHistoryLength) {
      session.messages = session.messages.slice(-this.config.maxHistoryLength);
    }
  }

  /**
   * 重置会话超时计时器
   */
  private resetSessionTimer(sessionId: string): void {
    this.clearSessionTimer(sessionId);

    const timer = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.status === 'active') {
        session.status = 'closed';
        logger.info('[CustomerService] Session timed out', { sessionId });
      }
    }, this.config.sessionTimeout);

    this.sessionTimers.set(sessionId, timer);
  }

  /**
   * 清除会话计时器
   */
  private clearSessionTimer(sessionId: string): void {
    const existingTimer = this.sessionTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.sessionTimers.delete(sessionId);
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============== 单例导出 ==============

let customerServiceInstance: CustomerService | null = null;

export function initCustomerService(
  config?: Partial<CustomerServiceConfig>
): CustomerService {
  customerServiceInstance = new CustomerService(config);
  return customerServiceInstance;
}

export function getCustomerService(): CustomerService | null {
  return customerServiceInstance;
}

export function getCustomerServiceOrThrow(): CustomerService {
  if (!customerServiceInstance) {
    throw new Error('Customer service not initialized. Call initCustomerService first.');
  }
  return customerServiceInstance;
}

export type {
  ChatMessage,
  ChatSession,
  ChatRequest,
  ChatResponse,
  SourceReference,
  CustomerServiceConfig,
  Intent,
};

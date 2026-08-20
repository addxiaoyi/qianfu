/**
 * 智能客服服务单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the RAG service
vi.mock('../../../server/services/rag', () => ({
  getRAGService: vi.fn(() => ({
    isConnected: vi.fn(() => true),
    query: vi.fn(async ({ query }: { query: string }) => {
      if (query.includes('密码')) {
        return {
          answer: '您可以通过以下步骤重置密码：\n1. 点击登录页的"忘记密码"\n2. 输入注册邮箱\n3. 查看邮箱中的重置链接\n4. 设置新密码',
          sources: [
            { id: '1', content: '密码重置方法', score: 0.95, metadata: { title: '密码重置指南' } }
          ],
          metadata: { retrievalTime: 50, generationTime: 500, tokensUsed: 200 }
        };
      }
      return {
        answer: '抱歉，我无法找到与您问题相关的答案。',
        sources: [],
        metadata: { retrievalTime: 30, generationTime: 300, tokensUsed: 100 }
      };
    }),
  })),
}));

// Mock logger
vi.mock('../../../server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock env
vi.mock('../../../server/config/env', () => ({
  env: {
    CUSTOMER_SERVICE_ENABLED: true,
    CUSTOMER_SERVICE_COLLECTION: 'customer_service',
    CUSTOMER_SERVICE_LLM_MODEL: 'gpt-4o-mini',
    CUSTOMER_SERVICE_TEMPERATURE: '0.7',
  },
}));

// Import after mocking
import { CustomerService } from '../../../server/services/customerService';

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(() => {
    service = new CustomerService({
      enabled: true,
      collection: 'customer_service',
      escalationKeywords: ['人工', '转人工', '客服', '投诉'],
      llmModel: 'gpt-4o-mini',
      temperature: 0.7,
      maxHistoryLength: 20,
      sessionTimeout: 30 * 60 * 1000,
      enableIntentDetection: false,
      enableSentimentAnalysis: false,
    });
  });

  describe('chat', () => {
    it('should create new session on first message', async () => {
      const response = await service.chat({
        message: '你好',
      });

      expect(response.sessionId).toBeDefined();
      expect(response.sessionId).toMatch(/^cs_\d+_[a-z0-9]+$/);
    });

    it('should handle greeting messages', async () => {
      const response = await service.chat({
        message: '你好',
      });

      expect(response.message).toContain('您好');
      expect(response.requiresEscalation).toBe(false);
      expect(response.intent).toBe('greeting');
    });

    it('should handle thanks messages', async () => {
      const response = await service.chat({
        message: '谢谢',
      });

      expect(response.message).toContain('不客气');
      expect(response.requiresEscalation).toBe(false);
      expect(response.intent).toBe('thanks');
    });

    it('should handle farewell messages', async () => {
      const response = await service.chat({
        message: '再见',
      });

      expect(response.message).toContain('再见');
      expect(response.requiresEscalation).toBe(false);
      expect(response.intent).toBe('farewell');
    });

    it('should handle escalation requests', async () => {
      const response = await service.chat({
        message: '我要转人工',
      });

      expect(response.requiresEscalation).toBe(true);
      expect(response.intent).toBe('escalation');
    });

    it('should handle complaint escalation', async () => {
      const response = await service.chat({
        message: '我要投诉',
      });

      expect(response.requiresEscalation).toBe(true);
      expect(response.intent).toBe('escalation');
    });

    it('should answer from RAG knowledge base', async () => {
      const response = await service.chat({
        message: '如何重置密码？',
      });

      expect(response.message).toContain('密码');
      expect(response.sources).toBeDefined();
      expect(response.sources!.length).toBeGreaterThan(0);
      expect(response.requiresEscalation).toBe(false);
    });

    it('should continue conversation with sessionId', async () => {
      // First message
      const firstResponse = await service.chat({
        message: '你好',
      });

      // Continue with same session
      const secondResponse = await service.chat({
        message: '如何重置密码？',
        sessionId: firstResponse.sessionId,
      });

      expect(secondResponse.sessionId).toBe(firstResponse.sessionId);
      expect(secondResponse.message).toContain('密码');
    });

    it('should preserve message history', async () => {
      // First exchange
      await service.chat({
        message: '你好',
      });

      // Get session
      const secondResponse = await service.chat({
        message: '如何重置密码？',
      });

      const session = service.getSession(secondResponse.sessionId);
      expect(session).toBeDefined();
      expect(session!.messages.length).toBe(4); // 2 user + 2 assistant
    });
  });

  describe('session management', () => {
    it('should get existing session', async () => {
      const response = await service.chat({
        message: '你好',
      });

      const session = service.getSession(response.sessionId);
      expect(session).toBeDefined();
      expect(session!.id).toBe(response.sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const session = service.getSession('non-existent-id');
      expect(session).toBeUndefined();
    });

    it('should close session', async () => {
      const response = await service.chat({
        message: '你好',
      });

      const closed = service.closeSession(response.sessionId);
      expect(closed).toBe(true);

      const session = service.getSession(response.sessionId);
      expect(session!.status).toBe('closed');
    });

    it('should get user sessions', async () => {
      // Create sessions for different users
      await service.chat({ message: '你好', userId: 'user1' });
      await service.chat({ message: '你好', userId: 'user1' });
      await service.chat({ message: '你好', userId: 'user2' });

      const user1Sessions = service.getUserSessions('user1');
      expect(user1Sessions.length).toBe(2);

      const user2Sessions = service.getUserSessions('user2');
      expect(user2Sessions.length).toBe(1);
    });
  });

  describe('intent detection', () => {
    it('should detect greeting intent', async () => {
      const response = await service.chat({ message: '您好' });
      expect(response.intent).toBe('greeting');
    });

    it('should detect inquiry intent', async () => {
      const response = await service.chat({ message: '请问如何操作？' });
      expect(response.intent).toBe('inquiry');
    });

    it('should detect complaint intent', async () => {
      const response = await service.chat({ message: '这个功能太差了' });
      expect(response.intent).toBe('complaint');
    });
  });

  describe('status', () => {
    it('should return correct status', () => {
      const status = service.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.totalSessions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('message length validation', () => {
    it('should handle long conversation history', async () => {
      let sessionId: string;

      // Simulate long conversation
      for (let i = 0; i < 25; i++) {
        const response = await service.chat({
          message: `消息 ${i}`,
          sessionId,
        });
        sessionId = response.sessionId;
      }

      const session = service.getSession(sessionId!);
      // Should be trimmed to maxHistoryLength
      expect(session!.messages.length).toBeLessThanOrEqual(20);
    });
  });
});

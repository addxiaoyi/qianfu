# 优化项 398: 智能客服 - GPT 接入

## 概述

本文档描述如何利用项目现有的 RAG 系统基础设施，快速搭建智能客服功能。项目已具备完整的知识库问答能力，本优化项将聚焦于智能客服场景的完整实现。

## 现有架构

项目已具备以下基础设施:

- **RAG 服务** (`server/services/rag/index.ts`)
  - 支持 OpenAI GPT 系列
  - 支持 Anthropic Claude 系列
  - 向量检索 (Weaviate)
  - 多级缓存 (L1 内存 + L2 Redis)

- **配置支持** (`server/config/env.ts`)
  - OpenAI API Key 配置
  - Anthropic API Key 配置
  - Weaviate 向量数据库配置

- **REST API** (`server/routes/rag.ts`)
  - 知识库管理
  - 文档上传
  - 问答查询
  - 流式响应

## 智能客服功能设计

### 1. 核心功能

```
┌─────────────────────────────────────────────────────────┐
│                    智能客服架构                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   用户 ──▶ 客服聊天界面 ──▶ API 路由 ──▶ RAG 服务      │
│                │                    │                    │
│                │                    ▼                    │
│                │              知识库检索                  │
│                │                    │                    │
│                │                    ▼                    │
│                │              LLM 生成                    │
│                │                    │                    │
│                ▼                    ▼                    │
│           会话管理 ◀───────── 回复用户                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. 功能模块

| 模块 | 功能描述 | 复用现有 |
|------|----------|----------|
| 会话管理 | 维护用户会话上下文 | 新建 |
| 意图识别 | 判断用户意图 (咨询/投诉/查询) | 新建 |
| 知识问答 | RAG 问答 | 复用 RAG 服务 |
| 转人工 | 复杂问题转接人工客服 | 新建 |
| 满意度评价 | 收集用户反馈 | 新建 |

### 3. 客服提示词模板

```typescript
const CUSTOMER_SERVICE_PROMPT = `
你是一个专业、友好的客服助手。请根据以下指南回复用户:

## 角色设定
- 姓名: 智能客服小千
- 性格: 耐心、专业、热情
- 目标: 帮助用户解决问题，提供优质服务

## 回复规范
1. 简洁明了，使用通俗易懂的语言
2. 主动询问是否需要进一步帮助
3. 如不确定答案，坦诚告知并建议转人工
4. 适当使用表情符号增加亲和力

## 已知信息:
{context}

## 用户当前问题:
{query}

请给出友好的回复:`;
```

## 快速实现方案

### 步骤 1: 环境配置

在 `server/.env` 中配置:

```bash
# 智能客服开关
CUSTOMER_SERVICE_ENABLED=true

# 知识库集合名称
CUSTOMER_SERVICE_COLLECTION=customer_service

# 转人工关键词 (逗号分隔)
CUSTOMER_SERVICE_ESCALATION_KEYWORDS=人工,转人工,客服,投诉

# 客服默认模型
CUSTOMER_SERVICE_LLM_MODEL=gpt-4o-mini

# 客服温度系数
CUSTOMER_SERVICE_TEMPERATURE=0.7
```

### 步骤 2: 创建客服服务

```typescript
// server/services/customerService.ts

import { getRAGService } from './rag';
import { logger } from '../lib/logger';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  userId?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'closed' | 'escalated';
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  userId?: string;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  sources?: any[];
  requiresEscalation: boolean;
}

class CustomerService {
  private sessions: Map<string, ChatSession> = new Map();
  private escalationKeywords: string[] = ['人工', '转人工', '客服', '投诉'];

  /**
   * 处理用户消息
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { message, sessionId, userId } = request;

    // 获取或创建会话
    let session = sessionId ? this.sessions.get(sessionId) : null;
    if (!session) {
      session = this.createSession(userId);
    }

    // 添加用户消息
    session.messages.push({
      id: this.generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // 检查是否需要转人工
    if (this.shouldEscalate(message)) {
      session.status = 'escalated';
      return {
        sessionId: session.id,
        message: '您的问题我已经记录，将为您转接人工客服，请稍候...',
        requiresEscalation: true,
      };
    }

    // 构建对话上下文
    const context = this.buildContext(session.messages);

    // 调用 RAG 服务
    const rag = getRAGService();
    if (!rag?.isConnected()) {
      return {
        sessionId: session.id,
        message: '抱歉，当前服务暂不可用，请稍后再试。',
        requiresEscalation: true,
      };
    }

    try {
      const response = await rag.query({
        query: message,
        collection: 'customer_service',
        topK: 3,
      });

      // 添加助手消息
      session.messages.push({
        id: this.generateId(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      });

      session.updatedAt = new Date();

      return {
        sessionId: session.id,
        message: response.answer,
        sources: response.sources,
        requiresEscalation: false,
      };
    } catch (error) {
      logger.error('[CustomerService] Chat failed', { error });
      return {
        sessionId: session.id,
        message: '抱歉，处理您的请求时出现错误，请稍后再试。',
        requiresEscalation: true,
      };
    }
  }

  /**
   * 检查是否需要转人工
   */
  private shouldEscalate(message: string): boolean {
    return this.escalationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 构建上下文
   */
  private buildContext(messages: ChatMessage[]): string {
    const recent = messages.slice(-6); // 最近 6 条消息
    return recent
      .map(m => `${m.role === 'user' ? '用户' : '客服'}: ${m.content}`)
      .join('\n');
  }

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
    return session;
  }

  /**
   * 生成 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const customerService = new CustomerService();
```

### 步骤 3: 创建客服路由

```typescript
// server/routes/customerService.ts

import { Router, Request, Response } from 'express';
import { customerService, ChatRequest } from '../services/customerService';

const router = Router();

/**
 * 发送消息
 * POST /api/customer-service/chat
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, userId } = req.body as ChatRequest;

    if (!message) {
      res.status(400).json({ error: 'Missing required field: message' });
      return;
    }

    const response = await customerService.chat({ message, sessionId, userId });
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取会话历史
 * GET /api/customer-service/session/:sessionId
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  // 实现获取会话历史
  res.json({ sessionId, messages: [] });
});

/**
 * 关闭会话
 * POST /api/customer-service/session/:sessionId/close
 */
router.post('/session/:sessionId/close', async (req: Request, res: Response) => {
  // 实现关闭会话
  res.json({ status: 'closed' });
});

export default router;
```

### 步骤 4: 注册路由

在 `server/index.ts` 中添加:

```typescript
import customerServiceRouter from './routes/customerService';

// 注册客服路由
app.use('/api/customer-service', customerServiceRouter);
```

## 知识库内容建议

创建客服知识库 (`customer_service` 集合)，建议包含:

| 类别 | 内容示例 |
|------|----------|
| 常见问题 | 账户注册、密码找回、支付问题 |
| 产品使用 | 功能介绍、操作指南、教程 |
| 政策说明 | 隐私政策、服务条款、退款规则 |
| 联系我们 | 电话、邮箱、工作时间 |

## 前端集成建议

### 聊天界面组件

```tsx
// 客服聊天组件示例
function CustomerServiceChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);

  const sendMessage = async () => {
    const response = await fetch('/api/customer-service/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: input, 
        sessionId 
      }),
    });
    
    const data = await response.json();
    setSessionId(data.sessionId);
    setMessages(prev => [...prev, 
      { role: 'user', content: input },
      { role: 'assistant', content: data.message }
    ]);
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(m => (
          <div className={`message ${m.role}`}>
            {m.content}
          </div>
        ))}
      </div>
      <input 
        value={input} 
        onChange={e => setInput(e.target.value)}
        placeholder="请输入您的问题..."
      />
      <button onClick={sendMessage}>发送</button>
    </div>
  );
}
```

## 配置扩展

在 `server/config/env.ts` 中添加客服配置:

```typescript
// 添加 CustomerServiceConfig
export interface CustomerServiceConfig {
  enabled: boolean;
  collection: string;
  escalationKeywords: string[];
  llmModel: string;
  temperature: number;
}

// 在 buildConfig 中添加
function buildCustomerServiceConfig(): CustomerServiceConfig {
  return {
    enabled: process.env.CUSTOMER_SERVICE_ENABLED === 'true',
    collection: process.env.CUSTOMER_SERVICE_COLLECTION || 'customer_service',
    escalationKeywords: (process.env.CUSTOMER_SERVICE_ESCALATION_KEYWORDS || '人工,转人工,客服,投诉').split(','),
    llmModel: process.env.CUSTOMER_SERVICE_LLM_MODEL || 'gpt-4o-mini',
    temperature: parseFloat(process.env.CUSTOMER_SERVICE_TEMPERATURE || '0.7'),
  };
}
```

## 测试用例

```typescript
// tests/unit/server/services/customerService.test.ts

describe('CustomerService', () => {
  it('should create new session', () => {
    const session = customerService.createSession('user123');
    expect(session.id).toBeDefined();
    expect(session.status).toBe('active');
  });

  it('should escalate on keyword match', async () => {
    const response = await customerService.chat({
      message: '我要投诉',
    });
    expect(response.requiresEscalation).toBe(true);
  });

  it('should answer from knowledge base', async () => {
    const response = await customerService.chat({
      message: '如何重置密码？',
    });
    expect(response.message).toBeDefined();
    expect(response.sessionId).toBeDefined();
  });
});
```

## 后续扩展

### Phase 2: 能力增强
- [ ] 多轮对话上下文管理
- [ ] 意图识别与分类
- [ ] 情感分析
- [ ] 会话总结

### Phase 3: 智能化提升
- [ ] 个性化回复 (基于用户历史)
- [ ] 主动推荐相关问题
- [ ] 满意度自动评估

### Phase 4: 企业级功能
- [ ] 多租户支持
- [ ] 客服工作台
- [ ] 工单系统集成
- [ ] 数据分析看板

## 相关文档

- [RAG 系统文档](./OPTIMIZATION-487-RAG-SYSTEM.md)
- [向量知识库问答](./OPTIMIZATION-489-VECTOR-KNOWLEDGEBASE-QA.md)
- [Prompt 版本控制](./OPTIMIZATION-491-PROMPT-VERSION-CONTROL.md)

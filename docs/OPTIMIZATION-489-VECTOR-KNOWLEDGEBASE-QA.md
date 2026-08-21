# 优化项 489: 向量知识库 - 智能问答

## 概述

基于已实现的 Weaviate 语义搜索功能，新增智能问答 (RAG) 能力，实现：
1. LLM 集成 - 调用大模型生成答案
2. RAG 问答 API - 检索 + 生成一体化
3. 知识库管理 - CRUD 操作
4. 前端 UI - 问答界面和知识库管理

## 当前代码基础

### 已实现
- `server/services/semanticSearch.ts` - Weaviate 客户端封装
- `server/routes/semanticSearch.ts` - REST API
- `server/services/semanticSearch.examples.ts` - 使用示例

### 依赖配置
```env
# AI 服务
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=  # 可选，自定义端点

# 向量数据库
WEAVIATE_URL=localhost:8080
WEAVIATE_API_KEY=  # 云端需要
```

## 实现计划

### Phase 1: LLM 服务层

**文件**: `server/services/llmService.ts`

```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'azure' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

class LLMService {
  // 单轮对话
  async chat(options: ChatCompletionOptions): Promise<string>;
  
  // 流式对话
  async chatStream(options: ChatCompletionOptions, onChunk: (chunk: string) => void): Promise<void>;
  
  // 上下文增强对话 (RAG)
  async ragChat(context: string, question: string): Promise<string>;
}
```

### Phase 2: RAG 问答服务

**文件**: `server/services/ragService.ts`

```typescript
interface RAGConfig {
  llmService: LLMService;
  vectorService: SemanticSearchService;
  maxContextDocs: number;  // 最多引用文档数
  minRelevanceScore: number;  // 最低相关度阈值
  systemPrompt?: string;  // 自定义系统提示
}

interface QARequest {
  question: string;
  className: string;
  filters?: SearchFilter;
  useHistory?: boolean;  // 是否启用对话历史
}

interface QAResponse {
  answer: string;
  sources: Array<{
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

class RAGService {
  // 智能问答
  async ask(request: QARequest): Promise<QAResponse>;
  
  // 流式问答
  async askStream(request: QARequest, onChunk: (chunk: string) => void): Promise<QAResponse>;
  
  // 带对话历史的问答
  async askWithHistory(sessionId: string, request: QARequest): Promise<QAResponse>;
}
```

### Phase 3: RAG 问答 API

**文件**: `server/routes/rag.ts`

```typescript
// 智能问答
POST /api/rag/ask
{
  "question": "如何重置密码?",
  "className": "KnowledgeArticle",
  "filters": { "equal": { "category": "Account" } }
}

// 流式问答
POST /api/rag/ask/stream
// 返回 Server-Sent Events

// 对话历史问答
POST /api/rag/ask/:sessionId
// 自动维护多轮对话

// 管理会话
GET  /api/rag/sessions/:sessionId
DELETE /api/rag/sessions/:sessionId
```

### Phase 4: 知识库管理 API

**文件**: `server/routes/knowledgeBase.ts`

```typescript
// 知识库 CRUD
POST   /api/knowledge/classes          // 创建知识库
GET    /api/knowledge/classes          // 列出所有知识库
GET    /api/knowledge/classes/:name    // 获取知识库详情
PUT    /api/knowledge/classes/:name    // 更新知识库配置
DELETE /api/knowledge/classes/:name     // 删除知识库

// 文档管理
POST   /api/knowledge/classes/:name/documents     // 添加文档
POST   /api/knowledge/classes/:name/documents/batch  // 批量导入
GET    /api/knowledge/classes/:name/documents     // 列出文档
PUT    /api/knowledge/classes/:name/documents/:id // 更新文档
DELETE /api/knowledge/classes/:name/documents/:id // 删除文档

// 文档导入
POST   /api/knowledge/import           // 导入文档 (支持 URL/文件)
```

### Phase 5: 前端组件

**文件**: `src/components/KnowledgeBase/`

```
KnowledgeBase.tsx        # 知识库管理主组件
DocumentList.tsx         # 文档列表
DocumentEditor.tsx       # 文档编辑
QAModal.tsx              # 问答弹窗
ChatInterface.tsx        # 问答界面
```

**功能**:
1. 知识库列表和创建
2. 文档管理 (增删改查)
3. 批量导入 (TXT/MD/JSON)
4. 智能问答界面
5. 答案来源展示

## 实现代码

### LLM 服务

```typescript
// server/services/llmService.ts
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'azure' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResponse {
  content: string;
  usage?: UsageInfo;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | null;
}

export class LLMService {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      defaultTemperature: 0.7,
      defaultMaxTokens: 2000,
      ...config,
    };
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const { messages, temperature, maxTokens } = {
      ...options,
      temperature: temperature ?? this.config.defaultTemperature,
      maxTokens: maxTokens ?? this.config.defaultMaxTokens,
    };

    const body = {
      model: this.config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const response = await fetch(this.getEndpoint(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  async chatStream(
    options: ChatCompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<ChatCompletionResponse> {
    const { messages, temperature, maxTokens } = {
      ...options,
      temperature: temperature ?? this.config.defaultTemperature,
      maxTokens: maxTokens ?? this.config.defaultMaxTokens,
    };

    const body = {
      model: this.config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    const response = await fetch(this.getEndpoint(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: UsageInfo | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          const parsed = JSON.parse(data);
          const content = this.extractChunkContent(parsed);
          if (content) {
            fullContent += content;
            onChunk(content);
          }
          usage = this.extractUsage(parsed);
        }
      }
    }

    return {
      content: fullContent,
      usage,
      model: this.config.model,
      finishReason: 'stop',
    };
  }

  async ragChat(context: string, question: string, systemPrompt?: string): Promise<ChatCompletionResponse> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    } else {
      messages.push({
        role: 'system',
        content: `你是一个智能助手。根据提供的上下文信息回答用户问题。
        
规则:
1. 只根据提供的上下文信息回答，不要编造信息
2. 如果上下文中没有相关信息，诚实地告知用户
3. 适当引用上下文中的原文
4. 回答要简洁、有条理`,
      });
    }

    messages.push({
      role: 'user',
      content: `上下文信息:
${context}

---
用户问题: ${question}`,
    });

    return this.chat({ messages });
  }

  private getEndpoint(): string {
    const baseUrl = this.config.baseUrl || this.getDefaultBaseUrl();
    return `${baseUrl}/chat/completions`;
  }

  private getDefaultBaseUrl(): string {
    switch (this.config.provider) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'azure':
        return `${this.config.baseUrl}/openai/deployments/${this.config.model}`;
      case 'ollama':
        return 'http://localhost:11434/api';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (this.config.provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = this.config.apiKey || '';
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'azure':
        headers['api-key'] = this.config.apiKey || '';
        break;
    }

    return headers;
  }

  private parseResponse(data: any): ChatCompletionResponse {
    if (this.config.provider === 'anthropic') {
      return {
        content: data.content[0].text,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        model: this.config.model,
        finishReason: data.stop_reason,
      };
    }

    return {
      content: data.choices[0].message.content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      model: data.model,
      finishReason: data.choices[0].finish_reason,
    };
  }

  private extractChunkContent(data: any): string {
    if (this.config.provider === 'anthropic') {
      return data.content?.[0]?.text || '';
    }
    return data.choices?.[0]?.delta?.content || '';
  }

  private extractUsage(data: any): UsageInfo | undefined {
    if (data.usage) {
      return {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      };
    }
    return undefined;
  }
}

// 单例导出
let llmServiceInstance: LLMService | null = null;

export function initLLM(config: LLMConfig): LLMService {
  llmServiceInstance = new LLMService(config);
  return llmServiceInstance;
}

export function getLLM(): LLMService | null {
  return llmServiceInstance;
}

export function getLLMOrThrow(): LLMService {
  if (!llmServiceInstance) {
    throw new Error('LLM not initialized. Call initLLM first.');
  }
  return llmServiceInstance;
}
```

### RAG 服务

```typescript
// server/services/ragService.ts
import { getSemanticSearch, SemanticSearchService } from './semanticSearch';
import { getLLM, LLMService } from './llmService';
import { logger } from '../lib/logger';

export interface RAGConfig {
  maxContextDocs: number;
  minRelevanceScore: number;
  systemPrompt?: string;
  defaultClassName: string;
}

export interface QARequest {
  question: string;
  className?: string;
  filters?: SearchFilter;
  maxContextDocs?: number;
  minRelevanceScore?: number;
}

export interface SourceDocument {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface QAResponse {
  answer: string;
  sources: SourceDocument[];
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
}

interface ConversationHistory {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_CONFIG: Partial<RAGConfig> = {
  maxContextDocs: 5,
  minRelevanceScore: 0.5,
  defaultClassName: 'KnowledgeArticle',
};

// 会话存储 (生产环境应使用 Redis)
const conversationHistory = new Map<string, ConversationHistory>();
const HISTORY_TTL = 3600000; // 1小时

export class RAGService {
  private config: RAGConfig;
  private vectorService: SemanticSearchService | null = null;
  private llmService: LLMService | null = null;

  constructor(config: RAGConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setVectorService(service: SemanticSearchService): void {
    this.vectorService = service;
  }

  setLLMService(service: LLMService): void {
    this.llmService = service;
  }

  async ask(request: QARequest): Promise<QAResponse> {
    const {
      question,
      className = this.config.defaultClassName,
      filters,
      maxContextDocs = this.config.maxContextDocs,
      minRelevanceScore = this.config.minRelevanceScore,
    } = request;

    // 1. 检索相关文档
    const docs = await this.retrieveContext(question, className, {
      limit: maxContextDocs,
      certainty: minRelevanceScore,
      filter: filters,
    });

    if (docs.length === 0) {
      return {
        answer: '抱歉，知识库中没有找到与您问题相关的信息。',
        sources: [],
        model: this.llmService ? 'N/A' : 'unknown',
      };
    }

    // 2. 构建上下文
    const context = this.buildContext(docs);

    // 3. 生成答案
    const response = await this.generateAnswer(context, question);

    return {
      ...response,
      sources: docs.map(d => ({
        id: d.id,
        content: d.object.content as string,
        score: d.score,
        metadata: d.object.metadata as Record<string, unknown>,
      })),
    };
  }

  async askStream(
    request: QARequest,
    onChunk: (chunk: string) => void
  ): Promise<QAResponse> {
    const {
      question,
      className = this.config.defaultClassName,
      filters,
      maxContextDocs = this.config.maxContextDocs,
      minRelevanceScore = this.config.minRelevanceScore,
    } = request;

    // 1. 检索相关文档
    const docs = await this.retrieveContext(question, className, {
      limit: maxContextDocs,
      certainty: minRelevanceScore,
      filter: filters,
    });

    if (docs.length === 0) {
      onChunk('抱歉，知识库中没有找到与您问题相关的信息。');
      return {
        answer: '抱歉，知识库中没有找到与您问题相关的信息。',
        sources: [],
        model: 'N/A',
      };
    }

    // 2. 构建上下文
    const context = this.buildContext(docs);

    // 3. 流式生成答案
    const response = await this.generateAnswerStream(context, question, onChunk);

    return {
      ...response,
      sources: docs.map(d => ({
        id: d.id,
        content: d.object.content as string,
        score: d.score,
        metadata: d.object.metadata as Record<string, unknown>,
      })),
    };
  }

  async askWithHistory(sessionId: string, request: QARequest): Promise<QAResponse> {
    // 获取或创建会话
    let history = conversationHistory.get(sessionId);
    if (!history) {
      history = {
        sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      conversationHistory.set(sessionId, history);
    }

    // 检查会话是否过期
    if (Date.now() - history.updatedAt > HISTORY_TTL) {
      history.messages = [];
    }
    history.updatedAt = Date.now();

    const {
      question,
      className = this.config.defaultClassName,
      filters,
      maxContextDocs = this.config.maxContextDocs,
      minRelevanceScore = this.config.minRelevanceScore,
    } = request;

    // 1. 检索相关文档
    const docs = await this.retrieveContext(question, className, {
      limit: maxContextDocs,
      certainty: minRelevanceScore,
      filter: filters,
    });

    // 2. 构建带历史的上下文
    const context = this.buildContextWithHistory(docs, history);

    // 3. 生成答案
    const response = await this.generateAnswer(context, question);

    // 4. 保存对话历史
    history.messages.push({
      role: 'user',
      content: question,
      timestamp: Date.now(),
    });
    history.messages.push({
      role: 'assistant',
      content: response.answer,
      timestamp: Date.now(),
    });

    // 限制历史长度
    if (history.messages.length > 20) {
      history.messages = history.messages.slice(-20);
    }

    return {
      ...response,
      sources: docs.map(d => ({
        id: d.id,
        content: d.object.content as string,
        score: d.score,
        metadata: d.object.metadata as Record<string, unknown>,
      })),
    };
  }

  private async retrieveContext(
    question: string,
    className: string,
    options: { limit: number; certainty: number; filter?: SearchFilter }
  ) {
    if (!this.vectorService) {
      this.vectorService = getSemanticSearch();
    }

    if (!this.vectorService) {
      throw new Error('Vector service not initialized');
    }

    const results = await this.vectorService.search(question, className, {
      limit: options.limit,
      certainty: options.certainty,
      filter: options.filter,
    });

    return results;
  }

  private buildContext(docs: Array<{ id: string; object: any; score: number }>): string {
    return docs
      .map((doc, index) => {
        const content = doc.object.content || doc.object.text || '';
        const metadata = doc.object.metadata || {};
        const metaStr = Object.keys(metadata).length > 0
          ? `\n元数据: ${JSON.stringify(metadata)}`
          : '';
        return `[文档${index + 1}] (相关度: ${(doc.score * 100).toFixed(1)}%)\n${content}${metaStr}`;
      })
      .join('\n\n');
  }

  private buildContextWithHistory(
    docs: Array<{ id: string; object: any; score: number }>,
    history: ConversationHistory
  ): string {
    const contextDocs = this.buildContext(docs);

    const historyStr = history.messages.length > 0
      ? `\n\n对话历史:\n${history.messages
          .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
          .join('\n')}`
      : '';

    return contextDocs + historyStr;
  }

  private async generateAnswer(context: string, question: string): Promise<{
    answer: string;
    tokens?: { prompt: number; completion: number; total: number };
    model: string;
  }> {
    if (!this.llmService) {
      this.llmService = getLLM();
    }

    if (!this.llmService) {
      throw new Error('LLM service not initialized');
    }

    const response = await this.llmService.ragChat(
      context,
      question,
      this.config.systemPrompt
    );

    return {
      answer: response.content,
      tokens: response.usage,
      model: response.model,
    };
  }

  private async generateAnswerStream(
    context: string,
    question: string,
    onChunk: (chunk: string) => void
  ): Promise<{
    answer: string;
    tokens?: { prompt: number; completion: number; total: number };
    model: string;
  }> {
    if (!this.llmService) {
      this.llmService = getLLM();
    }

    if (!this.llmService) {
      throw new Error('LLM service not initialized');
    }

    let fullAnswer = '';

    const response = await this.llmService.chatStream(
      {
        messages: [
          {
            role: 'system',
            content: this.config.systemPrompt || `你是一个智能助手。根据提供的上下文信息回答用户问题。

规则:
1. 只根据提供的上下文信息回答，不要编造信息
2. 如果上下文中没有相关信息，诚实地告知用户
3. 适当引用上下文中的原文
4. 回答要简洁、有条理`,
          },
          {
            role: 'user',
            content: `上下文信息:
${context}

---
用户问题: ${question}`,
          },
        ],
      },
      (chunk) => {
        fullAnswer += chunk;
        onChunk(chunk);
      }
    );

    return {
      answer: fullAnswer,
      tokens: response.usage,
      model: response.model,
    };
  }

  clearHistory(sessionId: string): boolean {
    return conversationHistory.delete(sessionId);
  }
}

// 单例导出
let ragServiceInstance: RAGService | null = null;

export function initRAG(config?: Partial<RAGConfig>): RAGService {
  ragServiceInstance = new RAGService(config as RAGConfig);
  return ragServiceInstance;
}

export function getRAG(): RAGService | null {
  return ragServiceInstance;
}
```

### RAG API 路由

```typescript
// server/routes/rag.ts
import { Router, Request, Response, NextFunction } from 'express';
import { getRAG, getRAGOrThrow, QARequest } from '../services/ragService';
import { logger } from '../lib/logger';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 智能问答
router.post('/ask', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGOrThrow();
  const { question, className, filters, maxContextDocs, minRelevanceScore } = req.body;

  if (!question) {
    res.status(400).json({ error: 'Missing required field: question' });
    return;
  }

  const request: QARequest = {
    question,
    className,
    filters,
    maxContextDocs,
    minRelevanceScore,
  };

  const result = await rag.ask(request);

  res.json({
    success: true,
    ...result,
  });
}));

// 流式问答
router.post('/ask/stream', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGOrThrow();
  const { question, className, filters, maxContextDocs, minRelevanceScore } = req.body;

  if (!question) {
    res.status(400).json({ error: 'Missing required field: question' });
    return;
  }

  // 设置 SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const request: QARequest = {
    question,
    className,
    filters,
    maxContextDocs,
    minRelevanceScore,
  };

  try {
    const result = await rag.askStream(request, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: 'done', ...result })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
  }

  res.end();
}));

// 带对话历史的问答
router.post('/ask/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGOrThrow();
  const { sessionId } = req.params;
  const { question, className, filters, maxContextDocs, minRelevanceScore } = req.body;

  if (!question) {
    res.status(400).json({ error: 'Missing required field: question' });
    return;
  }

  const request: QARequest = {
    question,
    className,
    filters,
    maxContextDocs,
    minRelevanceScore,
  };

  const result = await rag.askWithHistory(sessionId, request);

  res.json({
    success: true,
    sessionId,
    ...result,
  });
}));

// 获取会话历史
router.get('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  // 从 RAG 服务获取历史 (需要扩展 RAG 服务)
  res.json({
    sessionId: req.params.sessionId,
    exists: true, // 占位
  });
}));

// 删除会话
router.delete('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAG();
  if (rag) {
    rag.clearHistory(req.params.sessionId);
  }
  res.json({ success: true, sessionId: req.params.sessionId });
}));

export default router;
```

## 前端集成

### 问答 Hook

```typescript
// src/hooks/useRAG.ts
import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

interface Source {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface QAResponse {
  answer: string;
  sources: Source[];
  tokens?: { prompt: number; completion: number; total: number };
}

export function useRAG() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (
    question: string,
    options?: { className?: string; filters?: any }
  ): Promise<QAResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/rag/ask', {
        question,
        ...options,
      });
      return response.data;
    } catch (err: any) {
      setError(err.message || 'Failed to get answer');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const askStream = useCallback((
    question: string,
    onChunk: (chunk: string) => void,
    options?: { className?: string; filters?: any }
  ) => {
    setLoading(true);
    setError(null);

    const eventSource = new EventSource('/api/rag/ask/stream?' + new URLSearchParams({
      ...options,
      question,
    }));

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chunk') {
        onChunk(data.content);
      } else if (data.type === 'done') {
        setLoading(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError('Stream connection error');
      setLoading(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return { ask, askStream, loading, error };
}
```

### 问答组件

```typescript
// src/components/KnowledgeBase/QAModal.tsx
import React, { useState, useCallback } from 'react';
import { useRAG } from '../../hooks/useRAG';

interface QAModalProps {
  className?: string;
  onClose: () => void;
}

export function QAModal({ className = 'KnowledgeArticle', onClose }: QAModalProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [streamAnswer, setStreamAnswer] = useState('');
  const { ask, loading, error } = useRAG();

  const handleAsk = useCallback(async () => {
    const result = await ask(question, { className });
    if (result) {
      setAnswer(result.answer);
      setSources(result.sources);
    }
  }, [question, className, ask]);

  const handleStreamAsk = useCallback(() => {
    setStreamAnswer('');
    return ask(question, (chunk) => {
      setStreamAnswer((prev) => prev + chunk);
    }, { className });
  }, [question, className, ask]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>智能问答</h2>
          <button onClick={onClose}>关闭</button>
        </div>

        <div className="qa-container">
          <div className="question-input">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="请输入您的问题..."
              rows={3}
            />
            <div className="actions">
              <button onClick={handleAsk} disabled={loading}>
                {loading ? '生成中...' : '提问'}
              </button>
              <button onClick={handleStreamAsk} disabled={loading}>
                流式回答
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          {(answer || streamAnswer) && (
            <div className="answer-section">
              <h3>回答</h3>
              <div className="answer-content">
                {streamAnswer || answer}
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="sources-section">
              <h3>参考来源</h3>
              {sources.map((source, index) => (
                <div key={source.id} className="source-item">
                  <div className="source-header">
                    <span>文档 {index + 1}</span>
                    <span className="score">
                      相关度: {(source.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="source-content">
                    {source.content.substring(0, 200)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## 环境变量扩展

```env
# =================== AI 服务扩展 ===================
# LLM 提供商: openai | anthropic | azure | ollama
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Anthropic (可选)
# ANTHROPIC_API_KEY=

# Azure OpenAI (可选)
# AZURE_OPENAI_ENDPOINT=
# AZURE_OPENAI_API_KEY=
# AZURE_OPENAI_DEPLOYMENT=gpt-4

# Ollama (可选)
# OLLAMA_BASE_URL=http://localhost:11434

# =================== RAG 配置 ===================
RAG_MAX_CONTEXT_DOCS=5
RAG_MIN_RELEVANCE_SCORE=0.5
RAG_DEFAULT_CLASS=KnowledgeArticle
RAG_SYSTEM_PROMPT=你是一个智能助手...
```

## 测试计划

1. **单元测试**
   - LLM 服务格式化测试
   - RAG 上下文构建测试
   - 会话管理测试

2. **集成测试**
   - Weaviate 检索 + LLM 生成流程
   - 流式响应测试
   - 多轮对话测试

3. **E2E 测试**
   - 前端问答流程
   - 知识库管理 CRUD

## 里程碑

- [ ] Phase 1: LLM 服务层
- [ ] Phase 2: RAG 问答服务
- [ ] Phase 3: RAG API 路由
- [ ] Phase 4: 知识库管理 API
- [ ] Phase 5: 前端 UI
- [ ] 测试覆盖
- [ ] 文档更新

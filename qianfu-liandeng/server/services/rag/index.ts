/**
 * RAG 知识增强服务 - 核心入口
 *
 * 功能:
 * - 文档处理与知识库管理
 * - 智能检索与上下文组装
 * - LLM 生成服务
 * - 多级缓存优化
 * - 质量评估与监控
 *
 * 依赖:
 * - @weaviate/client: Weaviate 向量数据库
 * - openai / @anthropic-ai/sdk: LLM 服务
 * - ioredis: 缓存服务
 */

import { logger } from '../lib/logger';
import { env } from '../config/env';
import { SemanticSearchService, SemanticDocument } from '../semanticSearch';

// ============== 类型定义 ==============

export interface RAGConfig {
  /** Weaviate 配置 */
  weaviate: {
    url: string;
    apiKey?: string;
    embedder: 'openai' | 'cohere' | 'huggingface';
    embedderApiKey?: string;
    embedderModel?: string;
  };
  /** LLM 配置 */
  llm: {
    provider: 'openai' | 'anthropic' | 'local';
    apiKey?: string;
    baseUrl?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** 检索配置 */
  retrieval: {
    topK: number;
    similarityThreshold: number;
    hybridAlpha: number;
    enableRerank?: boolean;
    enableMmr?: boolean;
  };
  /** 分块配置 */
  chunking: {
    chunkSize: number;
    chunkOverlap: number;
    minChunkLength: number;
    maxChunkLength: number;
  };
  /** 缓存配置 */
  cache: {
    enabled: boolean;
    l1Ttl: number;
    l2Ttl: number;
  };
}

export interface RAGQuery {
  /** 用户查询 */
  query: string;
  /** 知识库集合名称 */
  collection?: string;
  /** 返回结果数量 */
  topK?: number;
  /** 启用流式输出 */
  stream?: boolean;
  /** 元数据过滤 */
  filters?: {
    source?: string;
    dateRange?: { start: string; end: string };
  };
}

export interface RAGResponse {
  /** 生成的答案 */
  answer: string;
  /** 引用来源 */
  sources: Source[];
  /** 元数据 */
  metadata: {
    retrievalTime: number;
    generationTime: number;
    tokensUsed: number;
  };
}

export interface Source {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface DocumentUpload {
  /** 文档内容 */
  content: string;
  /** 文档元数据 */
  metadata?: {
    title?: string;
    author?: string;
    source?: string;
    tags?: string[];
    createdAt?: string;
  };
  /** 自定义属性 */
  properties?: Record<string, unknown>;
}

export interface Collection {
  name: string;
  description?: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============== 默认配置 ==============

const DEFAULT_CONFIG: RAGConfig = {
  weaviate: {
    url: env.WEAVIATE_URL || 'localhost:8080',
    embedder: 'openai',
    embedderApiKey: env.OPENAI_API_KEY,
    embedderModel: 'text-embedding-ada-002',
  },
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
  },
  retrieval: {
    topK: 5,
    similarityThreshold: 0.7,
    hybridAlpha: 0.5,
    enableRerank: true,
    enableMmr: false,
  },
  chunking: {
    chunkSize: 512,
    chunkOverlap: 50,
    minChunkLength: 50,
    maxChunkLength: 2000,
  },
  cache: {
    enabled: true,
    l1Ttl: 30000,
    l2Ttl: 300000,
  },
};

// ============== RAG 服务主类 =============

export class RAGService {
  private config: RAGConfig;
  private semanticSearch: SemanticSearchService | null = null;
  private connected: boolean = false;
  private llmClient: LLMClient | null = null;
  private cache: RAGCache | null = null;

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initComponents();
  }

  /** 初始化组件 */
  private initComponents(): void {
    // 初始化 LLM 客户端
    this.llmClient = new LLMClient(this.config.llm);

    // 初始化缓存
    if (this.config.cache.enabled) {
      this.cache = new RAGCache({
        l1Ttl: this.config.cache.l1Ttl,
        l2Ttl: this.config.cache.l2Ttl,
      });
    }
  }

  /** 连接到 Weaviate */
  async connect(): Promise<boolean> {
    try {
      this.semanticSearch = new SemanticSearchService({
        url: this.config.weaviate.url,
        apiKey: this.config.weaviate.apiKey,
        embedder: this.config.weaviate.embedder,
        embedderApiKey: this.config.weaviate.embedderApiKey,
        embedderModel: this.config.weaviate.embedderModel,
      });

      const connected = await this.semanticSearch.connect();
      if (connected) {
        this.connected = true;
        logger.info('[RAG] Connected to Weaviate', {
          url: this.config.weaviate.url,
          embedder: this.config.weaviate.embedder,
        });
      }

      return connected;
    } catch (error) {
      logger.error('[RAG] Failed to connect to Weaviate', { error });
      return false;
    }
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    if (this.semanticSearch) {
      await this.semanticSearch.disconnect();
    }
    this.connected = false;
    logger.info('[RAG] Disconnected');
  }

  /** 检查连接状态 */
  isConnected(): boolean {
    return this.connected && this.semanticSearch?.isConnected() === true;
  }

  // ============== 知识库管理 ==============

  /**
   * 创建知识库集合
   */
  async createCollection(name: string, description?: string): Promise<boolean> {
    if (!this.semanticSearch) {
      throw new Error('RAG service not connected');
    }

    return this.semanticSearch.createClass(name, {
      description: description || `Knowledge base: ${name}`,
    });
  }

  /**
   * 删除知识库集合
   */
  async deleteCollection(name: string): Promise<boolean> {
    if (!this.semanticSearch) {
      throw new Error('RAG service not connected');
    }

    return this.semanticSearch.deleteClass(name);
  }

  /**
   * 获取知识库列表
   */
  async listCollections(): Promise<Collection[]> {
    if (!this.semanticSearch || !this.isConnected()) {
      return [];
    }

    // TODO: 实现集合列表获取
    return [];
  }

  /**
   * 添加文档到知识库
   */
  async addDocument(collection: string, doc: DocumentUpload): Promise<string> {
    if (!this.semanticSearch) {
      throw new Error('RAG service not connected');
    }

    const semanticDoc: SemanticDocument = {
      className: collection,
      content: doc.content,
      text: doc.content, // 原始文本用于显示
      metadata: doc.metadata,
      properties: doc.properties,
    };

    return this.semanticSearch.addDocument(semanticDoc);
  }

  /**
   * 批量添加文档
   */
  async addDocuments(collection: string, docs: DocumentUpload[]): Promise<{
    success: number;
    failed: number;
    ids: string[];
  }> {
    if (!this.semanticSearch) {
      throw new Error('RAG service not connected');
    }

    const semanticDocs = docs.map(doc => ({
      className: collection,
      content: doc.content,
      text: doc.content,
      metadata: doc.metadata,
      properties: doc.properties,
    }));

    const result = await this.semanticSearch.addDocuments(semanticDocs);

    return {
      success: result.success,
      failed: result.failed,
      ids: result.errors.map(e => e.id),
    };
  }

  /**
   * 删除文档
   */
  async deleteDocument(collection: string, id: string): Promise<boolean> {
    if (!this.semanticSearch) {
      throw new Error('RAG service not connected');
    }

    return this.semanticSearch.deleteDocument(collection, id);
  }

  // ============== RAG 查询 ==============

  /**
   * 执行 RAG 查询
   */
  async query(params: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now();

    // 1. 检查缓存
    if (this.cache) {
      const cached = await this.cache.get(params.query, params.collection);
      if (cached) {
        logger.debug('[RAG] Cache hit', { query: params.query });
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            retrievalTime: 0,
            generationTime: 0,
          },
        };
      }
    }

    // 2. 检索相关文档
    const retrievalStart = Date.now();
    const sources = await this.retrieve(params);

    if (sources.length === 0) {
      return {
        answer: '抱歉，没有找到与您问题相关的知识库内容。请尝试其他表述或联系人工客服。',
        sources: [],
        metadata: {
          retrievalTime: Date.now() - retrievalStart,
          generationTime: 0,
          tokensUsed: 0,
        },
      };
    }

    // 3. 生成答案
    const generationStart = Date.now();
    const context = this.buildContext(sources);
    const prompt = this.buildPrompt(params.query, context);

    const { text, usage } = await this.llmClient!.generate(prompt, {
      stream: params.stream ?? false,
    });

    const response: RAGResponse = {
      answer: text,
      sources,
      metadata: {
        retrievalTime: retrievalStart - startTime,
        generationTime: Date.now() - generationStart,
        tokensUsed: usage.totalTokens,
      },
    };

    // 4. 写入缓存
    if (this.cache) {
      await this.cache.set(params.query, params.collection, response);
    }

    return response;
  }

  /**
   * 检索相关文档
   */
  private async retrieve(params: RAGQuery): Promise<Source[]> {
    if (!this.semanticSearch) {
      throw new Error('RAG service not connected');
    }

    const collection = params.collection || 'default';
    const topK = params.topK || this.config.retrieval.topK;

    try {
      const results = await this.semanticSearch.search(collection, params.query, {
        limit: topK,
        hybridAlpha: this.config.retrieval.hybridAlpha,
        filter: this.buildFilter(params.filters),
      });

      return results.map(result => ({
        id: result.id,
        content: (result.object as any).content || '',
        score: result.score,
        metadata: (result.object as any).metadata || {},
      })).filter(source => source.score >= this.config.retrieval.similarityThreshold);
    } catch (error) {
      logger.error('[RAG] Retrieval failed', { error, collection });
      return [];
    }
  }

  /**
   * 构建上下文
   */
  private buildContext(sources: Source[]): string {
    return sources
      .map((source, index) => {
        const meta = source.metadata || {};
        const sourceInfo = [
          `[${index + 1}]`,
          meta.title ? `来源: ${meta.title}` : '',
          meta.source ? `(${meta.source})` : '',
        ].filter(Boolean).join(' ');

        return `${sourceInfo}\n${source.content}`;
      })
      .join('\n\n');
  }

  /**
   * 构建提示词
   */
  private buildPrompt(query: string, context: string): string {
    return `你是一个专业的知识库助手。请根据以下参考内容回答用户的问题。

如果参考内容中没有相关信息，请明确告知用户，不要编造答案。

参考内容:
${context}

用户问题: ${query}

回答要求:
1. 仅基于参考内容回答，不要编造信息
2. 如果有多个来源，请综合回答
3. 回答要清晰、有条理
4. 如有必要，可以引用来源编号

回答:`;
  }

  /**
   * 构建过滤条件
   */
  private buildFilter(filters?: RAGQuery['filters']): any {
    if (!filters) return undefined;

    const filter: any = {};

    if (filters.source) {
      filter.equal = { source: filters.source };
    }

    if (filters.dateRange) {
      filter.dateRange = {
        createdAt: filters.dateRange,
      };
    }

    return filter;
  }

  // ============== 文档处理 ==============

  /**
   * 文本分块
   */
  chunkText(text: string): string[] {
    const { chunkSize, chunkOverlap, minChunkLength, maxChunkLength } = this.config.chunking;
    const chunks: string[] = [];

    // 简单分块实现
    // TODO: 实现更智能的分块策略
    const sentences = text.split(/[。！？\n]/);
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = Math.ceil(sentence.length / 4); // 粗略估算

      if (currentTokens + sentenceTokens > chunkSize && currentChunk.length > 0) {
        // 保存当前块
        if (currentChunk.length >= minChunkLength) {
          chunks.push(currentChunk.trim());
        }

        // 开始新块，保留重叠
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + sentence;
        currentTokens = Math.ceil(currentChunk.length / 4);
      } else {
        currentChunk += sentence;
        currentTokens += sentenceTokens;
      }
    }

    // 保存最后一个块
    if (currentChunk.length >= minChunkLength && currentChunk.length <= maxChunkLength) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 解析文档内容
   */
  async parseDocument(content: string, type: string): Promise<string> {
    // TODO: 实现真正的文档解析
    // 目前仅支持纯文本
    switch (type.toLowerCase()) {
      case 'txt':
      case 'text':
        return content;
      case 'markdown':
      case 'md':
        // 移除 markdown 格式
        return content.replace(/[#*`_\[\]]/g, '');
      default:
        return content;
    }
  }
}

// ============== LLM 客户端 ==============

interface LLMClientConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface LLMResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  async generate(prompt: string, options: { stream?: boolean } = {}): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'openai':
        return this.generateOpenAI(prompt, options);
      case 'anthropic':
        return this.generateAnthropic(prompt, options);
      default:
        return this.generateOpenAI(prompt, options);
    }
  }

  private async generateOpenAI(prompt: string, options: { stream?: boolean }): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.config.baseUrl || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  private async generateAnthropic(prompt: string, options: { stream?: boolean }): Promise<LLMResponse> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      text: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }
}

// ============== RAG 缓存 ==============

interface RAGCacheConfig {
  l1Ttl: number;
  l2Ttl: number;
}

interface CacheEntry {
  value: RAGResponse;
  timestamp: number;
  ttl: number;
}

class RAGCache {
  private l1Cache: Map<string, CacheEntry> = new Map();
  private l2Client: any = null;
  private config: RAGCacheConfig;

  constructor(config: RAGCacheConfig) {
    this.config = config;
    this.initL2Cache();
  }

  private async initL2Cache(): Promise<void> {
    // TODO: 初始化 Redis L2 缓存
    // const redis = new Redis({ ... });
    // this.l2Client = redis;
  }

  private generateKey(query: string, collection?: string): string {
    return `rag:${collection || 'default'}:${query}`;
  }

  async get(query: string, collection?: string): Promise<RAGResponse | null> {
    const key = this.generateKey(query, collection);

    // L1 缓存查询
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && Date.now() - l1Entry.timestamp < l1Entry.ttl) {
      return l1Entry.value;
    }

    // L2 缓存查询
    if (this.l2Client) {
      try {
        const cached = await this.l2Client.get(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          // 回填 L1 缓存
          this.l1Cache.set(key, {
            value: parsed,
            timestamp: Date.now(),
            ttl: this.config.l1Ttl,
          });
          return parsed;
        }
      } catch (error) {
        logger.error('[RAG Cache] L2 read error', { error });
      }
    }

    return null;
  }

  async set(query: string, collection: string | undefined, value: RAGResponse): Promise<void> {
    const key = this.generateKey(query, collection);

    // L1 缓存设置
    this.l1Cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: this.config.l1Ttl,
    });

    // L2 缓存设置
    if (this.l2Client) {
      try {
        await this.l2Client.setEx(key, Math.floor(this.config.l2Ttl / 1000), JSON.stringify(value));
      } catch (error) {
        logger.error('[RAG Cache] L2 write error', { error });
      }
    }
  }

  async invalidate(pattern?: string): Promise<void> {
    // L1 缓存清除
    if (pattern) {
      for (const key of this.l1Cache.keys()) {
        if (key.includes(pattern)) {
          this.l1Cache.delete(key);
        }
      }
    } else {
      this.l1Cache.clear();
    }

    // L2 缓存清除 (如有必要)
    // TODO: 实现 L2 缓存清除
  }
}

// ============== 单例导出 ==============

let ragInstance: RAGService | null = null;

export function initRAG(config?: Partial<RAGConfig>): RAGService {
  ragInstance = new RAGService(config);
  return ragInstance;
}

export function getRAGService(): RAGService | null {
  return ragInstance;
}

export function getRAGServiceOrThrow(): RAGService {
  if (!ragInstance) {
    throw new Error('RAG service not initialized. Call initRAG first.');
  }
  return ragInstance;
}

export type {
  RAGConfig,
  RAGQuery,
  RAGResponse,
  Source,
  DocumentUpload,
  Collection,
};

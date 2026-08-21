/**
 * Weaviate 语义搜索服务
 *
 * 功能:
 * - 向量嵌入生成与存储
 * - 语义相似度搜索
 * - 混合搜索 (向量 + 关键词)
 * - 全文搜索增强
 * - 自动向量化
 * - 批量操作优化
 *
 * 依赖:
 * - @weaviate/client: Weaviate TypeScript 客户端
 * - 支持 OpenAI / Cohere / HuggingFace 等嵌入服务
 */

import { logger } from '../lib/logger';
import crypto from 'crypto';
import { env } from '../config/env';

// ============== 配置类型 ==============

export interface WeaviateConfig {
  /** Weaviate 连接 URL */
  url: string;
  /** API Key (可选，用于云端认证) */
  apiKey?: string;
  /** 嵌入服务类型 */
  embedder: 'openai' | 'cohere' | 'huggingface' | 'local' | 'transformers';
  /** 嵌入服务 API Key */
  embedderApiKey?: string;
  /** 嵌入模型 */
  embedderModel?: string;
  /** 向量维度 */
  vectorDimension?: number;
  /** 连接超时 (毫秒) */
  timeout?: number;
  /** 是否启用 HTTPS */
  secure?: boolean;
}

export interface SearchOptions {
  /** 返回结果数量 */
  limit?: number;
  /** 相似度阈值 (0-1) */
  certainty?: number;
  /** 搜索偏移量 */
  offset?: number;
  /** 返回字段筛选 */
  fields?: string[];
  /** 混合搜索权重 (0-1) */
  hybridAlpha?: number;
  /** 额外过滤器 */
  filter?: SearchFilter;
  /** 排序字段 */
  sort?: SortOption[];
}

export interface SearchFilter {
  /** 相等条件 */
  equal?: Record<string, unknown>;
  /** 不等条件 */
  notEqual?: Record<string, unknown>;
  /** 包含条件 */
  contains?: Record<string, unknown>;
  /** 数值范围 */
  range?: Record<string, { min?: number; max?: number }>;
  /** 日期范围 */
  dateRange?: Record<string, { start?: string; end?: string }>;
}

export interface SortOption {
  field: string;
  order: 'asc' | 'desc';
}

export interface SearchResult<T = unknown> {
  /** 结果对象 */
  object: T;
  /** 相似度得分 */
  score: number;
  /** 距离 (向量空间) */
  distance?: number;
  /** 所属类名 */
  className: string;
  /** 唯一 ID */
  id: string;
}

export interface SemanticDocument {
  /** 唯一 ID (可选，不提供则自动生成) */
  id?: string;
  /** 文档类名 */
  className: string;
  /** 文本内容 (用于生成向量) */
  content: string;
  /** 原始文本 (不向量化) */
  text?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 自定义属性 */
  properties?: Record<string, unknown>;
}

export interface BatchResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

// ============== 默认配置 ==============

const DEFAULT_CONFIG: Partial<WeaviateConfig> = {
  timeout: 30000,
  secure: true,
  embedder: 'openai',
  vectorDimension: 1536,
  hybridAlpha: 0.7,
};

// ============== 语义搜索服务 =============

export class SemanticSearchService {
  private config: WeaviateConfig;
  private client: unknown = null;
  private connected: boolean = false;
  private embedder: EmbedderService | null = null;

  constructor(config: WeaviateConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initEmbedder();
  }

  /** 初始化嵌入服务 */
  private initEmbedder(): void {
    switch (this.config.embedder) {
      case 'openai':
        this.embedder = new OpenAIEmbedder(this.config.embedderApiKey, this.config.embedderModel);
        break;
      case 'cohere':
        this.embedder = new CohereEmbedder(this.config.embedderApiKey, this.config.embedderModel);
        break;
      case 'huggingface':
        this.embedder = new HuggingFaceEmbedder(this.config.embedderApiKey, this.config.embedderModel);
        break;
      case 'transformers':
        this.embedder = new LocalTransformersEmbedder(this.config.embedderModel);
        break;
      default:
        this.embedder = new OpenAIEmbedder(this.config.embedderApiKey, this.config.embedderModel);
    }
  }

  /** 连接到 Weaviate */
  async connect(): Promise<boolean> {
    try {
      // 动态导入 Weaviate 客户端
      const { Client } = await import('@weaviate/client');

      const clientConfig: Record<string, unknown> = {
        scheme: this.config.secure ? 'https' : 'http',
        url: this.config.url,
        timeout: this.config.timeout,
      };

      if (this.config.apiKey) {
        clientConfig.apiKey = {
          apiKey: this.config.apiKey,
        };
      }

      this.client = Client.create(clientConfig);

      // 测试连接
      const meta = await (this.client as any).meta.get();
      logger.info('Weaviate connected', {
        version: meta.version,
        url: this.config.url
      });

      this.connected = true;
      return true;
    } catch (error) {
      logger.error('Failed to connect to Weaviate', { error, url: this.config.url });
      this.connected = false;
      return false;
    }
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
    logger.info('Weaviate disconnected');
  }

  /** 检查连接状态 */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /** 创建索引 (Class) */
  async createClass(className: string, options: {
    description?: string;
    vectorizer?: string;
    vectorIndexType?: 'hnsw' | 'flat';
    vectorIndexConfig?: Record<string, unknown>;
  } = {}): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      const classDefinition: Record<string, unknown> = {
        class: className,
        description: options.description || `Class for ${className}`,
        vectorizer: options.vectorizer || `text2vec-${this.config.embedder}`,
        vectorIndexType: options.vectorIndexType || 'hnsw',
      };

      if (options.vectorIndexConfig) {
        classDefinition.vectorIndexConfig = options.vectorIndexConfig;
      }

      await (this.client as any).schema.classCreator().withClass(classDefinition).do();
      logger.info('Weaviate class created', { className });
      return true;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        logger.warn('Weaviate class already exists', { className });
        return true;
      }
      logger.error('Failed to create Weaviate class', { error, className });
      throw error;
    }
  }

  /** 删除索引 */
  async deleteClass(className: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      await (this.client as any).schema.classDeleter().withClassName(className).do();
      logger.info('Weaviate class deleted', { className });
      return true;
    } catch (error) {
      logger.error('Failed to delete Weaviate class', { error, className });
      throw error;
    }
  }

  /** 检查索引是否存在 */
  async classExists(className: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      const classes = await (this.client as any).schema.getter().do();
      return classes.classes?.some((c: any) => c.class === className) || false;
    } catch (error) {
      logger.error('Failed to check class existence', { error, className });
      return false;
    }
  }

  /** 添加文档 */
  async addDocument(doc: SemanticDocument): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      const id = doc.id || crypto.randomUUID();

      const dataObject: Record<string, unknown> = {
        content: doc.content,
        ...doc.properties,
      };

      if (doc.text) {
        dataObject.text = doc.text;
      }
      if (doc.metadata) {
        dataObject.metadata = JSON.stringify(doc.metadata);
      }

      await (this.client as any).data
        .creator()
        .withClassName(doc.className)
        .withId(id)
        .withProperties(dataObject)
        .do();

      logger.debug('Document added', { className: doc.className, id });
      return id;
    } catch (error) {
      logger.error('Failed to add document', { error, doc });
      throw error;
    }
  }

  /** 批量添加文档 */
  async addDocuments(docs: SemanticDocument[]): Promise<BatchResult> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    const result: BatchResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      const batchObjects = docs.map(doc => ({
        class: doc.className,
        id: doc.id || crypto.randomUUID(),
        properties: {
          content: doc.content,
          text: doc.text,
          metadata: doc.metadata ? JSON.stringify(doc.metadata) : undefined,
          ...doc.properties,
        },
      }));

      const response = await (this.client as any).batch
        .objectsBatcher()
        .withObjects(...batchObjects)
        .do();

      for (const item of response) {
        if (item.result?.errors) {
          result.failed++;
          result.errors.push({
            id: item.id,
            error: JSON.stringify(item.result.errors),
          });
        } else {
          result.success++;
        }
      }

      logger.info('Batch add completed', {
        success: result.success,
        failed: result.failed
      });
      return result;
    } catch (error) {
      logger.error('Batch add failed', { error });
      throw error;
    }
  }

  /** 语义搜索 */
  async search<T = unknown>(
    query: string,
    className: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      const {
        limit = 10,
        certainty,
        offset = 0,
        fields,
        hybridAlpha = 0.7,
        filter,
        sort,
      } = options;

      let searchBuilder = (this.client as any).search
        .get()
        .withClassName(className)
        .withNearText({ concepts: [query] })
        .withLimit(limit)
        .withOffset(offset);

      if (certainty !== undefined) {
        searchBuilder = searchBuilder.withNearText({
          concepts: [query],
          certainty
        });
      }

      if (hybridAlpha !== undefined) {
        searchBuilder = searchBuilder.withHybrid(query, {
          alpha: hybridAlpha
        });
      }

      if (fields && fields.length > 0) {
        searchBuilder = searchBuilder.withFields(fields.join(' '));
      }

      if (filter) {
        const whereFilter = this.buildWhereFilter(filter);
        if (whereFilter) {
          searchBuilder = searchBuilder.withWhere(whereFilter);
        }
      }

      if (sort && sort.length > 0) {
        const sortClause = sort.map(s => ({
          [s.field]: { order: s.order },
        }));
        searchBuilder = searchBuilder.withSort(sortClause);
      }

      const response = await searchBuilder.do();

      return response.map((item: any) => ({
        object: this.parseProperties<T>(item.properties),
        score: item._additional?.certainty || item._additional?.score || 0,
        distance: item._additional?.distance,
        className: item.class,
        id: item.id,
      }));
    } catch (error) {
      logger.error('Semantic search failed', { error, query, className });
      throw error;
    }
  }

  /** 混合搜索 (向量 + 关键词) */
  async hybridSearch<T = unknown>(
    query: string,
    className: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    return this.search<T>(query, className, {
      ...options,
      hybridAlpha: options.hybridAlpha ?? 0.5,
    });
  }

  /** 相似性搜索 (基于已有向量) */
  async similaritySearch<T = unknown>(
    vector: number[],
    className: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      const { limit = 10, certainty } = options;

      let searchBuilder = (this.client as any).search
        .get()
        .withClassName(className)
        .withNearVector({ vector })
        .withLimit(limit);

      if (certainty !== undefined) {
        searchBuilder = searchBuilder.withNearVector({ vector, certainty });
      }

      const response = await searchBuilder.do();

      return response.map((item: any) => ({
        object: this.parseProperties<T>(item.properties),
        score: item._additional?.certainty || item._additional?.score || 0,
        distance: item._additional?.distance,
        className: item.class,
        id: item.id,
      }));
    } catch (error) {
      logger.error('Similarity search failed', { error, className });
      throw error;
    }
  }

  /** 获取文档 */
  async getDocument<T = unknown>(className: string, id: string): Promise<SearchResult<T> | null> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      const response = await (this.client as any).data
        .getterById()
        .withClassName(className)
        .withId(id)
        .do();

      if (!response) return null;

      return {
        object: this.parseProperties<T>(response.properties),
        score: 1,
        className: response.class,
        id: response.id,
      };
    } catch (error) {
      logger.error('Failed to get document', { error, className, id });
      return null;
    }
  }

  /** 更新文档 */
  async updateDocument(
    className: string,
    id: string,
    properties: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      await (this.client as any).data
        .updater()
        .withClassName(className)
        .withId(id)
        .withProperties(properties)
        .do();

      logger.debug('Document updated', { className, id });
      return true;
    } catch (error) {
      logger.error('Failed to update document', { error, className, id });
      throw error;
    }
  }

  /** 删除文档 */
  async deleteDocument(className: string, id: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      await (this.client as any).data
        .deleter()
        .withClassName(className)
        .withId(id)
        .do();

      logger.debug('Document deleted', { className, id });
      return true;
    } catch (error) {
      logger.error('Failed to delete document', { error, className, id });
      throw error;
    }
  }

  /** 获取集合统计 */
  async getStats(className: string): Promise<{
    count: number;
    vectorSize: number;
  }> {
    if (!this.isConnected()) {
      throw new Error('Weaviate not connected');
    }

    try {
      const response = await (this.client as any).schema
        .getter()
        .withClassName(className)
        .do();

      return {
        count: response.objectCount || 0,
        vectorSize: response.vectorIndexOnlineSize || 0,
      };
    } catch (error) {
      logger.error('Failed to get stats', { error, className });
      throw error;
    }
  }

  /** 生成文本向量 */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }
    return this.embedder.embed(text);
  }

  /** 批量生成向量 */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }
    return this.embedder.embedBatch(texts);
  }

  // ============== 内部辅助方法 ==============

  private buildWhereFilter(filter: SearchFilter): Record<string, unknown> | null {
    const conditions: Record<string, unknown>[] = [];

    if (filter.equal) {
      for (const [key, value] of Object.entries(filter.equal)) {
        conditions.push({
          path: [key],
          operator: 'Equal',
          valueString: String(value),
        });
      }
    }

    if (filter.notEqual) {
      for (const [key, value] of Object.entries(filter.notEqual)) {
        conditions.push({
          path: [key],
          operator: 'NotEqual',
          valueString: String(value),
        });
      }
    }

    if (filter.range) {
      for (const [key, { min, max }] of Object.entries(filter.range)) {
        if (min !== undefined) {
          conditions.push({
            path: [key],
            operator: 'GreaterThanEqual',
            valueNumber: min,
          });
        }
        if (max !== undefined) {
          conditions.push({
            path: [key],
            operator: 'LessThanEqual',
            valueNumber: max,
          });
        }
      }
    }

    if (conditions.length === 0) return null;
    if (conditions.length === 1) return conditions[0];

    return {
      operator: 'And',
      operands: conditions,
    };
  }

  private parseProperties<T>(properties: any): T {
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (key === 'metadata' && typeof value === 'string') {
        try {
          parsed[key] = JSON.parse(value);
        } catch {
          parsed[key] = value;
        }
      } else {
        parsed[key] = value;
      }
    }
    return parsed as T;
  }
}

// ============== 嵌入服务接口 ==============

interface EmbedderService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

class OpenAIEmbedder implements EmbedderService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = 'text-embedding-ada-002') {
    this.apiKey = apiKey || env.OPENAI_API_KEY || '';
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }
}

class CohereEmbedder implements EmbedderService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = 'embed-english-v3.0') {
    this.apiKey = apiKey || env.COHERE_API_KEY || '';
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        texts: [text],
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status}`);
    }

    const data = await response.json();
    return data.embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status}`);
    }

    const data = await response.json();
    return data.embeddings;
  }
}

class HuggingFaceEmbedder implements EmbedderService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = 'sentence-transformers/all-MiniLM-L6-v2') {
    this.apiKey = apiKey || env.HUGGINGFACE_API_KEY || '';
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data[0]) ? data[0] : data;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ inputs: texts }),
      }
    );

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    return await response.json();
  }
}

class LocalTransformersEmbedder implements EmbedderService {
  private modelPath?: string;

  constructor(modelPath?: string) {
    this.modelPath = modelPath;
    // 本地模型需要额外的设置，这里仅作为占位
    logger.warn('Local Transformers embedder requires additional setup');
  }

  async embed(_text: string): Promise<number[]> {
    // TODO: 实现本地模型推理
    throw new Error('Local Transformers embedder not implemented. Please use a cloud embedder.');
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    throw new Error('Local Transformers embedder not implemented. Please use a cloud embedder.');
  }
}

// ============== 导出单例 ==============

let semanticSearchInstance: SemanticSearchService | null = null;

export function initSemanticSearch(config: WeaviateConfig): SemanticSearchService {
  semanticSearchInstance = new SemanticSearchService(config);
  return semanticSearchInstance;
}

export function getSemanticSearch(): SemanticSearchService | null {
  return semanticSearchInstance;
}

export function getSemanticSearchOrThrow(): SemanticSearchService {
  if (!semanticSearchInstance) {
    throw new Error('SemanticSearch not initialized. Call initSemanticSearch first.');
  }
  return semanticSearchInstance;
}

export type { WeaviateConfig, SearchOptions, SearchFilter, SortOption, SearchResult, SemanticDocument, BatchResult };

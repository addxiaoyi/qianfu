/**
 * RAG 类型定义
 * 导出所有 RAG 相关类型供外部使用
 */

// 核心配置类型
export interface RAGConfig {
  weaviate: WeaviateConfig;
  llm: LLMConfig;
  retrieval: RetrievalConfig;
  chunking: ChunkingConfig;
  cache: CacheConfig;
}

export interface WeaviateConfig {
  url: string;
  apiKey?: string;
  embedder: 'openai' | 'cohere' | 'huggingface';
  embedderApiKey?: string;
  embedderModel?: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface RetrievalConfig {
  topK: number;
  similarityThreshold: number;
  hybridAlpha: number;
  enableRerank?: boolean;
  enableMmr?: boolean;
}

export interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
  minChunkLength: number;
  maxChunkLength: number;
}

export interface CacheConfig {
  enabled: boolean;
  l1Ttl: number;
  l2Ttl: number;
}

// 查询和响应类型
export interface RAGQuery {
  query: string;
  collection?: string;
  topK?: number;
  stream?: boolean;
  filters?: QueryFilters;
}

export interface QueryFilters {
  source?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  [key: string]: unknown;
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  retrievalTime: number;
  generationTime: number;
  tokensUsed: number;
}

export interface Source {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

// 文档类型
export interface DocumentUpload {
  content: string;
  metadata?: DocumentMetadata;
  properties?: Record<string, unknown>;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  source?: string;
  tags?: string[];
  createdAt?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
}

// 知识库类型
export interface Collection {
  name: string;
  description?: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionStats {
  name: string;
  documentCount: number;
  chunkCount: number;
  sizeBytes: number;
}

// 统计类型
export interface RAGStats {
  enabled: boolean;
  connected: boolean;
  collections: CollectionStats[];
  cacheHitRate: number;
  avgRetrievalTime: number;
  avgGenerationTime: number;
  totalTokensUsed: number;
}

// API 请求/响应类型
export interface QueryRequest extends RAGQuery {
  stream?: boolean;
}

export interface QueryResponse extends RAGResponse {}

export interface BatchQueryRequest {
  queries: RAGQuery[];
}

export interface BatchQueryResponse {
  count: number;
  results: Array<RAGResponse | { error: string; query: string }>;
}

export interface UploadRequest {
  content: string;
  collection: string;
  metadata?: DocumentMetadata;
  properties?: Record<string, unknown>;
}

export interface UploadResponse {
  id: string | null;
  status: 'created' | 'processing' | 'failed';
  chunksCreated: number;
  failed: number;
  totalChunks: number;
  processingTime: number;
}

export interface ChunkPreviewRequest {
  text: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface ChunkPreviewResponse {
  originalLength: number;
  chunksCount: number;
  chunks: string[];
}

export interface ParseDocumentRequest {
  content: string;
  type: string;
}

export interface ParseDocumentResponse {
  originalLength: number;
  parsedLength: number;
  content: string;
}

// 健康检查类型
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  timestamp: string;
}

// 错误类型
export interface RAGError {
  code: string;
  message: string;
  details?: unknown;
}

export enum RAGErrorCode {
  WEAVIATE_CONNECTION_FAILED = 'RAG_001',
  DOCUMENT_PARSE_FAILED = 'RAG_002',
  LLM_SERVICE_UNAVAILABLE = 'RAG_003',
  TOKEN_LIMIT_EXCEEDED = 'RAG_004',
  RETRIEVAL_NO_RESULTS = 'RAG_005',
  COLLECTION_NOT_FOUND = 'RAG_006',
  DOCUMENT_NOT_FOUND = 'RAG_007',
  INVALID_CONFIGURATION = 'RAG_008',
}

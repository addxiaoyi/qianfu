# 优化项 487: RAG系统 - 知识增强

**检索增强生成 (Retrieval-Augended Generation) - 知识库集成**

本项目基于现有 Weaviate 语义搜索基础设施，构建完整的 RAG 系统，实现：
1. 知识库管理 - 文档解析、分块、索引
2. 上下文注入 - 智能检索与上下文组装
3. LLM 集成 - 多模型支持与智能路由
4. 缓存优化 - 多级缓存与结果复用
5. 质量评估 - 检索质量与生成效果评估

## 一、架构设计

### 1.1 RAG 流程

```
用户查询
    │
    ▼
┌─────────────────┐
│   查询预处理     │  ← 意图识别、关键词提取、查询扩展
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   知识检索       │  ← Weaviate 向量搜索 + 混合检索
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   上下文组装     │  ← 文档排序、去重、摘要压缩
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   LLM 生成       │  ← OpenAI / Claude / 本地模型
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   结果后处理     │  ← 引用标注、来源追溯、格式输出
└─────────────────┘
```

### 1.2 模块关系

```
┌──────────────────────────────────────────────────────────────┐
│                        RAG 系统架构                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │ Document     │   │ Retrieval    │   │ Generation   │     │
│  │ Processor    │──▶│  Service     │──▶│  Service     │     │
│  │              │   │              │   │              │     │
│  │ • 解析器     │   │ • 向量检索   │   │ • LLM 调用   │     │
│  │ • 分块策略   │   │ • 混合搜索   │   │ • 提示词工程 │     │
│  │ • 元数据提取 │   │ • 重排序     │   │ • 流式输出   │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
│          │                  │                  │             │
│          │                  │                  │             │
│          ▼                  ▼                  ▼             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │ Knowledge    │   │ Context      │   │ Response     │     │
│  │ Base         │   │ Assembler    │   │ Formatter    │     │
│  │              │   │              │   │              │     │
│  │ • 文档存储   │   │ • 上下文组装 │   │ • 引用格式   │     │
│  │ • 版本管理   │   │ • 引用追溯   │   │ • 流式处理   │     │
│  │ • 权限控制   │   │ • 压缩优化   │   │ • 安全过滤   │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、实施清单

### 阶段一：知识库管理 (文档处理器)

- [ ] 2.1 `server/services/rag/documentProcessor.ts` - 文档处理器服务
  - [ ] 支持多种格式解析 (PDF, DOCX, Markdown, HTML, TXT)
  - [ ] 智能分块策略 (按段落、按 Token 数、递归分块)
  - [ ] 元数据自动提取 (标题、作者、日期、来源)
  - [ ] 重复检测与去重

- [ ] 2.2 `server/services/rag/chunking.ts` - 分块策略
  - [ ] 固定长度分块 (可配置 chunk_size)
  - [ ] 语义分块 (基于句子/段落边界)
  - [ ] 递归字符分块 (支持嵌套结构)
  - [ ] overlap 策略 (保留上下文连续性)

- [ ] 2.3 `server/services/rag/knowledgeBase.ts` - 知识库管理
  - [ ] 集合创建与管理 (按业务域分区)
  - [ ] 文档版本控制
  - [ ] 增量更新与删除
  - [ ] 访问权限控制

### 阶段二：检索增强

- [ ] 2.4 `server/services/rag/retrieval.ts` - 检索服务
  - [ ] 向量相似度搜索
  - [ ] 混合搜索 (向量 + BM25)
  - [ ] 多集合联合检索
  - [ ] 关键词过滤与元数据筛选

- [ ] 2.5 `server/services/rag/reranker.ts` - 重排序
  - [ ] 基于相关性的重排序
  - [ ] MMR (最大边际相关性) 多样性优化
  - [ ] 查询-文档相关性评分

- [ ] 2.6 `server/services/rag/contextAssembler.ts` - 上下文组装
  - [ ] 文档排序与选择
  - [ ] 上下文压缩 (摘要提取)
  - [ ] 引用追溯元数据
  - [ ] Token 数量控制

### 阶段三：生成增强

- [ ] 2.7 `server/services/rag/generation.ts` - 生成服务
  - [ ] 多 LLM 提供商支持 (OpenAI, Anthropic, 本地)
  - [ ] 智能模型选择 (根据复杂度/成本)
  - [ ] 流式输出支持
  - [ ] 错误重试与降级

- [ ] 2.8 `server/services/rag/prompts.ts` - 提示词管理
  - [ ] 系统提示词模板
  - [ ] 用户查询转换
  - [ ] 上下文注入策略
  - [ ] 引用格式模板

- [ ] 2.9 `server/services/rag/safety.ts` - 安全过滤
  - [ ] 内容安全检测
  - [ ] 敏感信息过滤
  - [ ] 输出格式验证

### 阶段四：缓存与优化

- [ ] 2.10 `server/services/rag/cache.ts` - RAG 缓存
  - [ ] 查询结果缓存 (Redis)
  - [ ] Embedding 缓存
  - [ ] LLM 响应缓存
  - [ ] 缓存失效策略

- [ ] 2.11 `server/services/rag/optimizer.ts` - 性能优化
  - [ ] 批量嵌入请求
  - [ ] 异步并行检索
  - [ ] 连接池管理
  - [ ] 熔断降级机制

### 阶段五：监控与评估

- [ ] 2.12 `server/services/rag/evaluator.ts` - 质量评估
  - [ ] 检索质量指标 (召回率、准确率)
  - [ ] 生成质量评估
  - [ ] 用户反馈收集
  - [ ] A/B 测试支持

- [ ] 2.13 `server/services/rag/metrics.ts` - 监控指标
  - [ ] 检索延迟 (P50, P95, P99)
  - [ ] 生成延迟
  - [ ] Token 消耗统计
  - [ ] 零结果率追踪

### 阶段六：API 路由

- [ ] 2.14 `server/routes/rag.ts` - RAG API 路由
  - [ ] `POST /api/rag/query` - 问答查询
  - [ ] `POST /api/rag/documents` - 上传文档
  - [ ] `GET /api/rag/documents` - 文档列表
  - [ ] `DELETE /api/rag/documents/:id` - 删除文档
  - [ ] `GET /api/rag/collections` - 知识库列表
  - [ ] `POST /api/rag/collections` - 创建知识库
  - [ ] `GET /api/rag/health` - 健康检查

---

## 三、技术规格

### 3.1 文档分块配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| chunk_size | 512 | 每个块的最大 Token 数 |
| chunk_overlap | 50 | 块之间的重叠 Token 数 |
| min_chunk_length | 50 | 最小块长度 (字符) |
| max_chunk_length | 2000 | 最大块长度 (字符) |

### 3.2 检索配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| top_k | 5 | 返回结果数量 |
| similarity_threshold | 0.7 | 相似度阈值 |
| hybrid_alpha | 0.5 | 混合搜索权重 (0=关键词, 1=向量) |
| enable_rerank | true | 是否启用重排序 |
| enable_mmr | false | MMR 多样性优化 |

### 3.3 LLM 配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| provider | openai | LLM 提供商 |
| model | gpt-4o-mini | 生成模型 |
| temperature | 0.7 | 随机性参数 |
| max_tokens | 2000 | 最大输出 Token 数 |
| streaming | true | 是否启用流式输出 |

### 3.4 缓存策略

| 层级 | TTL | 说明 |
|------|-----|------|
| L1 (内存) | 30s | 热点查询 |
| L2 (Redis) | 5min | 常规查询结果 |
| LLM 缓存 | 1h | LLM 响应缓存 |

---

## 四、环境变量配置

```bash
# RAG 配置
RAG_ENABLED=true
RAG_DEFAULT_COLLECTION=knowledge_base

# LLM 配置
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000

# 向量检索配置
VECTOR_TOP_K=5
VECTOR_SIMILARITY_THRESHOLD=0.7
VECTOR_HYBRID_ALPHA=0.5

# 分块配置
CHUNK_SIZE=512
CHUNK_OVERLAP=50

# 缓存配置
RAG_CACHE_ENABLED=true
RAG_CACHE_L1_TTL=30000
RAG_CACHE_L2_TTL=300000
```

---

## 五、API 规格

### 5.1 问答查询

```typescript
// POST /api/rag/query
interface QueryRequest {
  query: string;              // 用户问题
  collection?: string;        // 知识库名称 (默认: default)
  topK?: number;              // 检索数量
  stream?: boolean;           // 流式输出
  filters?: {                 // 元数据过滤
    source?: string;
    dateRange?: { start: string; end: string };
  };
}

interface QueryResponse {
  answer: string;             // 生成的答案
  sources: {                  // 引用来源
    id: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
  }[];
  metadata: {
    retrievalTime: number;    // 检索耗时 (ms)
    generationTime: number;   // 生成耗时 (ms)
    tokensUsed: number;       // 使用 Token 数
  };
}
```

### 5.2 文档上传

```typescript
// POST /api/rag/documents
interface UploadRequest {
  file: File | Buffer;        // 文档文件
  collection: string;         // 知识库名称
  metadata?: {                // 文档元数据
    title?: string;
    author?: string;
    tags?: string[];
  };
}

interface UploadResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  chunksCreated: number;
  processingTime: number;
}
```

---

## 六、错误处理

| 错误码 | 错误类型 | 处理策略 |
|--------|----------|----------|
| RAG_001 | Weaviate 连接失败 | 重试3次，指数退避 |
| RAG_002 | 文档解析失败 | 返回错误详情，跳过该文档 |
| RAG_003 | LLM 服务不可用 | 降级到简单匹配模式 |
| RAG_004 | Token 超出限制 | 截断上下文或分页返回 |
| RAG_005 | 检索无结果 | 返回空结果，附带建议 |

---

## 七、集成到现有系统

### 7.1 服务初始化

```typescript
// server/index.ts
import { initRAG, getRAGService } from './services/rag';

async function startServer() {
  // 延迟初始化 RAG 服务
  setTimeout(async () => {
    try {
      const rag = initRAG({
        weaviateUrl: process.env.WEAVIATE_URL || 'localhost:8080',
        llmProvider: process.env.LLM_PROVIDER || 'openai',
        llmApiKey: process.env.OPENAI_API_KEY,
      });
      await rag.connect();
      console.log('[RAG] Knowledge base service initialized');
    } catch (error) {
      console.error('[RAG] Initialization failed:', error);
    }
  }, 3000);
}
```

### 7.2 路由注册

```typescript
// server/index.ts
import ragRouter from './routes/rag';

app.use('/api/rag', ragRouter);
```

---

## 八、性能基准

| 操作 | 目标延迟 | 说明 |
|------|----------|------|
| 文档上传 (1MB) | < 5s | 含解析和嵌入 |
| 简单查询 | < 500ms | 缓存命中 |
| 复杂查询 | < 2s | 需要 LLM 调用 |
| 批量嵌入 (100条) | < 10s | 批量处理 |

---

## 九、监控指标

```typescript
// 关键指标
const metrics = {
  // 检索指标
  'rag.retrieval.latency': Histogram,      // 检索延迟分布
  'rag.retrieval.count': Counter,          // 检索请求数
  'rag.retrieval.empty': Counter,          // 空结果数

  // 生成指标
  'rag.generation.latency': Histogram,     // 生成延迟
  'rag.generation.tokens': Counter,        // Token 消耗
  'rag.generation.errors': Counter,        // 生成错误数

  // 文档指标
  'rag.documents.uploaded': Counter,       // 上传文档数
  'rag.documents.chunks': Counter,         // 创建块数
  'rag.documents.size': Histogram,         // 文档大小分布
};
```

---

## 十、依赖安装

```bash
npm install @weaviate/client
npm install pdf-parse mammoth docx-parser
npm install openai @anthropic-ai/sdk
npm install zod                        # 类型验证
npm install ioredis                    # Redis 缓存
```

---

## 十一、安全考虑

1. **数据隔离**: 不同租户的文档存储在独立集合
2. **访问控制**: API 密钥 + 权限验证
3. **内容过滤**: 输入输出安全检测
4. **审计日志**: 所有 RAG 操作记录审计
5. **加密存储**: 敏感文档加密存储

---

## 十二、后续扩展

- [ ] 多模态 RAG (支持图片、表格)
- [ ] 知识图谱增强 (实体链接、关系推理)
- [ ] 主动学习 (基于反馈优化检索)
- [ ] 本地部署 (Ollama 支持)
- [ ] 个性化 RAG (用户偏好学习)

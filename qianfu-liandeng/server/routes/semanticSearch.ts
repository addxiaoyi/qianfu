/**
 * 语义搜索路由
 * 提供 REST API 接口访问 Weaviate 语义搜索功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getSemanticSearch,
  getSemanticSearchOrThrow,
  SemanticDocument,
  SearchOptions,
  WeaviateConfig,
} from '../services/semanticSearch';
import { logger } from '../lib/logger';

const router = Router();

/**
 * 通用错误处理包装
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============== 配置接口 ==============

/**
 * 初始化 Weaviate 连接
 * POST /api/semantic/init
 */
router.post('/init', asyncHandler(async (req: Request, res: Response) => {
  const config: WeaviateConfig = req.body;

  if (!config.url) {
    res.status(400).json({ error: 'Missing required field: url' });
    return;
  }

  const semantic = getSemanticSearch();
  if (semantic?.isConnected()) {
    res.json({ status: 'already_connected' });
    return;
  }

  // 初始化并连接
  const { initSemanticSearch } = await import('../services/semanticSearch');
  const instance = initSemanticSearch(config);
  const connected = await instance.connect();

  if (connected) {
    res.json({ status: 'connected', config: { url: config.url } });
  } else {
    res.status(500).json({ error: 'Failed to connect to Weaviate' });
  }
}));

/**
 * 检查连接状态
 * GET /api/semantic/status
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const semantic = getSemanticSearch();
  const connected = semantic?.isConnected() || false;

  res.json({
    connected,
    url: semantic ? 'configured' : 'not_configured',
  });
}));

// ============== 索引管理 ==============

/**
 * 创建索引
 * POST /api/semantic/classes
 */
router.post('/classes', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { className, description, vectorizer, vectorIndexType, vectorIndexConfig } = req.body;

  if (!className) {
    res.status(400).json({ error: 'Missing required field: className' });
    return;
  }

  await semantic.createClass(className, {
    description,
    vectorizer,
    vectorIndexType,
    vectorIndexConfig,
  });

  res.json({ status: 'created', className });
}));

/**
 * 删除索引
 * DELETE /api/semantic/classes/:className
 */
router.delete('/classes/:className', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { className } = req.params;

  await semantic.deleteClass(className);
  res.json({ status: 'deleted', className });
}));

/**
 * 检查索引是否存在
 * GET /api/semantic/classes/:className/exists
 */
router.get('/classes/:className/exists', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { className } = req.params;

  const exists = await semantic.classExists(className);
  res.json({ className, exists });
}));

/**
 * 获取索引统计
 * GET /api/semantic/classes/:className/stats
 */
router.get('/classes/:className/stats', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { className } = req.params;

  const stats = await semantic.getStats(className);
  res.json({ className, ...stats });
}));

// ============== 文档操作 ==============

/**
 * 添加文档
 * POST /api/semantic/documents
 */
router.post('/documents', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const doc: SemanticDocument = req.body;

  if (!doc.className || !doc.content) {
    res.status(400).json({ error: 'Missing required fields: className, content' });
    return;
  }

  const id = await semantic.addDocument(doc);
  res.status(201).json({ id, status: 'created' });
}));

/**
 * 批量添加文档
 * POST /api/semantic/documents/batch
 */
router.post('/documents/batch', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { documents } = req.body as { documents: SemanticDocument[] };

  if (!documents || !Array.isArray(documents)) {
    res.status(400).json({ error: 'Missing or invalid field: documents (array expected)' });
    return;
  }

  const result = await semantic.addDocuments(documents);
  res.status(201).json(result);
}));

/**
 * 获取文档
 * GET /api/semantic/documents/:className/:id
 */
router.get('/documents/:className/:id', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { className, id } = req.params;

  const doc = await semantic.getDocument(className, id);

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.json(doc);
}));

/**
 * 更新文档
 * PUT /api/semantic/documents/:className/:id
 */
router.put('/documents/:className/:id', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { className, id } = req.params;
  const { properties } = req.body;

  if (!properties) {
    res.status(400).json({ error: 'Missing required field: properties' });
    return;
  }

  await semantic.updateDocument(className, id, properties);
  res.json({ status: 'updated', className, id });
}));

/**
 * 删除文档
 * DELETE /api/semantic/documents/:className/:id
 */
router.delete('/documents/:className/:id', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { className, id } = req.params;

  await semantic.deleteDocument(className, id);
  res.json({ status: 'deleted', className, id });
}));

// ============== 搜索接口 ==============

/**
 * 语义搜索
 * POST /api/semantic/search
 */
router.post('/search', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { query, className, ...options } = req.body as {
    query: string;
    className: string;
    options?: SearchOptions;
  };

  if (!query || !className) {
    res.status(400).json({ error: 'Missing required fields: query, className' });
    return;
  }

  const results = await semantic.search(query, className, options);
  res.json({
    query,
    className,
    count: results.length,
    results,
  });
}));

/**
 * 混合搜索 (向量 + 关键词)
 * POST /api/semantic/hybrid
 */
router.post('/hybrid', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { query, className, ...options } = req.body as {
    query: string;
    className: string;
    options?: SearchOptions;
  };

  if (!query || !className) {
    res.status(400).json({ error: 'Missing required fields: query, className' });
    return;
  }

  const results = await semantic.hybridSearch(query, className, options);
  res.json({
    query,
    className,
    count: results.length,
    results,
  });
}));

/**
 * 相似性搜索 (基于向量)
 * POST /api/semantic/similarity
 */
router.post('/similarity', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { vector, className, ...options } = req.body as {
    vector: number[];
    className: string;
    options?: SearchOptions;
  };

  if (!vector || !className) {
    res.status(400).json({ error: 'Missing required fields: vector, className' });
    return;
  }

  const results = await semantic.similaritySearch(vector, className, options);
  res.json({
    className,
    count: results.length,
    results,
  });
}));

/**
 * 生成嵌入向量
 * POST /api/semantic/embed
 */
router.post('/embed', asyncHandler(async (req: Request, res: Response) => {
  const semantic = getSemanticSearchOrThrow();
  const { text, texts } = req.body as { text?: string; texts?: string[] };

  if (!text && !texts) {
    res.status(400).json({ error: 'Missing required field: text or texts' });
    return;
  }

  if (text) {
    const embedding = await semantic.generateEmbedding(text);
    res.json({ embedding, dimension: embedding.length });
  } else {
    const embeddings = await semantic.generateEmbeddings(texts!);
    res.json({
      embeddings,
      count: embeddings.length,
      dimensions: embeddings.map(e => e.length),
    });
  }
}));

export default router;

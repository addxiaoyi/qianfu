/**
 * RAG 知识增强路由
 * 提供 REST API 接口访问 RAG 功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getRAGService,
  getRAGServiceOrThrow,
  RAGQuery,
  DocumentUpload,
  Collection,
} from '../services/rag';
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

// ============== 健康检查 ==============

/**
 * RAG 健康检查
 * GET /api/rag/health
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  const rag = getRAGService();
  const connected = rag?.isConnected() || false;

  res.json({
    status: connected ? 'healthy' : 'degraded',
    connected,
    timestamp: new Date().toISOString(),
  });
}));

// ============== 知识库管理 ==============

/**
 * 创建知识库集合
 * POST /api/rag/collections
 */
router.post('/collections', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { name, description } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Missing required field: name' });
    return;
  }

  await rag.createCollection(name, description);
  res.status(201).json({ status: 'created', name });
}));

/**
 * 获取知识库列表
 * GET /api/rag/collections
 */
router.get('/collections', asyncHandler(async (_req: Request, res: Response) => {
  const rag = getRAGService();

  if (!rag) {
    res.json({ collections: [] });
    return;
  }

  const collections = await rag.listCollections();
  res.json({ collections });
}));

/**
 * 删除知识库集合
 * DELETE /api/rag/collections/:name
 */
router.delete('/collections/:name', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { name } = req.params;

  await rag.deleteCollection(name);
  res.json({ status: 'deleted', name });
}));

// ============== 文档操作 ==============

/**
 * 上传文档
 * POST /api/rag/documents
 */
router.post('/documents', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { content, collection, metadata, properties } = req.body as DocumentUpload & { collection: string };

  if (!content || !collection) {
    res.status(400).json({ error: 'Missing required fields: content, collection' });
    return;
  }

  // 处理文档分块
  const chunks = rag.chunkText(content);

  // 批量添加文档块
  const docs = chunks.map((chunk, index) => ({
    content: chunk,
    metadata: {
      ...metadata,
      chunkIndex: index,
      totalChunks: chunks.length,
    },
    properties,
  }));

  const result = await rag.addDocuments(collection, docs);

  res.status(201).json({
    status: 'created',
    id: result.ids[0] || null,
    chunksCreated: result.success,
    failed: result.failed,
    totalChunks: chunks.length,
  });
}));

/**
 * 获取文档列表
 * GET /api/rag/documents
 */
router.get('/documents', asyncHandler(async (req: Request, res: Response) => {
  // TODO: 实现文档列表查询
  res.json({
    documents: [],
    message: 'Document listing not yet implemented',
  });
}));

/**
 * 删除文档
 * DELETE /api/rag/documents/:collection/:id
 */
router.delete('/documents/:collection/:id', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { collection, id } = req.params;

  const deleted = await rag.deleteDocument(collection, id);

  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.json({ status: 'deleted', collection, id });
}));

// ============== RAG 查询 ==============

/**
 * 问答查询
 * POST /api/rag/query
 */
router.post('/query', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { query, collection, topK, stream, filters } = req.body as RAGQuery;

  if (!query) {
    res.status(400).json({ error: 'Missing required field: query' });
    return;
  }

  try {
    const response = await rag.query({
      query,
      collection,
      topK,
      stream,
      filters,
    });

    res.json({
      answer: response.answer,
      sources: response.sources,
      metadata: response.metadata,
    });
  } catch (error: any) {
    logger.error('[RAG] Query failed', { error, query });

    // 错误处理
    if (error.message?.includes('LLM')) {
      res.status(503).json({
        error: 'LLM service unavailable',
        message: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Query failed',
        message: error.message,
      });
    }
  }
}));

/**
 * 流式问答查询
 * POST /api/rag/query/stream
 */
router.post('/query/stream', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { query, collection, topK, filters } = req.body as RAGQuery;

  if (!query) {
    res.status(400).json({ error: 'Missing required field: query' });
    return;
  }

  // 设置流式响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // 先获取来源
    const response = await rag.query({
      query,
      collection,
      topK,
      stream: true,
      filters,
    });

    // 发送来源信息
    res.write(`data: ${JSON.stringify({ type: 'sources', data: response.sources })}\n\n`);

    // 发送完整响应 (实际流式需要 LLM 支持)
    res.write(`data: ${JSON.stringify({ type: 'answer', data: response.answer })}\n\n`);

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'done', metadata: response.metadata })}\n\n`);
    res.end();
  } catch (error: any) {
    logger.error('[RAG] Stream query failed', { error, query });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}));

/**
 * 批量查询
 * POST /api/rag/query/batch
 */
router.post('/query/batch', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { queries } = req.body as { queries: RAGQuery[] };

  if (!queries || !Array.isArray(queries)) {
    res.status(400).json({ error: 'Missing or invalid field: queries (array expected)' });
    return;
  }

  // 并行执行查询
  const results = await Promise.all(
    queries.map(q => rag.query(q).catch(err => ({
      error: err.message,
      query: q.query,
    })))
  );

  res.json({
    count: results.length,
    results,
  });
}));

// ============== 文档处理工具 ==============

/**
 * 文本分块预览
 * POST /api/rag/chunk
 */
router.post('/chunk', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ error: 'Missing required field: text' });
    return;
  }

  const chunks = rag.chunkText(text);

  res.json({
    originalLength: text.length,
    chunksCount: chunks.length,
    chunks,
  });
}));

/**
 * 解析文档
 * POST /api/rag/parse
 */
router.post('/parse', asyncHandler(async (req: Request, res: Response) => {
  const rag = getRAGServiceOrThrow();
  const { content, type } = req.body;

  if (!content || !type) {
    res.status(400).json({ error: 'Missing required fields: content, type' });
    return;
  }

  const parsed = await rag.parseDocument(content, type);

  res.json({
    originalLength: content.length,
    parsedLength: parsed.length,
    content: parsed,
  });
}));

// ============== 统计信息 ==============

/**
 * 获取 RAG 统计信息
 * GET /api/rag/stats
 */
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const rag = getRAGService();

  if (!rag) {
    res.json({
      enabled: false,
      collections: 0,
      documents: 0,
    });
    return;
  }

  // TODO: 实现统计信息获取
  res.json({
    enabled: true,
    connected: rag.isConnected(),
    collections: 0,
    documents: 0,
  });
}));

export default router;

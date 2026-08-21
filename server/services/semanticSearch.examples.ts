/**
 * 语义搜索使用示例
 * 展示如何在应用中使用 Weaviate 语义搜索功能
 *
 * 使用场景:
 * 1. 产品搜索 - 语义匹配用户查询
 * 2. 内容推荐 - 基于相似性的推荐
 * 3. 知识库问答 - 语义匹配问题与答案
 * 4. 文档检索 - 智能文档搜索
 * 5. 图片搜索 - 基于描述的相似图片检索
 */

import {
  initSemanticSearch,
  getSemanticSearch,
  SemanticDocument,
  SearchOptions,
  WeaviateConfig,
} from '../services/semanticSearch';
import { config as appConfig } from '../config/env';

// ============== 示例1: 初始化连接 ==============

export async function initSemanticSearchService() {
  const config: WeaviateConfig = {
    url: appConfig.ai.weaviateUrl || 'localhost:8080',
    apiKey: appConfig.ai.weaviateApiKey,
    embedder: 'openai', // 或 'cohere', 'huggingface'
    embedderApiKey: appConfig.ai.openaiApiKey,
    embedderModel: 'text-embedding-3-small', // 更小、更快的模型
    timeout: 30000,
    secure: appConfig.app.isProduction, // 生产环境设为 true
  };

  const semantic = initSemanticSearch(config);
  const connected = await semantic.connect();

  if (!connected) {
    throw new Error('Failed to connect to Weaviate');
  }

  return semantic;
}

// ============== 示例2: 创建产品搜索索引 ==============

export async function setupProductSearchIndex() {
  const semantic = getSemanticSearch();
  if (!semantic) throw new Error('Semantic search not initialized');

  const className = 'Product';

  // 创建索引
  await semantic.createClass(className, {
    description: 'Product catalog for semantic search',
    vectorizer: 'text2vec-openai',
    vectorIndexType: 'hnsw',
    vectorIndexConfig: {
      distance: 'cosine', // 余弦距离，适合语义搜索
      efConstruction: 128,
      maxConnections: 64,
    },
  });

  // 添加示例产品
  const products: SemanticDocument[] = [
    {
      className,
      content: 'Apple iPhone 15 Pro Max - Latest smartphone with A17 Pro chip, titanium design, 5x optical zoom camera',
      properties: {
        name: 'iPhone 15 Pro Max',
        price: 1199,
        category: 'Electronics',
        brand: 'Apple',
      },
    },
    {
      className,
      content: 'Samsung Galaxy S24 Ultra - Premium Android phone with S Pen, 200MP camera, AI features',
      properties: {
        name: 'Galaxy S24 Ultra',
        price: 1299,
        category: 'Electronics',
        brand: 'Samsung',
      },
    },
    {
      className,
      content: 'Sony WH-1000XM5 - Premium noise cancelling wireless headphones with exceptional sound quality',
      properties: {
        name: 'WH-1000XM5 Headphones',
        price: 399,
        category: 'Audio',
        brand: 'Sony',
      },
    },
  ];

  const result = await semantic.addDocuments(products);
  console.log(`Indexed ${result.success} products`);

  return className;
}

// ============== 示例3: 语义产品搜索 ==============

export async function searchProducts(query: string) {
  const semantic = getSemanticSearch();
  if (!semantic) throw new Error('Semantic search not initialized');

  const results = await semantic.search(
    query,
    'Product',
    {
      limit: 5,
      hybridAlpha: 0.7, // 70% 向量搜索，30% 关键词搜索
      sort: [{ field: 'price', order: 'asc' }],
      filter: {
        range: {
          price: { min: 0, max: 2000 },
        },
      },
    }
  );

  return results.map((result) => ({
    ...result.object,
    score: result.score,
    id: result.id,
  }));
}

// ============== 示例4: 知识库问答 ==============

export async function setupKnowledgeBase() {
  const semantic = getSemanticSearch();
  if (!semantic) throw new Error('Semantic search not initialized');

  const className = 'KnowledgeArticle';

  await semantic.createClass(className, {
    description: 'Knowledge base articles for Q&A',
    vectorizer: 'text2vec-openai',
  });

  const articles: SemanticDocument[] = [
    {
      className,
      content: 'How to reset my password? Go to settings, click security, select reset password and follow the email instructions.',
      properties: {
        title: 'Password Reset Guide',
        category: 'Account',
        tags: ['password', 'security', 'account'],
      },
      metadata: {
        views: 15420,
        helpful: 892,
      },
    },
    {
      className,
      content: 'To upgrade your subscription, go to billing settings, select change plan, and choose your new tier. Changes take effect immediately.',
      properties: {
        title: 'Subscription Upgrade',
        category: 'Billing',
        tags: ['subscription', 'billing', 'upgrade'],
      },
      metadata: {
        views: 8932,
        helpful: 654,
      },
    },
  ];

  await semantic.addDocuments(articles);
  return className;
}

export async function findRelatedArticles(question: string) {
  const semantic = getSemanticSearch();
  if (!semantic) throw new Error('Semantic search not initialized');

  const results = await semantic.hybridSearch(question, 'KnowledgeArticle', {
    limit: 3,
    certainty: 0.7, // 高于 70% 相似度才返回
  });

  return results.map((result) => ({
    title: result.object.title,
    category: result.object.category,
    content: result.object.content,
    relevance: Math.round(result.score * 100) + '%',
  }));
}

// ============== 示例5: 相似文档推荐 ==============

export async function findSimilarDocuments(docId: string) {
  const semantic = getSemanticSearch();
  if (!semantic) throw new Error('Semantic search not initialized');

  // 获取原始文档
  const original = await semantic.getDocument('Document', docId);
  if (!original) throw new Error('Document not found');

  // 生成向量并搜索相似文档
  const vector = await semantic.generateEmbedding(original.object.content as string);
  const similar = await semantic.similaritySearch(vector, 'Document', {
    limit: 5,
    filter: {
      notEqual: { id: docId }, // 排除原文档
    },
  });

  return similar;
}

// ============== 示例6: 批量索引文档 ==============

export async function batchIndexDocuments(docs: Array<{
  title: string;
  content: string;
  author: string;
  tags: string[];
}>) {
  const semantic = getSemanticSearch();
  if (!semantic) throw new Error('Semantic search not initialized');

  const className = 'Document';

  // 确保索引存在
  if (!(await semantic.classExists(className))) {
    await semantic.createClass(className);
  }

  // 批量添加
  const documents: SemanticDocument[] = docs.map((doc) => ({
    className,
    content: `${doc.title} - ${doc.content}`, // 标题和内容组合用于向量生成
    properties: {
      title: doc.title,
      author: doc.author,
      tags: JSON.stringify(doc.tags),
    },
  }));

  const result = await semantic.addDocuments(documents);

  return {
    success: result.success,
    failed: result.failed,
    errors: result.errors,
  };
}

// ============== 示例7: 监控和统计 ==============

export async function getSearchStats() {
  const semantic = getSemanticSearch();
  if (!semantic) throw new Error('Semantic search not initialized');

  const classes = ['Product', 'KnowledgeArticle', 'Document'];
  const stats: Record<string, { count: number; vectorSize: number }> = {};

  for (const className of classes) {
    try {
      stats[className] = await semantic.getStats(className);
    } catch {
      stats[className] = { count: 0, vectorSize: 0 };
    }
  }

  return stats;
}

// ============== 使用流程示例 ==============

export async function exampleUsage() {
  // 1. 初始化
  await initSemanticSearchService();

  // 2. 设置索引
  await setupProductSearchIndex();

  // 3. 搜索示例
  console.log('Search: "best phone for photography"');
  const photos = await searchProducts('best phone for photography');
  console.log(photos);

  console.log('Search: "wireless headphones"');
  const audio = await searchProducts('wireless headphones');
  console.log(audio);

  // 4. 问答示例
  await setupKnowledgeBase();
  const answers = await findRelatedArticles('I forgot my password');
  console.log(answers);
}

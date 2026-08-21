/**
 * Weaviate 语义搜索集成文档
 *
 * 优化项 485: Weaviate - 语义搜索
 *
 * ================== 概述 ==================
 *
 * Weaviate 是一个开源的向量数据库，支持:
 * - 语义/向量搜索
 * - 混合搜索 (向量 + 关键词)
 * - 自动向量化
 * - 支持多种 embedding 服务
 *
 * ================== 依赖安装 ==================
 *
 * npm install @weaviate/client
 *
 * ================== 环境变量配置 ==================
 *
 * # Weaviate 连接 (可选，本地开发默认 localhost:8080)
 * WEAVIATE_URL=localhost:8080
 * WEAVIATE_API_KEY=your-weaviate-api-key  # 云端认证
 *
 * # 嵌入服务 API Key (根据使用的服务选择)
 * OPENAI_API_KEY=sk-xxx          # OpenAI
 * # COHERE_API_KEY=xxx            # Cohere
 * # HUGGINGFACE_API_KEY=xxx       # HuggingFace
 *
 * ================== 快速开始 ==================
 *
 * 1. 启动 Weaviate (Docker)
 *
 *    docker compose -f deploy/docker-compose.weaviate.yml up -d
 *
 * 2. 初始化服务
 *
 *    import { initSemanticSearch } from './services/semanticSearch';
 *
 *    const config = {
 *      url: 'localhost:8080',
 *      embedder: 'openai',
 *      embedderApiKey: process.env.OPENAI_API_KEY,
 *    };
 *
 *    const semantic = initSemanticSearch(config);
 *    await semantic.connect();
 *
 * 3. 创建索引并添加文档
 *
 *    await semantic.createClass('Product');
 *
 *    await semantic.addDocument({
 *      className: 'Product',
 *      content: 'iPhone 15 Pro - Best smartphone camera',
 *      properties: { name: 'iPhone 15 Pro', price: 999 }
 *    });
 *
 * 4. 执行语义搜索
 *
 *    const results = await semantic.search('phone with best camera');
 *    // 返回按语义相关性排序的结果
 *
 * ================== API 路由 ==================
 *
 * 基础配置:
 *   POST /api/semantic/init        - 初始化连接
 *   GET  /api/semantic/status      - 检查连接状态
 *
 * 索引管理:
 *   POST   /api/semantic/classes           - 创建索引
 *   DELETE /api/semantic/classes/:name     - 删除索引
 *   GET    /api/semantic/classes/:name/exists  - 检查是否存在
 *   GET    /api/semantic/classes/:name/stats   - 获取统计
 *
 * 文档操作:
 *   POST   /api/semantic/documents           - 添加文档
 *   POST   /api/semantic/documents/batch     - 批量添加
 *   GET    /api/semantic/documents/:class/:id - 获取文档
 *   PUT    /api/semantic/documents/:class/:id - 更新文档
 *   DELETE /api/semantic/documents/:class/:id - 删除文档
 *
 * 搜索功能:
 *   POST /api/semantic/search      - 语义搜索
 *   POST /api/semantic/hybrid      - 混合搜索
 *   POST /api/semantic/similarity  - 向量相似搜索
 *   POST /api/semantic/embed       - 生成嵌入向量
 *
 * ================== 搜索类型说明 ==================
 *
 * 1. 语义搜索 (Semantic Search)
 *    - 使用自然语言查询
 *    - 自动转换为向量进行搜索
 *    - 适合: "找到所有关于..." 的查询
 *
 * 2. 混合搜索 (Hybrid Search)
 *    - 结合向量搜索和关键词搜索
 *    - alpha 参数控制权重 (0-1)
 *    - 适合: 需要精确关键词匹配 + 语义扩展
 *
 * 3. 相似性搜索 (Similarity Search)
 *    - 基于已有向量找相似项
 *    - 需要手动生成或获取向量
 *    - 适合: 推荐系统、重复检测
 *
 * ================== 性能优化 ==================
 *
 * 1. 索引优化
 *    - HNSW 参数调优 (efConstruction, maxConnections)
 *    - 适当选择向量维度 (OpenAI ada-002: 1536, text-embedding-3-small: 1536/512)
 *
 * 2. 查询优化
 *    - 使用 limit 限制返回数量
 *    - 使用 filter 减少搜索范围
 *    - 批量操作替代单条操作
 *
 * 3. 缓存策略
 *    - 热门搜索结果缓存到 Redis
 *    - 常用向量预加载到内存
 *
 * ================== 最佳实践 ==================
 *
 * 1. 数据准备
 *    - content 字段用于生成向量，应包含完整语义信息
 *    - properties 可存储额外属性用于过滤和展示
 *    - metadata 用于存储统计信息
 *
 * 2. 搜索策略
 *    - 简单查询: 使用默认的 semantic search
 *    - 需要精确匹配: 使用 hybrid search (alpha=0.3)
 *    - 相似推荐: 使用 similarity search
 *
 * 3. 错误处理
 *    - 连接失败: 实现重试机制
 *    - 超时: 设置合理的 timeout
 *    - 限额: 遵守 API 速率限制
 *
 * ================== 嵌入服务对比 ==================
 *
 * | 服务        | 维度   | 速度 | 成本 | 质量 |
 * |-------------|--------|------|------|------|
 * | OpenAI      | 1536   | 快   | 中   | 高   |
 * | Cohere      | 1024   | 快   | 中   | 高   |
 * | HuggingFace | 可变   | 中   | 低   | 中高 |
 * | 本地 Ollama | 可变   | 慢   | 低   | 取决于模型 |
 *
 * ================== 集成到主应用 ==================
 *
 * 在 server/index.ts 中添加路由:
 *
 *    import semanticSearchRouter from './routes/semanticSearch';
 *    app.use('/api/semantic', semanticSearchRouter);
 *
 * 在应用启动时初始化:
 *
 *    import { initSemanticSearch } from './services/semanticSearch';
 *
 *    // 延迟初始化，避免 Weaviate 未启动
 *    setTimeout(async () => {
 *      try {
 *        const semantic = initSemanticSearch({
 *          url: process.env.WEAVIATE_URL || 'localhost:8080',
 *          embedder: 'openai',
 *          embedderApiKey: process.env.OPENAI_API_KEY,
 *        });
 *        await semantic.connect();
 *        console.log('Weaviate connected');
 *      } catch (error) {
 *        console.error('Weaviate connection failed:', error);
 *      }
 *    }, 5000);
 *
 * ================== 监控指标 ==================
 *
 * 建议收集以下指标:
 * - 搜索延迟 (P50, P95, P99)
 * - 搜索结果数量
 * - 零结果率
 * - 向量生成延迟
 * - 索引文档数量
 * - 连接状态
 */

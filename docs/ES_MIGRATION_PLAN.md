# Elasticsearch 迁移方案

> 文档版本: 1.0.0
> 创建日期: 2026-07-07
> 作者: 千服平台架构师
> 状态: 规划中

## 1. 现状分析

### 1.1 当前搜索架构

当前服务器列表搜索采用 **Prisma LIKE 查询模式**，存在以下特征:

```
搜索流程:
HTTP Request → Controller → Prisma Query (LIKE '%keyword%') → Redis Cache → Response
```

### 1.2 当前实现细节

**数据模型** (`Server` 模型):
- 主表: `Server` (id, name, name_en, summary, summary_en, tags, ip, platform, category, activity, etc.)
- 关联表: `ServerStatus` (online, playersOnline, versionNameRaw, latency_ms, etc.)
- 关联表: `ServerVersion` (历史版本信息)

**当前查询模式** (`dist-server/server/controllers/servers/list.js`):
```javascript
// 关键词搜索 - 使用 Prisma LIKE
OR: buildKeywordOrConditions(['name', 'name_en', 'summary', 'summary_en', 'tags', 'ip'], keyword, fuzzy)

// 模糊匹配
{ name: { contains: value } }

// 精确匹配
{ name: { equals: value } }
```

**当前过滤条件**:
| 字段 | 类型 | 说明 |
|------|------|------|
| keyword | string | 关键词模糊搜索 (6个字段) |
| tag | string | 标签过滤 |
| platform | enum | java/bedrock |
| category | string | 分类过滤 |
| version | string | 版本匹配 |
| online | boolean | 在线状态 |
| online_mode | boolean | 正版验证 |
| host | string | IP/主机过滤 |
| startDate/endDate | Date | 时间范围 |
| sortBy | enum | activity/updated/created/players/name |
| sortOrder | enum | asc/desc |

### 1.3 当前性能问题

| 问题 | 影响 | 严重程度 |
|------|------|----------|
| LIKE 查询无法利用索引 | 全表扫描 | 高 |
| 多字段 OR 查询 | 查询复杂度 O(n) | 高 |
| 无相关性排序 | 结果质量差 | 中 |
| 关联数据聚合查询 | JOIN 开销大 | 中 |
| 缓存失效频繁 | 缓存命中率低 | 低 |

### 1.4 数据规模

根据 `list.js` 实现分析:
- 主要查询 `localPrisma.server.findMany()`
- 备用 `prisma.server.findMany()`
- Redis 缓存 TTL: 60 秒
- 当前数据量估计: 1000-5000 条服务器记录

---

## 2. 迁移目标

### 2.1 核心目标

1. **性能提升**: 查询响应时间从 200-500ms 降至 <50ms
2. **搜索质量**: 引入相关性评分、模糊匹配、同义词支持
3. **功能增强**: 支持中文分词、多字段权重、聚合统计
4. **可扩展性**: 支持未来新增搜索维度 (如地理位置、游戏模式)

### 2.2 迁移范围

**范围之内**:
- 服务器列表搜索 API (`/api/servers`)
- 索引数据结构设计
- 数据同步机制
- 搜索服务封装

**范围之外** (本期不做):
- 其他模块搜索 (用户、评论、日志)
- 全文内容搜索 (content_html)
- 高级分析功能 (Kibana 集成)

### 2.3 非功能性目标

| 指标 | 当前 | 目标 |
|------|------|------|
| P50 延迟 | ~300ms | <30ms |
| P99 延迟 | ~800ms | <100ms |
| 缓存命中率 | ~60% | >85% |
| 搜索精度 (MRR@10) | N/A | >0.7 |

---

## 3. 索引设计

### 3.1 索引命名规范

```
qianfu-servers-v1        # 生产索引
qianfu-servers-v1-test   # 测试索引
qianfu-servers-v1-reindex # 重建索引 (蓝绿部署)
```

### 3.2 索引 Mapping

```json
{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "chinese_analyzer": {
          "type": "custom",
          "tokenizer": "ik_max_word",
          "filter": ["lowercase", "asciifolding"]
        },
        "pinyin_analyzer": {
          "type": "custom",
          "tokenizer": "pinyin_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "pinyin_tokenizer": {
          "type": "pinyin",
          "keep_first_letter": true,
          "keep_full_pinyin": false,
          "limit_first_letter_length": 16
        }
      },
      "filter": {
        "synonym_filter": {
          "type": "synonym",
          "synonyms": [
            "生存,survival,生存服",
            "RPG,roleplay,角色扮演",
            "小游戏,minigame,小游"
          ]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "integer" },
      "name": {
        "type": "text",
        "analyzer": "chinese_analyzer",
        "fields": {
          "keyword": { "type": "keyword" },
          "pinyin": { "type": "text", "analyzer": "pinyin_analyzer" }
        }
      },
      "name_en": { "type": "text", "analyzer": "standard" },
      "summary": {
        "type": "text",
        "analyzer": "chinese_analyzer",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "summary_en": { "type": "text", "analyzer": "standard" },
      "tags": {
        "type": "keyword",
        "fields": {
          "text": { "type": "text", "analyzer": "chinese_analyzer" }
        }
      },
      "ip": { "type": "keyword" },
      "thumbnail": { "type": "keyword", "index": false },
      "platform": { "type": "keyword" },
      "category": { "type": "keyword" },
      "online_mode": { "type": "boolean" },
      "supported_versions": { "type": "keyword" },
      "network_env": { "type": "keyword" },
      "like_count": { "type": "integer" },
      "comment_count": { "type": "integer" },
      "activity": { "type": "integer" },
      "owner_id": { "type": "integer" },
      "review_status": { "type": "keyword" },
      "listing_plan": { "type": "keyword" },
      "listing_expires_at": { "type": "date" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "status": {
        "type": "object",
        "properties": {
          "online": { "type": "boolean" },
          "players_online": { "type": "integer" },
          "players_max": { "type": "integer" },
          "latency_ms": { "type": "integer" },
          "version_name_raw": { "type": "keyword" }
        }
      },
      "suggest": {
        "type": "completion",
        "analyzer": "simple",
        "preserve_separators": true,
        "preserve_position_increments": true,
        "max_input_length": 50
      }
    }
  }
}
```

### 3.3 字段权重配置

```javascript
const FIELD_BOOSTS = {
  name: 10.0,           // 服务器名称最高权重
  name_en: 8.0,
  tags: 5.0,            // 标签次高权重
  summary: 3.0,         // 描述中等权重
  summary_en: 2.5,
  ip: 1.0,              // IP 地址权重最低
};
```

### 3.4 索引别名管理

```javascript
// 索引别名策略
PUT /qianfu-servers-v1-alias
{
  "actions": [
    { "add": { "index": "qianfu-servers-v1", "alias": "qianfu-servers-v1-alias" } }
  ]
}

// 蓝绿切换时更新别名
POST /_aliases
{
  "actions": [
    { "remove": { "index": "qianfu-servers-v1-old", "alias": "qianfu-servers-v1-alias" } },
    { "add": { "index": "qianfu-servers-v1-new", "alias": "qianfu-servers-v1-alias" } }
  ]
}
```

---

## 4. 数据同步策略

### 4.1 同步模式选择

| 模式 | 适用场景 | 延迟 | 复杂度 |
|------|----------|------|--------|
| 全量同步 | 初始导入、灾难恢复 | 高 | 低 |
| 增量同步 (CDC) | 常规更新 | 低 | 中 |
| 混合模式 | 生产切换 | 中 | 高 |

### 4.2 推荐策略: 混合模式

**阶段 1: 全量同步**
```javascript
// 使用 scroll API 进行全量数据导出
async function fullSync() {
  const scroll = await esClient.helpers.scrollSearch({
    index: 'qianfu-servers-v1-reindex',
    body: { query: { match_all: {} } },
    waitUntil: 'done'
  });
  
  const bulk = esClient.helpers.bulk({
    operations: scroll.documents.flatMap(doc => [
      { index: { _index: 'qianfu-servers-v1', _id: doc.id } },
      transformServerToES(doc)
    ])
  });
}
```

**阶段 2: 增量同步 (Prisma Transaction)**

监听数据库变更，通过轮询或事件驱动同步:

```javascript
// 增量同步触发条件
const SYNC_TRIGGERS = {
  INSERT: 'server.create',
  UPDATE: ['server.update', 'server.review', 'status.update'],
  DELETE: 'server.delete'
};

// 同步时间戳记录
const SYNC_STATE = {
  last_sync_at: '2026-07-07T00:00:00Z',
  last_sync_id: 12345,
  sync_batch_size: 100
};
```

### 4.3 同步频率

| 事件 | 触发方式 | 目标延迟 |
|------|----------|----------|
| 单条数据更新 | Webhook/队列 | <1s |
| 批量导入 | 定时任务 | <5min |
| 全量重建 | 手动触发 | 按需 |

### 4.4 一致性保证

```javascript
// 乐观锁机制 - 每次更新携带版本号
const indexDocument = async (server, version) => {
  await esClient.update({
    index: 'qianfu-servers-v1',
    id: server.id,
    body: {
      doc: transformServerToES(server),
      doc_as_upsert: true
    },
    if_seq_no: version.seqNo,  // 乐观锁
    if_primary_term: version.primaryTerm
  });
};

// 版本冲突处理
.catch(error => {
  if (error.meta?.statusCode === 409) {
    // 冲突时重新获取最新数据并重试
    return retryIndex(server.id, maxRetries - 1);
  }
  throw error;
});
```

---

## 5. 实施步骤 (6 步)

### Step 1: 环境准备 (Week 1)

**目标**: 搭建 ES 集群和开发环境

**任务清单**:
- [ ] 部署 ES 集群 (单节点用于开发/测试)
  ```bash
  # Docker Compose 配置
  docker run -d --name elasticsearch \
    -p 9200:9200 -p 9300:9300 \
    -e "discovery.type=single-node" \
    -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
    elasticsearch:8.12.0
  ```
- [ ] 安装 IK Analysis 中文分词插件
  ```bash
  bin/elasticsearch-plugin install analysis-ik
  ```
- [ ] 安装 Pinyin 分词插件 (可选)
  ```bash
  bin/elasticsearch-plugin install analysis-pinyin
  ```
- [ ] 配置 Kibana (可选, 用于调试)
- [ ] 创建 `.env` 配置
  ```bash
  ELASTICSEARCH_NODE=http://localhost:9200
  ELASTICSEARCH_USERNAME=elastic
  ELASTICSEARCH_PASSWORD=your_password
  ES_INDEX_PREFIX=qianfu-servers
  ```

**验收标准**:
- [ ] ES 集群健康状态为 `green` 或 `yellow`
- [ ] IK 分词器正常工作: `POST /_analyze { "text": "我的世界服务器", "analyzer": "ik_max_word" }`
- [ ] 可以创建索引并写入文档

---

### Step 2: 索引创建与测试 (Week 1-2)

**目标**: 完成索引设计并验证功能

**任务清单**:
- [ ] 创建索引 `qianfu-servers-v1`
- [ ] 配置 ILM (Index Lifecycle Management) 策略
  ```javascript
  // ILM 策略: 热数据 7 天, 温数据 30 天
  PUT /_ilm/policy/qianfu-servers-policy
  {
    "policy": {
      "phases": {
        "hot": {
          "min_age": "0ms",
          "actions": {
            "rollover": {
              "max_age": "7d",
              "max_size": "50gb"
            }
          }
        },
        "warm": {
          "min_age": "7d",
          "actions": {
            "shrink": { "number_of_shards": 1 },
            "forcemerge": { "max_num_segments": 1 }
          }
        },
        "delete": {
          "min_age": "30d",
          "actions": { "delete": {} }
        }
      }
    }
  }
  ```
- [ ] 测试各字段搜索效果
- [ ] 验证分页、排序、过滤功能
- [ ] 性能基准测试 (1000 条数据)

**验收标准**:
- [ ] 所有查询功能在 ES 中验证通过
- [ ] P50 延迟 <30ms (1000 条数据)
- [ ] 索引大小 <50MB

---

### Step 3: 客户端封装 (Week 2)

**目标**: 完成 `elasticsearchClient.js` 服务封装

**任务清单**:
- [ ] 实现连接管理和健康检查
- [ ] 实现 CRUD 操作封装
- [ ] 实现批量操作封装
- [ ] 实现错误处理和重试机制
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试

**验收标准**:
- [ ] 客户端可独立使用
- [ ] 错误重试机制正常工作
- [ ] TypeScript 类型完整

---

### Step 4: 索引服务开发 (Week 2-3)

**目标**: 完成 `searchIndexer.js` 数据索引服务

**任务清单**:
- [ ] 实现 Server 数据到 ES 文档的转换
- [ ] 实现全量索引任务
- [ ] 实现增量同步任务
- [ ] 实现变更监听器 (Webhooks/Polling)
- [ ] 实现索引管理 API (创建、删除、重建)
- [ ] 添加监控指标

**验收标准**:
- [ ] 全量索引 1000 条数据 <5 分钟
- [ ] 增量同步延迟 <1 秒
- [ ] 索引任务可取消、可重试

---

### Step 5: 集成与灰度 (Week 3-4)

**目标**: 将 ES 搜索集成到现有系统

**任务清单**:
- [ ] 修改 `list.js` 控制器，支持 ES 搜索
- [ ] 实现双写机制 (Prisma + ES)
- [ ] 实现查询路由 (feature flag 控制)
  ```javascript
  const SEARCH_BACKEND = process.env.SEARCH_BACKEND || 'prisma';
  
  const searchServers = async (params) => {
    if (SEARCH_BACKEND === 'elasticsearch') {
      return elasticsearchService.search(params);
    }
    return prismaSearch(params); // 回退到原有实现
  };
  ```
- [ ] 灰度发布: 5% → 20% → 50% → 100%
- [ ] 性能监控和对比

**验收标准**:
- [ ] 功能测试通过率 100%
- [ ] 性能指标达到目标
- [ ] 灰度发布无问题

---

### Step 6: 全量切换与优化 (Week 4-5)

**目标**: 完成迁移并优化

**任务清单**:
- [ ] 全量切换到 ES 搜索
- [ ] 移除 Prisma 搜索代码 (可选保留回滚路径)
- [ ] 优化查询性能
  ```javascript
  // 缓存热点查询
  const cachedResults = await redisService.get(`es:${cacheKey}`);
  if (cachedResults) return cachedResults;
  
  const results = await esService.search(params);
  await redisService.set(`es:${cacheKey}`, results, 60);
  return results;
  ```
- [ ] 添加告警监控
- [ ] 编写运维文档

**验收标准**:
- [ ] 100% 流量切换到 ES
- [ ] P99 延迟 <100ms
- [ ] 文档完整

---

## 6. 代码示例

### 6.1 ES 客户端封装

参见: `dist-server/server/services/elasticsearchClient.js`

### 6.2 搜索索引服务

参见: `dist-server/server/services/searchIndexer.js`

### 6.3 控制器集成示例

```javascript
// dist-server/server/controllers/servers/list-es.js
import { elasticsearchService } from '../../services/elasticsearchClient';
import { searchIndexer } from '../../services/searchIndexer';
import { logger } from '../../utils/logger';

const FEATURE_FLAG_ES_SEARCH = process.env.FEATURE_FLAG_ES_SEARCH === 'true';

export const listAllServersWithES = async (req, res, next) => {
  try {
    // 验证参数
    const queryValidation = paginationQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR);
    }

    const { page, limit, search, tag, platform, category, version, online, status, ...rest } = queryValidation.data;

    // 构建 ES 查询
    const esQuery = {
      from: (page - 1) * limit,
      size: limit,
      query: {
        bool: {
          must: [
            // 基础过滤
            { term: { review_status: 'APPROVED' } },
            {
              bool: {
                should: [
                  { bool: { must_not: { exists: { field: 'listing_expires_at' } } } },
                  { range: { listing_expires_at: { gt: 'now' } } }
                ]
              }
            }
          ],
          should: search ? [
            // 关键词搜索
            {
              multi_match: {
                query: search,
                fields: ['name^10', 'name_en^8', 'tags^5', 'summary^3', 'summary_en^2.5', 'ip'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ] : [],
          filter: buildFilters({ tag, platform, category, version, online, status })
        }
      },
      sort: buildSort(rest.sortBy, rest.sortOrder)
    };

    // 执行搜索
    const results = await elasticsearchService.search({
      index: 'qianfu-servers-v1',
      body: esQuery
    });

    logger.info('[ES Search] Query executed', {
      took: results.took,
      total: results.hits.total.value
    });

    return sendListResponse(res, results.hits.hits.map(h => h._source), results.hits.total.value, page, limit);
  } catch (error) {
    logger.error('[ES Search] Query failed', { error: error.message });
    next(error);
  }
};
```

---

## 7. 回滚方案

### 7.1 回滚触发条件

| 条件 | 阈值 | 动作 |
|------|------|------|
| ES 查询错误率 | >1% | 立即回滚 |
| P99 延迟 | >500ms | 观察 5min |
| 缓存命中率 | <50% | 优化后上线 |
| 数据不一致 | >0.1% | 立即回滚 |

### 7.2 回滚步骤

```bash
# Step 1: 关闭 ES 流量
export FEATURE_FLAG_ES_SEARCH=false

# Step 2: 确认 Prisma 查询恢复正常
curl http://localhost:3000/api/servers | jq '.total'

# Step 3: 检查数据一致性
node scripts/check-es-prisma-consistency.js

# Step 4: 如需完全恢复 Prisma
# 修改 list.js 移除 ES 集成代码
```

### 7.3 数据修复

如果 ES 数据损坏，需要重建索引:

```bash
# 触发全量重建
curl -X POST http://localhost:3000/api/admin/reindex?target=elasticsearch

# 监控重建进度
curl http://localhost:3000/api/admin/reindex/status
```

---

## 8. 时间线和里程碑

### 8.1 总工期估算

| 阶段 | 工期 | 累计 |
|------|------|------|
| Step 1: 环境准备 | 1 周 | Week 1 |
| Step 2: 索引创建与测试 | 1 周 | Week 2 |
| Step 3: 客户端封装 | 1 周 | Week 2 |
| Step 4: 索引服务开发 | 1 周 | Week 3 |
| Step 5: 集成与灰度 | 2 周 | Week 4 |
| Step 6: 全量切换与优化 | 1 周 | Week 5 |

**总工期: 5-6 周**

### 8.2 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1: 环境就绪 | Week 1 结束 | ES 集群运行、分词器正常 |
| M2: 功能验证 | Week 2 结束 | 索引可用、功能测试通过 |
| M3: 代码完成 | Week 3 结束 | 服务封装完成 |
| M4: 灰度上线 | Week 4 结束 | 5% 流量验证通过 |
| M5: 正式发布 | Week 5 结束 | 100% 流量、文档完整 |

### 8.3 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| ES 集群故障 | 低 | 高 | 保留 Prisma 回滚路径 |
| 数据同步延迟 | 中 | 中 | 异步队列 + 定时校验 |
| 分词效果不佳 | 中 | 中 | 人工测试集验证 |
| 性能不达标 | 低 | 高 | 预留 2 周优化时间 |

---

## 9. 附录

### 9.1 相关文档

- [API Query Search Guide](API-QUERY-SEARCH-GUIDE.md)
- [Architecture Phase 3](ARCHITECTURE-PHASE3.md)
- [Redis Eviction Policy](REDIS-EVICTION-POLICY.md)

### 9.2 参考资料

- [Elasticsearch 8.x Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/8.12/index.html)
- [IK Analysis for Elasticsearch](https://github.com/infiniflow/analysis-ik)
- [Prisma to Elasticsearch Migration Patterns](https://www.prisma.io/docs/guides/database-guides)

### 9.3 配置模板

```yaml
# docker-compose.yml for local development
version: '3.8'
services:
  elasticsearch:
    image: elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=changeme
    ports:
      - "9200:9200"
      - "9300:9300"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q 'yellow\\|green'"]
      interval: 10s
      timeout: 5s
      retries: 5

  kibana:
    image: kibana:8.12.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=kibana_system
      - ELASTICSEARCH_PASSWORD=changeme
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  es_data:
```

### 9.4 版本历史

| 版本 | 日期 | 作者 | 变更 |
|------|------|------|------|
| 1.0.0 | 2026-07-07 | 架构师 | 初始版本 |

# 优化项 403: 推荐算法 - 协同过滤

## 概述

本文档描述如何构建基于协同过滤的智能推荐系统，利用用户行为数据为用户提供个性化推荐。该系统与现有的 RFM 用户分群、流失预警系统形成完整的数据驱动运营闭环。

## 现有架构

项目已具备以下可复用基础设施:

| 模块 | 现有能力 | 复用方式 |
|------|----------|----------|
| RFM 服务 (`server/services/rfmService.ts`) | 用户价值分群、运营策略建议 | 用户分群、推荐优先级 |
| 分层缓存 (`server/services/cache.ts`) | L1 内存 + L2 Redis 双层缓存 | 用户/物品向量缓存、推荐结果缓存 |
| 流失预警 (`docs/OPTIMIZATION-312-CHURN-PREDICTION.md`) | 用户行为追踪、风险评分 | 行为数据采集、沉默用户识别 |
| 标签服务 (`server/services/tagService.ts`) | 用户/内容标签管理 | 标签特征、推荐解释性 |
| 语义搜索 (`server/services/semanticSearch.ts`) | 向量检索、相似度计算 | 物品 embedding 复用 |

## 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         协同过滤推荐系统                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐     ┌──────────────┐     ┌────────────────────┐   │
│   │  用户行为   │────▶│  数据处理    │────▶│  协同过滤          │   │
│   │  采集层    │     │  (清洗/特征) │     │  引擎              │   │
│   └─────────────┘     └──────────────┘     └─────────┬──────────┘   │
│                                                      │                │
│   ┌─────────────┐                          ┌─────────┴──────────┐   │
│   │  候选集    │                          │  排序与过滤        │   │
│   │  生成      │◀─────────────────────────│  (业务规则/多样性) │   │
│   └─────────────┘                          └─────────┬──────────┘   │
│                                                      │                │
│         ┌────────────────────────────────────────────┼────────┐    │
│         │                                            │        │    │
│         ▼                                            ▼        ▼    │
│   ┌─────────────┐                          ┌────────────┐ ┌──────┐ │
│   │  推荐结果   │                          │  实时推荐  │ │  推   │ │
│   │  缓存      │                          │  API      │ │ 送   │ │
│   └─────────────┘                          └────────────┘ └──────┘ │
│         │                                              │            │
│         ▼                                              ▼            │
│   ┌─────────────┐                          ┌────────────────────┐   │
│   │  效果追踪   │                          │  用户反馈          │   │
│   │  (点击/转化)│◀─────────────────────────│  (隐式/显式)      │   │
│   └─────────────┘                          └────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 核心算法设计

### 1. 数据模型

#### 1.1 用户-物品交互矩阵

```typescript
/**
 * 用户-物品交互类型
 */
enum InteractionType {
  VIEW = 'view',           // 浏览
  CLICK = 'click',         // 点击
  FAVORITE = 'favorite',   // 收藏
  PURCHASE = 'purchase',   // 购买
  RATING = 'rating',      // 评分
  COMMENT = 'comment',     // 评论
  SHARE = 'share',         // 分享
  SEARCH = 'search',       // 搜索 (查询词作为隐式偏好)
}

/**
 * 用户-物品交互记录
 */
interface UserItemInteraction {
  /** 交互 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 物品 ID */
  itemId: string;
  /** 交互类型 */
  type: InteractionType;
  /** 交互权重 (用于计算相似度) */
  weight: number;
  /** 交互时间 */
  timestamp: Date;
  /** 上下文 (页面来源、场景等) */
  context?: Record<string, unknown>;
}

/**
 * 交互权重配置
 */
const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  [InteractionType.VIEW]: 1,
  [InteractionType.CLICK]: 2,
  [InteractionType.SEARCH]: 1.5,
  [InteractionType.FAVORITE]: 4,
  [InteractionType.PURCHASE]: 5,
  [InteractionType.RATING]: 3,
  [InteractionType.COMMENT]: 3,
  [InteractionType.SHARE]: 4,
};
```

#### 1.2 评分矩阵构建

```typescript
/**
 * 用户评分向量
 */
interface UserRatingVector {
  userId: string;
  /** 物品 ID -> 评分 */
  ratings: Map<string, number>;
  /** 向量范数 (用于余弦相似度) */
  norm: number;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * 物品特征向量
 */
interface ItemFeatureVector {
  itemId: string;
  /** 物品 embedding (可选，用于内容相似度) */
  embedding?: number[];
  /** 协同过滤评分向量 */
  cfRatings: Map<string, number>;
  /** 向量范数 */
  norm: number;
  /** 物品基础特征 */
  features: {
    category?: string;
    tags?: string[];
    price?: number;
    popularity?: number;
  };
}

/**
 * 构建用户评分向量
 */
function buildUserRatingVector(
  userId: string,
  interactions: UserItemInteraction[]
): UserRatingVector {
  const ratings = new Map<string, number>();
  
  for (const interaction of interactions) {
    const baseWeight = INTERACTION_WEIGHTS[interaction.type] ?? 1;
    const existing = ratings.get(interaction.itemId) ?? 0;
    // 时间衰减: 越近期的交互权重越高
    const daysAgo = (Date.now() - interaction.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-daysAgo / 30); // 30天衰减周期
    ratings.set(interaction.itemId, existing + baseWeight * timeDecay);
  }
  
  // 计算向量范数
  let norm = 0;
  for (const rating of ratings.values()) {
    norm += rating * rating;
  }
  norm = Math.sqrt(norm);
  
  return {
    userId,
    ratings,
    norm,
    updatedAt: new Date(),
  };
}
```

### 2. 协同过滤算法

#### 2.1 基于用户的协同过滤 (User-Based CF)

```typescript
/**
 * 用户相似度计算
 */
enum SimilarityMetric {
  COSINE = 'cosine',         // 余弦相似度
  PEARSON = 'pearson',       // 皮尔逊相关系数
  JACCARD = 'jaccard',       // Jaccard 相似度
}

/**
 * 用户相似度
 */
interface UserSimilarity {
  /** 目标用户 */
  targetUserId: string;
  /** 相似用户 */
  similarUserId: string;
  /** 相似度分数 */
  score: number;
}

/**
 * 计算用户相似度 (余弦相似度)
 */
function calculateUserSimilarity(
  user1: UserRatingVector,
  user2: UserRatingVector,
  metric: SimilarityMetric = SimilarityMetric.COSINE
): number {
  switch (metric) {
    case SimilarityMetric.COSINE:
      return cosineSimilarity(user1, user2);
    case SimilarityMetric.PEARSON:
      return pearsonCorrelation(user1, user2);
    case SimilarityMetric.JACCARD:
      return jaccardSimilarity(user1, user2);
    default:
      return cosineSimilarity(user1, user2);
  }
}

/**
 * 余弦相似度
 */
function cosineSimilarity(user1: UserRatingVector, user2: UserRatingVector): number {
  if (user1.norm === 0 || user2.norm === 0) return 0;
  
  let dotProduct = 0;
  const smallerRatings = user1.ratings.size < user2.ratings.size 
    ? user1.ratings 
    : user2.ratings;
  
  for (const [itemId, rating1] of smallerRatings) {
    const rating2 = user1.ratings.size < user2.ratings.size
      ? user2.ratings.get(itemId) ?? 0
      : user1.ratings.get(itemId) ?? 0;
    dotProduct += rating1 * rating2;
  }
  
  return dotProduct / (user1.norm * user2.norm);
}

/**
 * 皮尔逊相关系数
 */
function pearsonCorrelation(user1: UserRatingVector, user2: UserRatingVector): number {
  // 找出共同评分的物品
  const commonItems: string[] = [];
  for (const itemId of user1.ratings.keys()) {
    if (user2.ratings.has(itemId)) {
      commonItems.push(itemId);
    }
  }
  
  if (commonItems.length < 2) return 0;
  
  // 提取评分向量
  const ratings1 = commonItems.map(id => user1.ratings.get(id)!);
  const ratings2 = commonItems.map(id => user2.ratings.get(id)!);
  
  // 计算均值
  const mean1 = ratings1.reduce((a, b) => a + b, 0) / ratings1.length;
  const mean2 = ratings2.reduce((a, b) => a + b, 0) / ratings2.length;
  
  // 计算皮尔逊系数
  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;
  
  for (let i = 0; i < commonItems.length; i++) {
    const diff1 = ratings1[i] - mean1;
    const diff2 = ratings2[i] - mean2;
    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(denom1 * denom2);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Jaccard 相似度 (适用于隐式反馈)
 */
function jaccardSimilarity(user1: UserRatingVector, user2: UserRatingVector): number {
  let intersection = 0;
  for (const itemId of user1.ratings.keys()) {
    if (user2.ratings.has(itemId)) {
      intersection++;
    }
  }
  
  const union = user1.ratings.size + user2.ratings.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 基于用户的协同过滤预测
 * 
 * @param targetUserId 目标用户 ID
 * @param itemId 目标物品 ID
 * @param similarUsers 相似用户列表
 * @returns 预测评分
 */
function predictUserBasedCF(
  targetUserId: string,
  itemId: string,
  similarUsers: UserSimilarity[]
): number {
  // 筛选对该物品有评分的相似用户
  const relevantUsers = similarUsers.filter(
    su => userItemMatrix.has(su.similarUserId, itemId)
  );
  
  if (relevantUsers.length === 0) return 0;
  
  // 加权平均
  let numerator = 0;
  let denominator = 0;
  
  for (const similarUser of relevantUsers) {
    const rating = userItemMatrix.get(similarUser.similarUserId, itemId);
    numerator += similarUser.score * rating;
    denominator += Math.abs(similarUser.score);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}
```

#### 2.2 基于物品的协同过滤 (Item-Based CF)

```typescript
/**
 * 物品相似度
 */
interface ItemSimilarity {
  /** 目标物品 */
  targetItemId: string;
  /** 相似物品 */
  similarItemId: string;
  /** 相似度分数 */
  score: number;
}

/**
 * 计算物品相似度 (基于用户评分模式)
 */
function calculateItemSimilarity(
  item1Id: string,
  item2Id: string,
  metric: SimilarityMetric = SimilarityMetric.COSINE
): number {
  // 获取对这两个物品都有评分的用户
  const item1Ratings = itemRatingMap.get(item1Id) ?? new Map();
  const item2Ratings = itemRatingMap.get(item2Id) ?? new Map();
  
  const commonUsers: string[] = [];
  for (const userId of item1Ratings.keys()) {
    if (item2Ratings.has(userId)) {
      commonUsers.push(userId);
    }
  }
  
  if (commonUsers.length < 2) return 0;
  
  // 构建临时评分向量
  const ratings1 = commonUsers.map(userId => item1Ratings.get(userId)!);
  const ratings2 = commonUsers.map(userId => item2Ratings.get(userId)!);
  
  // 计算相似度
  switch (metric) {
    case SimilarityMetric.COSINE:
      return vectorCosineSimilarity(ratings1, ratings2);
    case SimilarityMetric.PEARSON:
      return vectorPearsonCorrelation(ratings1, ratings2);
    default:
      return vectorCosineSimilarity(ratings1, ratings2);
  }
}

/**
 * 向量余弦相似度
 */
function vectorCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length || vec1.length === 0) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 基于物品的协同过滤预测
 */
function predictItemBasedCF(
  userId: string,
  targetItemId: string,
  userRatings: Map<string, number>, // 用户已评分物品
  itemSimilarities: Map<string, ItemSimilarity[]> // 物品相似度缓存
): number {
  const similarities = itemSimilarities.get(targetItemId) ?? [];
  
  // 筛选用户有评分的相似物品
  const relevantItems = similarities.filter(
    sim => userRatings.has(sim.similarItemId)
  );
  
  if (relevantItems.length === 0) return 0;
  
  let numerator = 0;
  let denominator = 0;
  
  for (const itemSim of relevantItems) {
    const rating = userRatings.get(itemSim.similarItemId)!;
    numerator += itemSim.score * rating;
    denominator += Math.abs(itemSim.score);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}
```

#### 2.3 矩阵分解 (SVD)

```typescript
/**
 * SVD 矩阵分解推荐
 * 
 * 将用户-物品评分矩阵分解为:
 * R ≈ U × Σ × V^T
 * 
 * 其中:
 * - U: 用户隐因子矩阵
 * - Σ: 奇异值对角矩阵
 * - V^T: 物品隐因子矩阵
 */

interface SVDModel {
  /** 用户隐因子 */
  userFactors: Map<string, number[]>;
  /** 物品隐因子 */
  itemFactors: Map<string, number[]>;
  /** 偏置项 */
  biases: {
    global: number;
    userBiases: Map<string, number>;
    itemBiases: Map<string, number>;
  };
  /** 隐因子维度 */
  latentFactors: number;
  /** 训练轮数 */
  epochs: number;
  /** 学习率 */
  learningRate: number;
  /** 正则化系数 */
  regularization: number;
}

/**
 * SVD 预测
 */
function predictSVD(
  model: SVDModel,
  userId: string,
  itemId: string
): number {
  const globalBias = model.biases.global;
  const userBias = model.biases.userBiases.get(userId) ?? 0;
  const itemBias = model.biases.itemBiases.get(itemId) ?? 0;
  
  const userFactor = model.userFactors.get(userId);
  const itemFactor = model.itemFactors.get(itemId);
  
  // 如果用户或物品不在模型中，返回基础预测
  if (!userFactor || !itemFactor) {
    return globalBias + userBias + itemBias;
  }
  
  // 计算预测评分
  let interaction = 0;
  for (let i = 0; i < model.latentFactors; i++) {
    interaction += userFactor[i] * itemFactor[i];
  }
  
  return globalBias + userBias + itemBias + interaction;
}

/**
 * 使用梯度下降训练 SVD 模型
 */
async function trainSVD(
  trainingData: { userId: string; itemId: string; rating: number }[],
  options: {
    latentFactors?: number;
    epochs?: number;
    learningRate?: number;
    regularization?: number;
  } = {}
): Promise<SVDModel> {
  const {
    latentFactors = 50,
    epochs = 20,
    learningRate = 0.005,
    regularization = 0.02,
  } = options;
  
  // 初始化
  const model: SVDModel = {
    userFactors: new Map(),
    itemFactors: new Map(),
    biases: {
      global: 0,
      userBiases: new Map(),
      itemBiases: new Map(),
    },
    latentFactors,
    epochs,
    learningRate,
    regularization,
  };
  
  // 计算全局平均评分
  const totalRating = trainingData.reduce((sum, d) => sum + d.rating, 0);
  model.biases.global = totalRating / trainingData.length;
  
  // 获取所有用户和物品
  const users = new Set(trainingData.map(d => d.userId));
  const items = new Set(trainingData.map(d => d.itemId));
  
  // 初始化隐因子 (小随机值)
  for (const userId of users) {
    model.userFactors.set(userId, generateRandomVector(latentFactors));
    model.biases.userBiases.set(userId, 0);
  }
  for (const itemId of items) {
    model.itemFactors.set(itemId, generateRandomVector(latentFactors));
    model.biases.itemBiases.set(itemId, 0);
  }
  
  // SGD 训练
  for (let epoch = 0; epoch < epochs; epoch++) {
    // 打乱数据顺序
    const shuffled = [...trainingData].sort(() => Math.random() - 0.5);
    
    for (const { userId, itemId, rating } of shuffled) {
      const prediction = predictSVD(model, userId, itemId);
      const error = rating - prediction;
      
      // 更新偏置
      const userBias = model.biases.userBiases.get(userId)!;
      const itemBias = model.biases.itemBiases.get(itemId)!;
      
      model.biases.userBiases.set(
        userId,
        userBias + learningRate * (error - regularization * userBias)
      );
      model.biases.itemBiases.set(
        itemId,
        itemBias + learningRate * (error - regularization * itemBias)
      );
      
      // 更新隐因子
      const userFactor = model.userFactors.get(userId)!;
      const itemFactor = model.itemFactors.get(itemId)!;
      
      for (let i = 0; i < latentFactors; i++) {
        const ui = userFactor[i];
        const vi = itemFactor[i];
        
        userFactor[i] = ui + learningRate * (error * vi - regularization * ui);
        itemFactor[i] = vi + learningRate * (error * ui - regularization * vi);
      }
    }
    
    // 计算训练误差
    if (epoch % 5 === 0) {
      const rmse = calculateRMSE(trainingData, model);
      logger.info(`[SVD] Epoch ${epoch}, RMSE: ${rmse.toFixed(4)}`);
    }
  }
  
  return model;
}

function generateRandomVector(dimension: number): number[] {
  return Array.from({ length: dimension }, () => (Math.random() - 0.5) * 0.1);
}

function calculateRMSE(
  data: { userId: string; itemId: string; rating: number }[],
  model: SVDModel
): number {
  let sumError = 0;
  for (const { userId, itemId, rating } of data) {
    const prediction = predictSVD(model, userId, itemId);
    sumError += Math.pow(rating - prediction, 2);
  }
  return Math.sqrt(sumError / data.length);
}
```

### 3. 混合推荐策略

```typescript
/**
 * 混合推荐引擎
 */
class HybridRecommender {
  private userBasedCF: UserBasedCFRecommender;
  private itemBasedCF: ItemBasedCFRecommender;
  private svdModel: SVDModel | null = null;
  private cache: LayeredCache;
  
  constructor(cache: LayeredCache) {
    this.cache = cache;
    this.userBasedCF = new UserBasedCFRecommender();
    this.itemBasedCF = new ItemBasedCFRecommender();
  }
  
  /**
   * 混合预测
   * 
   * @param userId 用户 ID
   * @param itemId 物品 ID
   * @param weights 各算法权重
   */
  async predict(
    userId: string,
    itemId: string,
    weights: {
      userBased: number;
      itemBased: number;
      svd: number;
    } = { userBased: 0.3, itemBased: 0.3, svd: 0.4 }
  ): Promise<number> {
    const predictions: number[] = [];
    const totalWeight = weights.userBased + weights.itemBased + weights.svd;
    
    // User-Based CF 预测
    if (weights.userBased > 0) {
      const userPred = await this.userBasedCF.predict(userId, itemId);
      predictions.push(userPred * weights.userBased);
    }
    
    // Item-Based CF 预测
    if (weights.itemBased > 0) {
      const itemPred = await this.itemBasedCF.predict(userId, itemId);
      predictions.push(itemPred * weights.itemBased);
    }
    
    // SVD 预测
    if (weights.svd > 0 && this.svdModel) {
      const svdPred = predictSVD(this.svdModel, userId, itemId);
      predictions.push(svdPred * weights.svd);
    }
    
    return predictions.reduce((a, b) => a + b, 0) / totalWeight;
  }
  
  /**
   * 生成推荐列表
   */
  async recommend(
    userId: string,
    options: {
      count?: number;              // 推荐数量
      categories?: string[];       // 过滤分类
      excludeItems?: string[];      // 排除物品
      includeRecent?: boolean;     // 是否包含最近交互物品
      hybrid?: boolean;            // 是否使用混合推荐
      algorithm?: 'user' | 'item' | 'svd' | 'hybrid';
    } = {}
  ): Promise<RecommendedItem[]> {
    const {
      count = 10,
      categories,
      excludeItems = [],
      includeRecent = false,
      hybrid = true,
      algorithm = 'hybrid',
    } = options;
    
    // 获取候选物品
    let candidates = await this.getCandidateItems(userId);
    
    // 排除已排除的物品
    candidates = candidates.filter(item => !excludeItems.includes(item.itemId));
    
    // 分类过滤
    if (categories && categories.length > 0) {
      candidates = candidates.filter(item => 
        item.category && categories.includes(item.category)
      );
    }
    
    // 计算预测评分
    const scoredItems: { itemId: string; score: number; category?: string }[] = [];
    
    for (const item of candidates) {
      let score: number;
      
      if (hybrid) {
        score = await this.predict(userId, item.itemId);
      } else {
        switch (algorithm) {
          case 'user':
            score = await this.userBasedCF.predict(userId, item.itemId);
            break;
          case 'item':
            score = await this.itemBasedCF.predict(userId, item.itemId);
            break;
          case 'svd':
            score = this.svdModel 
              ? predictSVD(this.svdModel, userId, item.itemId)
              : 0;
            break;
          default:
            score = await this.predict(userId, item.itemId);
        }
      }
      
      scoredItems.push({
        itemId: item.itemId,
        score,
        category: item.category,
      });
    }
    
    // 排序并返回 Top N
    scoredItems.sort((a, b) => b.score - a.score);
    
    return scoredItems.slice(0, count).map((item, index) => ({
      itemId: item.itemId,
      score: item.score,
      rank: index + 1,
      category: item.category,
      reason: this.generateRecommendationReason(userId, item.itemId),
    }));
  }
  
  /**
   * 生成推荐原因
   */
  private generateRecommendationReason(userId: string, itemId: string): string {
    // 基于协同过滤生成可解释性原因
    const similarUsers = this.userBasedCF.getSimilarUsers(userId);
    const reasonTypes = [];
    
    if (similarUsers.length > 0) {
      reasonTypes.push('与您相似用户也在看');
    }
    
    // 可以扩展更多解释性逻辑
    
    return reasonTypes[0] ?? '为您推荐';
  }
  
  /**
   * 获取候选物品
   */
  private async getCandidateItems(userId: string): Promise<CandidateItem[]> {
    // 从缓存获取或从数据库查询
    const cacheKey = `candidates:${userId}`;
    const cached = await this.cache.get<CandidateItem[]>(cacheKey);
    if (cached) return cached;
    
    // TODO: 从数据库获取候选物品 (热门物品、新物品、用户可能感兴趣的分类)
    const candidates: CandidateItem[] = [];
    
    // 写入缓存
    await this.cache.set(cacheKey, candidates);
    
    return candidates;
  }
}

interface CandidateItem {
  itemId: string;
  category?: string;
}

interface RecommendedItem {
  itemId: string;
  score: number;
  rank: number;
  category?: string;
  reason: string;
}
```

## 核心服务实现

### 1. 推荐服务主类

```typescript
/**
 * 协同过滤推荐服务
 */
export class CollaborativeFilteringService {
  private cache: LayeredCache;
  private hybridRecommender: HybridRecommender;
  private userSimilarityCache: Map<string, UserSimilarity[]>;
  private itemSimilarityCache: Map<string, ItemSimilarity[]>;
  
  constructor(cache: LayeredCache) {
    this.cache = cache;
    this.hybridRecommender = new HybridRecommender(cache);
    this.userSimilarityCache = new Map();
    this.itemSimilarityCache = new Map();
  }
  
  /**
   * 为用户生成个性化推荐
   */
  async recommendForUser(
    userId: string,
    options: RecommendOptions = {}
  ): Promise<RecommendationResult> {
    // 检查用户是否存在
    const userExists = await this.checkUserExists(userId);
    if (!userExists) {
      return this.getPopularRecommendations(options.count ?? 10);
    }
    
    // 获取推荐结果
    const recommendations = await this.hybridRecommender.recommend(userId, {
      count: options.count ?? 10,
      categories: options.categories,
      excludeItems: options.excludeItems ?? [],
      hybrid: options.hybrid ?? true,
    });
    
    // 记录推荐日志
    await this.logRecommendation(userId, recommendations);
    
    return {
      userId,
      recommendations,
      generatedAt: new Date(),
      algorithm: 'hybrid',
    };
  }
  
  /**
   * 相似物品推荐
   */
  async getSimilarItems(
    itemId: string,
    options: { count?: number; categories?: string[] } = {}
  ): Promise<SimilarItemResult> {
    const { count = 10, categories } = options;
    
    // 从缓存获取
    const cacheKey = `similar:${itemId}:${count}`;
    const cached = await this.cache.get<SimilarItemResult>(cacheKey);
    if (cached) return cached;
    
    // 计算物品相似度
    const similarities = await this.calculateItemSimilarities(itemId);
    
    // 过滤分类
    let filtered = similarities;
    if (categories && categories.length > 0) {
      filtered = similarities.filter(
        s => {
          const itemCategory = this.getItemCategory(s.itemId);
          return itemCategory && categories.includes(itemCategory);
        }
      );
    }
    
    const result: SimilarItemResult = {
      itemId,
      similarItems: filtered.slice(0, count).map((s, i) => ({
        itemId: s.itemId,
        similarity: s.score,
        rank: i + 1,
      })),
      generatedAt: new Date(),
    };
    
    // 缓存结果
    await this.cache.set(cacheKey, result, 3600000); // 1小时
    
    return result;
  }
  
  /**
   * 热门推荐 (冷启动解决方案)
   */
  async getPopularRecommendations(count: number = 10): Promise<RecommendationResult> {
    const cacheKey = `popular:${count}`;
    const cached = await this.cache.get<RecommendationResult>(cacheKey);
    if (cached) return cached;
    
    // 从数据库获取热门物品
    const popularItems = await this.getPopularItemsFromDB(count);
    
    const result: RecommendationResult = {
      userId: 'anonymous',
      recommendations: popularItems.map((item, i) => ({
        itemId: item.id,
        score: item.popularityScore,
        rank: i + 1,
        category: item.category,
        reason: '热门推荐',
      })),
      generatedAt: new Date(),
      algorithm: 'popularity',
    };
    
    await this.cache.set(cacheKey, result, 1800000); // 30分钟
    
    return result;
  }
  
  /**
   * 重新训练模型
   */
  async retrainModel(): Promise<void> {
    logger.info('[CF] Starting model retraining...');
    
    // 获取所有交互数据
    const interactions = await this.getAllInteractions();
    
    // 转换为训练数据格式
    const trainingData = interactions.map(i => ({
      userId: i.userId,
      itemId: i.itemId,
      rating: i.weight,
    }));
    
    // 训练 SVD 模型
    this.hybridRecommender.svdModel = await trainSVD(trainingData, {
      latentFactors: 50,
      epochs: 20,
    });
    
    // 清除相似度缓存
    this.userSimilarityCache.clear();
    this.itemSimilarityCache.clear();
    
    logger.info('[CF] Model retraining completed');
  }
  
  /**
   * 增量更新 (在线学习)
   */
  async updateWithNewInteraction(interaction: UserItemInteraction): Promise<void> {
    // 更新用户评分向量
    await this.updateUserRatingVector(interaction);
    
    // 更新物品评分向量
    await this.updateItemRatingVector(interaction);
    
    // 触发异步模型更新 (轻量级)
    this.triggerIncrementalUpdate(interaction);
  }
  
  // ============== 私有方法 ==============
  
  private async calculateItemSimilarities(itemId: string): Promise<ItemSimilarity[]> {
    // 使用缓存或计算
    const cached = this.itemSimilarityCache.get(itemId);
    if (cached) return cached;
    
    // TODO: 计算物品相似度
    const similarities: ItemSimilarity[] = [];
    
    this.itemSimilarityCache.set(itemId, similarities);
    return similarities;
  }
  
  private getItemCategory(itemId: string): string | undefined {
    // TODO: 从物品元数据获取
    return undefined;
  }
  
  private async getPopularItemsFromDB(count: number): Promise<{ id: string; popularityScore: number; category?: string }[]> {
    // TODO: 从数据库查询热门物品
    return [];
  }
  
  private async checkUserExists(userId: string): Promise<boolean> {
    // TODO: 检查用户是否存在
    return true;
  }
  
  private async getAllInteractions(): Promise<UserItemInteraction[]> {
    // TODO: 从数据库获取所有交互
    return [];
  }
  
  private async logRecommendation(
    userId: string,
    recommendations: RecommendedItem[]
  ): Promise<void> {
    // 记录推荐日志用于后续分析
    logger.info('[CF] Generated recommendations', { userId, count: recommendations.length });
  }
  
  private async updateUserRatingVector(interaction: UserItemInteraction): Promise<void> {
    // TODO: 更新用户评分向量
  }
  
  private async updateItemRatingVector(interaction: UserItemInteraction): Promise<void> {
    // TODO: 更新物品评分向量
  }
  
  private triggerIncrementalUpdate(interaction: UserItemInteraction): void {
    // 异步轻量级更新
    setTimeout(async () => {
      try {
        // 轻量级更新逻辑
        logger.info('[CF] Incremental update triggered', { 
          userId: interaction.userId,
          itemId: interaction.itemId 
        });
      } catch (error) {
        logger.error('[CF] Incremental update failed', { error });
      }
    }, 0);
  }
}

// ============== 类型定义 ==============

interface RecommendOptions {
  count?: number;
  categories?: string[];
  excludeItems?: string[];
  hybrid?: boolean;
}

interface RecommendationResult {
  userId: string;
  recommendations: RecommendedItem[];
  generatedAt: Date;
  algorithm: string;
}

interface SimilarItemResult {
  itemId: string;
  similarItems: {
    itemId: string;
    similarity: number;
    rank: number;
  }[];
  generatedAt: Date;
}

// ============== 服务导出 ==============

let cfServiceInstance: CollaborativeFilteringService | null = null;

export function initCollaborativeFilteringService(
  cache?: LayeredCache
): CollaborativeFilteringService {
  cfServiceInstance = new CollaborativeFilteringService(
    cache ?? new LayeredCache({ prefix: 'cf:' })
  );
  logger.info('[CF] Collaborative filtering service initialized');
  return cfServiceInstance;
}

export function getCollaborativeFilteringService(): CollaborativeFilteringService {
  if (!cfServiceInstance) {
    return initCollaborativeFilteringService();
  }
  return cfServiceInstance;
}

export type {
  UserItemInteraction,
  InteractionType,
  UserRatingVector,
  ItemFeatureVector,
  UserSimilarity,
  ItemSimilarity,
  RecommendOptions,
  RecommendationResult,
  SimilarItemResult,
  RecommendedItem,
  SVDModel,
};
```

### 2. API 设计

```typescript
// 路由前缀: /api/recommend

/**
 * 个性化推荐
 * GET /api/recommend?userId=xxx&count=10&categories=tech,food
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId, count = '10', categories, excludeItems, hybrid } = req.query;
  
  const result = await cfService.recommendForUser(String(userId), {
    count: parseInt(String(count), 10),
    categories: categories ? String(categories).split(',') : undefined,
    excludeItems: excludeItems ? String(excludeItems).split(',') : undefined,
    hybrid: hybrid !== 'false',
  });
  
  res.json(result);
}));

/**
 * 相似物品推荐
 * GET /api/recommend/similar?itemId=xxx&count=10
 */
router.get('/similar', asyncHandler(async (req: Request, res: Response) => {
  const { itemId, count = '10', categories } = req.query;
  
  const result = await cfService.getSimilarItems(String(itemId), {
    count: parseInt(String(count), 10),
    categories: categories ? String(categories).split(',') : undefined,
  });
  
  res.json(result);
}));

/**
 * 热门推荐
 * GET /api/recommend/popular?count=10
 */
router.get('/popular', asyncHandler(async (req: Request, res: Response) => {
  const { count = '10' } = req.query;
  
  const result = await cfService.getPopularRecommendations(parseInt(String(count), 10));
  res.json(result);
}));

/**
 * 记录用户反馈
 * POST /api/recommend/feedback
 */
router.post('/feedback', asyncHandler(async (req: Request, res: Response) => {
  const { userId, itemId, feedbackType, timestamp } = req.body;
  
  // 反馈类型: click, favorite, purchase, skip, hide
  await cfService.recordFeedback({
    userId,
    itemId,
    feedbackType,
    timestamp: new Date(timestamp),
  });
  
  res.json({ success: true });
}));

/**
 * 触发模型重训练 (管理员)
 * POST /api/recommend/retrain
 */
router.post('/retrain', adminMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await cfService.retrainModel();
  res.json({ success: true, message: 'Model retraining started' });
}));

/**
 * 获取推荐统计 (管理员)
 * GET /api/recommend/stats
 */
router.get('/stats', adminMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const stats = await cfService.getStatistics();
  res.json(stats);
}));
```

## 数据库设计

### Prisma Schema

```prisma
// 用户-物品交互记录
model UserItemInteraction {
  id          String   @id @default(cuid())
  userId      String
  itemId      String
  type        String   // view, click, favorite, purchase, rating, comment, share
  weight      Float    @default(1.0)
  timestamp   DateTime @default(now())
  sessionId   String?
  context     Json?    // 上下文信息
  
  @@unique([userId, itemId, type, timestamp])
  @@index([userId, timestamp])
  @@index([itemId, timestamp])
  @@index([type, timestamp])
}

// 物品评分矩阵 (预计算)
model ItemRatingMatrix {
  id          String   @id @default(cuid())
  itemId      String
  userId      String
  rating      Float
  updatedAt   DateTime @updatedAt
  
  @@unique([itemId, userId])
  @@index([itemId])
  @@index([userId])
}

// 推荐结果记录
model RecommendationLog {
  id              String   @id @default(cuid())
  userId          String
  itemId          String
  score           Float
  rank            Int
  algorithm       String   // user, item, svd, hybrid
  feedbackType    String?  // click, favorite, purchase, skip
  feedbackTime    DateTime?
  generatedAt     DateTime @default(now())
  
  @@index([userId, generatedAt])
  @@index([itemId, generatedAt])
}

// 用户反馈记录
model RecommendationFeedback {
  id            String   @id @default(cuid())
  userId        String
  itemId        String
  feedbackType  String   // click, favorite, purchase, skip, hide, not_interested
  timestamp     DateTime @default(now())
  
  @@index([userId, timestamp])
  @@index([feedbackType, timestamp])
}

// SVD 模型参数 (可序列化存储)
model RecommendationModel {
  id            String   @id @default(cuid())
  name          String   @unique
  version       String
  latentFactors Int      @default(50)
  trainingData  Json?    // 模型参数
  trainedAt     DateTime @default(now())
  metrics       Json?    // 训练指标
  
  @@index([name, version])
}
```

## 环境配置

```bash
# ============== 协同过滤推荐配置 ==============

# 功能开关
RECOMMEND_ENABLED=true

# 算法配置
RECOMMEND_ALGORITHM=hybrid  # user, item, svd, hybrid
RECOMMEND_USER_BASED_WEIGHT=0.3
RECOMMEND_ITEM_BASED_WEIGHT=0.3
RECOMMEND_SVD_WEIGHT=0.4

# SVD 模型配置
RECOMMEND_SVD_LATENT_FACTORS=50
RECOMMEND_SVD_EPOCHS=20
RECOMMEND_SVD_LEARNING_RATE=0.005
RECOMMEND_SVD_REGULARIZATION=0.02

# 相似度配置
RECOMMEND_SIMILARITY_METRIC=cosine  # cosine, pearson, jaccard
RECOMMEND_SIMILAR_USERS_TOP_K=50
RECOMMEND_SIMILAR_ITEMS_TOP_K=50
RECOMMEND_SIMILARITY_THRESHOLD=0.1

# 缓存配置
RECOMMEND_CACHE_TTL=3600000         # 1小时
RECOMMEND_POPULAR_CACHE_TTL=1800000 # 30分钟

# 冷启动配置
RECOMMEND_COLD_START_STRATEGY=popular  # popular, content, hybrid

# 训练配置
RECOMMEND_AUTO_RETRAIN=true
RECOMMEND_RETRAIN_INTERVAL_HOURS=24

# 实时配置
RECOMMEND_INCREMENTAL_UPDATE=true
RECOMMEND_MIN_INTERACTIONS_FOR_CF=5
```

## 效果评估指标

| 指标 | 描述 | 计算方式 |
|------|------|----------|
| 准确率 (Precision@K) | Top-K 推荐中用户实际喜欢的比例 | 推荐命中数 / K |
| 召回率 (Recall@K) | 用户喜欢的物品中被推荐的比例 | 推荐命中数 / 用户喜欢总数 |
| F1 分数 | 准确率与召回率的调和平均 | 2 × Precision × Recall / (Precision + Recall) |
| NDCG | 归一化折损累计增益 | 考虑排序位置的推荐质量 |
| 覆盖率 | 推荐系统覆盖的物品比例 | 被推荐的物品数 / 总物品数 |
| 多样性 | 推荐列表中物品多样性 | 物品相似度/分类分布 |
| 新颖性 | 推荐中用户未见过物品的比例 | 新物品数 / K |
| 点击率 (CTR) | 推荐点击率 | 点击数 / 展示数 |
| 转化率 (CVR) | 推荐转化率 | 购买数 / 点击数 |

## 与现有系统集成

| 系统 | 集成方式 | 复用内容 |
|------|----------|----------|
| RFM 服务 | 数据输入 | 用户分群、价值分层 |
| 流失预警 | 触发器 | 沉默用户触发再推荐 |
| 标签服务 | 特征补充 | 物品分类、标签 |
| 缓存服务 | 依赖 | 用户/物品向量缓存 |
| 客服系统 | 触达 | 推荐结果推送 |

## 实现计划

### Phase 1: 基础能力 (2 周)

1. 数据采集与预处理
2. 用户/物品评分向量构建
3. 基础 User-Based CF 实现
4. Item-Based CF 实现
5. 热门推荐 (冷启动)

### Phase 2: 算法优化 (2 周)

1. SVD 矩阵分解实现
2. 混合推荐策略
3. 在线学习/增量更新
4. 相似度计算优化

### Phase 3: 工程化 (1 周)

1. 模型自动重训练
2. 推荐 API 完善
3. 效果追踪与报表
4. A/B 测试框架

## 注意事项

1. **冷启动问题**: 新用户/新物品使用热门推荐 + 内容特征补充
2. **稀疏性**: 大规模数据使用矩阵分解而非全量相似度计算
3. **实时性**: 增量更新与全量训练结合
4. **可解释性**: 提供推荐原因提升用户信任
5. **隐私合规**: 行为数据采集需符合 GDPR/个人信息保护法要求

---

文档版本: v1.0  
创建时间: 2026-07-06  
维护者: 团队

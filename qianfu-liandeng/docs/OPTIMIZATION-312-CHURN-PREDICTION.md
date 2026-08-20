# 优化项 312: 用户召回 - 流失预警系统

## 概述

本文档描述如何利用项目现有的基础设施，构建智能用户流失预警与召回系统。系统将追踪用户行为、预测流失风险、触发预警通知、实施召回策略，形成完整的用户生命周期管理闭环。

## 现有架构

项目已具备以下可复用基础设施:

| 模块 | 现有能力 | 复用方式 |
|------|----------|----------|
| 分层缓存 (`server/services/cache.ts`) | L1 内存 + L2 Redis 双层缓存 | 存储用户行为特征、预测结果 |
| 智能客服 (`server/services/customerService.ts`) | 多轮会话、RAG 问答、意图识别 | 召回触达、流失挽留对话 |
| RAG 服务 (`server/services/rag/`) | 知识库检索、LLM 生成 | 个性化召回内容生成 |
| 配置管理 (`server/config/env.ts`) | 环境变量统一管理 | 预警阈值、召回策略配置 |
| 监控告警 (`deploy/monitoring/`) | Prometheus + Grafana | 预警通知、系统指标 |

## 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         用户流失预警与召回系统                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐     ┌──────────────┐     ┌────────────────────┐   │
│   │  用户行为   │────▶│  特征工程    │────▶│  流失预测模型      │   │
│   │  数据采集   │     │  (特征提取)  │     │  (风险评分)        │   │
│   └─────────────┘     └──────────────┘     └─────────┬──────────┘   │
│         │                                          │                │
│         ▼                                          ▼                │
│   ┌─────────────┐                          ┌────────────────────┐   │
│   │  行为事件   │                          │  风险分级          │   │
│   │  存储       │                          │  高/中/低风险      │   │
│   └─────────────┘                          └─────────┬──────────┘   │
│                                                      │                │
│         ┌────────────────────────────────────────────┼────────┐    │
│         │                                            │        │    │
│         ▼                                            ▼        ▼    │
│   ┌─────────────┐                          ┌────────────┐ ┌──────┐ │
│   │  召回策略   │                          │  预警通知  │ │ 客服  │ │
│   │  引擎       │                          │  推送      │ │ 介入  │ │
│   └─────────────┘                          └────────────┘ └──────┘ │
│         │                                              │            │
│         ▼                                              ▼            │
│   ┌─────────────┐                          ┌────────────────────┐   │
│   │  召回渠道   │                          │  召回效果          │   │
│   │  推送       │                          │  追踪分析          │   │
│   └─────────────┘                          └────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 功能模块设计

### 1. 用户行为追踪

#### 1.1 行为事件类型

```typescript
// 用户行为事件枚举
enum UserEventType {
  // 核心行为
  LOGIN = 'login',                    // 登录
  LOGOUT = 'logout',                  // 登出
  PAGE_VIEW = 'page_view',            // 页面浏览
  SEARCH = 'search',                  // 搜索
  FAVORITE = 'favorite',              // 收藏
  UNFAVORITE = 'unfavorite',          // 取消收藏
  
  // 内容互动
  CONTENT_CREATE = 'content_create',  // 创建内容
  CONTENT_UPDATE = 'content_update',  // 更新内容
  CONTENT_DELETE = 'content_delete',  // 删除内容
  COMMENT = 'comment',                // 评论
  
  // 参与度
  SESSION_START = 'session_start',    // 会话开始
  SESSION_END = 'session_end',        // 会话结束
  DURATION = 'duration',              // 使用时长
}
```

#### 1.2 行为事件结构

```typescript
interface UserBehaviorEvent {
  /** 事件 ID */
  eventId: string;
  /** 用户 ID */
  userId: string;
  /** 事件类型 */
  eventType: UserEventType;
  /** 事件时间 */
  timestamp: Date;
  /** 会话 ID */
  sessionId?: string;
  /** 页面路径 */
  page?: string;
  /** 停留时长 (毫秒) */
  duration?: number;
  /** 关联资源 ID */
  resourceId?: string;
  /** 关联资源类型 */
  resourceType?: string;
  /** 扩展属性 */
  metadata?: Record<string, unknown>;
}
```

### 2. 流失预警模型

#### 2.1 风险评估维度

| 维度 | 权重 | 指标说明 |
|------|------|----------|
| 活跃度下降 | 30% | 与过去7天相比，活跃天数下降比例 |
| 登录间隔 | 25% | 距离上次登录的天数 |
| 参与度下降 | 20% | 收藏、搜索、互动频率变化 |
| 内容流失 | 15% | 创建/更新内容的频率变化 |
| 会话质量 | 10% | 平均会话时长、页面深度变化 |

#### 2.2 风险评分计算

```typescript
interface ChurnRiskScore {
  /** 用户 ID */
  userId: string;
  /** 综合风险评分 (0-100) */
  totalScore: number;
  /** 风险等级 */
  riskLevel: 'high' | 'medium' | 'low';
  /** 各维度得分 */
  dimensionScores: {
    activityDecline: number;
    loginInterval: number;
    engagementDecline: number;
    contentLoss: number;
    sessionQuality: number;
  };
  /** 预测时间戳 */
  predictedAt: Date;
  /** 建议采取的行动 */
  recommendedActions: string[];
}

/**
 * 计算用户流失风险评分
 * 
 * @param userId 用户 ID
 * @param events 用户最近 N 天的行为事件
 * @returns 风险评分结果
 */
async function calculateChurnRisk(
  userId: string,
  events: UserBehaviorEvent[]
): Promise<ChurnRiskScore> {
  // 计算各维度得分
  const activityScore = calculateActivityScore(events);
  const intervalScore = calculateLoginIntervalScore(events);
  const engagementScore = calculateEngagementScore(events);
  const contentScore = calculateContentScore(events);
  const sessionScore = calculateSessionQualityScore(events);
  
  // 加权计算总分
  const totalScore = Math.round(
    activityScore * 0.30 +
    intervalScore * 0.25 +
    engagementScore * 0.20 +
    contentScore * 0.15 +
    sessionScore * 0.10
  );
  
  // 确定风险等级
  const riskLevel = totalScore >= 70 ? 'high' 
    : totalScore >= 40 ? 'medium' 
    : 'low';
  
  return {
    userId,
    totalScore,
    riskLevel,
    dimensionScores: {
      activityDecline: activityScore,
      loginInterval: intervalScore,
      engagementDecline: engagementScore,
      contentLoss: contentScore,
      sessionQuality: sessionScore,
    },
    predictedAt: new Date(),
    recommendedActions: generateRecommendedActions(riskLevel),
  };
}
```

#### 2.3 预警阈值配置

```typescript
interface ChurnWarningConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 高风险阈值 (>=此值触发高风险预警) */
  highRiskThreshold: number;
  /** 中风险阈值 (>=此值触发中风险预警) */
  mediumRiskThreshold: number;
  /** 预警检查间隔 (小时) */
  checkIntervalHours: number;
  /** 观察期天数 (分析最近 N 天行为) */
  observationDays: number;
  /** 基础活跃天数阈值 */
  baseActiveDaysThreshold: number;
}

const DEFAULT_CHURN_CONFIG: ChurnWarningConfig = {
  enabled: env.CURN_WARNING_ENABLED ?? true,
  highRiskThreshold: 70,
  mediumRiskThreshold: 40,
  checkIntervalHours: 6,
  observationDays: 14,
  baseActiveDaysThreshold: 3,
};
```

### 3. 召回策略引擎

#### 3.1 召回策略类型

```typescript
// 召回策略类型
enum RecallStrategyType {
  PUSH_NOTIFICATION = 'push_notification',   // 推送通知
  EMAIL = 'email',                          // 邮件召回
  SMS = 'sms',                              // 短信召回
  IN_APP_MESSAGE = 'in_app_message',       // 应用内消息
  CUSTOMER_SERVICE = 'customer_service',    // 客服介入
  INCENTIVE = 'incentive',                  // 激励召回 (优惠券等)
}

// 召回策略配置
interface RecallStrategy {
  /** 策略 ID */
  id: string;
  /** 策略名称 */
  name: string;
  /** 适用风险等级 */
  applicableRiskLevels: ('high' | 'medium' | 'low')[];
  /** 触发延迟 (小时) */
  triggerDelayHours: number;
  /** 最大执行次数 */
  maxAttempts: number;
  /** 执行间隔 (小时) */
  attemptIntervalHours: number;
  /** 策略类型 */
  type: RecallStrategyType;
  /** 策略配置 */
  config: Record<string, unknown>;
}

// 预设召回策略
const DEFAULT_RECALL_STRATEGIES: RecallStrategy[] = [
  {
    id: 'strategy_high_incentive',
    name: '高风险-激励召回',
    applicableRiskLevels: ['high'],
    triggerDelayHours: 0,
    maxAttempts: 3,
    attemptIntervalHours: 24,
    type: RecallStrategyType.INCENTIVE,
    config: {
      incentiveType: 'coupon',
      couponValue: 10,
      couponCode: 'COMEBACK',
    },
  },
  {
    id: 'strategy_high_cs',
    name: '高风险-客服介入',
    applicableRiskLevels: ['high'],
    triggerDelayHours: 1,
    maxAttempts: 2,
    attemptIntervalHours: 48,
    type: RecallStrategyType.CUSTOMER_SERVICE,
    config: {
      autoEscalation: true,
      priority: 'high',
    },
  },
  {
    id: 'strategy_medium_push',
    name: '中风险-推送召回',
    applicableRiskLevels: ['medium'],
    triggerDelayHours: 0,
    maxAttempts: 2,
    attemptIntervalHours: 72,
    type: RecallStrategyType.PUSH_NOTIFICATION,
    config: {
      title: '好久不见，欢迎回来~',
      body: '我们有新功能等您体验，点击查看',
    },
  },
  {
    id: 'strategy_low_email',
    name: '低风险-邮件召回',
    applicableRiskLevels: ['low'],
    triggerDelayHours: 24,
    maxAttempts: 1,
    attemptIntervalHours: 0,
    type: RecallStrategyType.EMAIL,
    config: {
      subject: '欢迎回来，发现更多精彩内容',
    },
  },
];
```

#### 3.2 策略执行引擎

```typescript
class RecallStrategyEngine {
  private strategies: RecallStrategy[];
  private cache: LayeredCache;
  
  constructor(strategies: RecallStrategy[], cache: LayeredCache) {
    this.strategies = strategies;
    this.cache = cache;
  }
  
  /**
   * 执行用户召回
   */
  async executeRecall(
    userId: string,
    riskScore: ChurnRiskScore
  ): Promise<RecallResult> {
    const results: RecallAttempt[] = [];
    
    // 筛选适用的策略
    const applicableStrategies = this.strategies.filter(
      s => s.applicableRiskLevels.includes(riskScore.riskLevel)
    );
    
    for (const strategy of applicableStrategies) {
      // 检查是否已达到最大执行次数
      const attemptKey = `recall:${userId}:${strategy.id}`;
      const attempts = await this.cache.get<number>(attemptKey) ?? 0;
      
      if (attempts >= strategy.maxAttempts) {
        continue;
      }
      
      // 延迟执行
      if (strategy.triggerDelayHours > 0) {
        await this.scheduleDelayedRecall(userId, strategy, riskScore);
        continue;
      }
      
      // 执行策略
      const result = await this.executeStrategy(userId, strategy, riskScore);
      results.push(result);
      
      // 更新执行计数
      await this.cache.set(attemptKey, attempts + 1, 7 * 24 * 60 * 60 * 1000);
    }
    
    return {
      userId,
      riskLevel: riskScore.riskLevel,
      attempts: results,
      executedAt: new Date(),
    };
  }
  
  /**
   * 执行单个策略
   */
  private async executeStrategy(
    userId: string,
    strategy: RecallStrategy,
    riskScore: ChurnRiskScore
  ): Promise<RecallAttempt> {
    const startTime = Date.now();
    
    try {
      switch (strategy.type) {
        case RecallStrategyType.PUSH_NOTIFICATION:
          return await this.executePushNotification(strategy.config);
        case RecallStrategyType.EMAIL:
          return await this.executeEmail(userId, strategy.config);
        case RecallStrategyType.SMS:
          return await this.executeSMS(userId, strategy.config);
        case RecallStrategyType.IN_APP_MESSAGE:
          return await this.executeInAppMessage(userId, strategy.config);
        case RecallStrategyType.CUSTOMER_SERVICE:
          return await this.executeCustomerService(userId, riskScore);
        case RecallStrategyType.INCENTIVE:
          return await this.executeIncentive(userId, strategy.config);
        default:
          throw new Error(`Unknown strategy type: ${strategy.type}`);
      }
    } catch (error) {
      return {
        strategyId: strategy.id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}
```

### 4. 智能客服集成

#### 4.1 流失用户客服场景

利用现有智能客服基础设施，为流失风险用户提供定制化服务:

```typescript
// 流失召回客服场景配置
const CHURN_CUSTOMER_SERVICE_PROMPT = `
你是一个专门负责用户召回的客服助手。你的职责是:

## 核心目标
- 了解用户流失的原因
- 解决用户可能遇到的问题
- 提供有价值的激励或补偿
- 引导用户回到平台

## 用户背景
- 用户风险评分: {riskScore}
- 流失原因预测: {predictedReason}
- 用户历史偏好: {userPreferences}

## 沟通原则
1. 表达对用户流失的重视和歉意
2. 询问具体的流失原因 (不使用"为什么离开"等直接问法)
3. 提供针对性的解决方案
4. 如有激励政策，在适当时机提及
5. 结束时确认用户是否愿意回归

## 可用激励
- 专属优惠券
- 会员特权体验
- 新功能优先体验权

请根据以上信息，以温暖、专业的态度与用户沟通:`;
```

#### 4.2 流失原因识别

```typescript
// 流失原因类型
enum ChurnReason {
  CONTENT_QUALITY = 'content_quality',       // 内容质量下降
  COMPETITOR = 'competitor',                 // 竞品吸引
  FEATURE_MISSING = 'feature_missing',       // 功能缺失
  UX_PROBLEM = 'ux_problem',               // 用户体验问题
  PRICE_ISSUE = 'price_issue',             // 价格问题
  PERSONAL_REASON = 'personal_reason',      // 个人原因
  UNKNOWN = 'unknown',                      // 未知原因
}

// 流失原因分析
async function analyzeChurnReason(
  userId: string,
  events: UserBehaviorEvent[]
): Promise<ChurnReason> {
  // 分析行为模式变化
  const recentActivity = filterRecentEvents(events, 7);
  const earlierActivity = filterEarlierEvents(events, 7, 14);
  
  // 检测特征
  const features = {
    hasSearchDrop: detectSearchDrop(recentActivity, earlierActivity),
    hasFavoriteDrop: detectFavoriteDrop(recentActivity, earlierActivity),
    hasSessionDrop: detectSessionDrop(recentActivity, earlierActivity),
    hasContentDrop: detectContentDrop(recentActivity, earlierActivity),
  };
  
  // 基于特征推断原因
  if (features.hasContentDrop && features.hasSearchDrop) {
    return ChurnReason.CONTENT_QUALITY;
  }
  if (features.hasFavoriteDrop) {
    return ChurnReason.COMPETITOR;
  }
  if (features.hasSessionDrop) {
    return ChurnReason.UX_PROBLEM;
  }
  
  return ChurnReason.UNKNOWN;
}
```

### 5. 召回效果追踪

```typescript
// 召回效果指标
interface RecallMetrics {
  /** 用户 ID */
  userId: string;
  /** 召回策略 ID */
  strategyId: string;
  /** 策略类型 */
  strategyType: RecallStrategyType;
  /** 执行时间 */
  executedAt: Date;
  /** 触达状态 */
  deliveryStatus: 'sent' | 'delivered' | 'failed';
  /** 用户响应状态 */
  responseStatus: 'ignored' | 'clicked' | 'converted';
  /** 是否成功召回 (回访) */
  recalled: boolean;
  /** 回访时间 */
  recalledAt?: Date;
  /** 回归后的留存天数 */
  retentionDays?: number;
}

// 追踪回调
async function trackRecallEvent(
  userId: string,
  strategyId: string,
  event: 'sent' | 'delivered' | 'clicked' | 'converted'
): Promise<void> {
  const key = `recall_metrics:${userId}:${strategyId}`;
  const metrics = await this.cache.get<RecallMetrics>(key) ?? {
    userId,
    strategyId,
    executedAt: new Date(),
  };
  
  switch (event) {
    case 'sent':
      metrics.deliveryStatus = 'sent';
      break;
    case 'delivered':
      metrics.deliveryStatus = 'delivered';
      break;
    case 'clicked':
      metrics.responseStatus = 'clicked';
      break;
    case 'converted':
      metrics.responseStatus = 'converted';
      metrics.recalled = true;
      metrics.recalledAt = new Date();
      break;
  }
  
  // 缓存 30 天
  await this.cache.set(key, metrics, 30 * 24 * 60 * 60 * 1000);
}

// 计算召回效果统计
async function getRecallStats(
  startDate: Date,
  endDate: Date
): Promise<RecallStatistics> {
  // 从缓存/数据库获取相关指标
  // ...
  
  return {
    totalUsersAtRisk: 0,
    usersTargeted: 0,
    recallRate: 0,
    avgTimeToRecall: 0,
    topPerformingStrategy: '',
    roi: 0,
  };
}
```

## API 设计

### 预警管理 API

```typescript
// 路由前缀: /api/churn

/**
 * 获取流失预警仪表盘
 * GET /api/churn/dashboard
 */
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const stats = await churnService.getDashboardStats();
  res.json(stats);
}));

/**
 * 获取风险用户列表
 * GET /api/churn/users?riskLevel=high&page=1&limit=20
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const { riskLevel, page = '1', limit = '20' } = req.query;
  
  const users = await churnService.getAtRiskUsers({
    riskLevel: riskLevel as 'high' | 'medium' | 'low',
    page: parseInt(String(page), 10),
    limit: parseInt(String(limit), 10),
  });
  
  res.json(users);
}));

/**
 * 获取用户流失风险详情
 * GET /api/churn/users/:userId
 */
router.get('/users/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const detail = await churnService.getUserChurnDetail(userId);
  res.json(detail);
}));

/**
 * 手动触发用户召回
 * POST /api/churn/users/:userId/recall
 */
router.post('/users/:userId/recall', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { strategyId } = req.body;
  
  const result = await churnService.executeManualRecall(userId, strategyId);
  res.json(result);
}));

/**
 * 获取召回统计
 * GET /api/churn/recall/stats?startDate=xxx&endDate=xxx
 */
router.get('/recall/stats', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  const stats = await churnService.getRecallStats(
    new Date(String(startDate)),
    new Date(String(endDate))
  );
  
  res.json(stats);
}));
```

## 数据库设计

### Prisma Schema (扩展)

```prisma
// 用户行为事件
model UserBehaviorEvent {
  id          String   @id @default(cuid())
  userId      String
  eventType   String
  timestamp   DateTime @default(now())
  sessionId   String?
  page        String?
  duration    Int?
  resourceId  String?
  resourceType String?
  metadata    Json?
  
  @@index([userId, timestamp])
  @@index([eventType, timestamp])
}

// 用户流失风险记录
model ChurnRiskRecord {
  id              String   @id @default(cuid())
  userId          String
  totalScore      Int
  riskLevel       String   // high, medium, low
  dimensionScores Json
  predictedAt     DateTime @default(now())
  
  @@index([userId, predictedAt])
  @@index([riskLevel, predictedAt])
}

// 召回记录
model RecallRecord {
  id              String   @id @default(cuid())
  userId          String
  riskRecordId   String
  strategyId      String
  strategyType    String
  executedAt      DateTime @default(now())
  deliveryStatus  String
  responseStatus  String?
  recalled        Boolean  @default(false)
  recalledAt      DateTime?
  
  @@index([userId, executedAt])
  @@index([strategyId])
}
```

## 环境配置

### 环境变量配置

```bash
# ============== 流失预警配置 ==============

# 功能开关
CHURN_WARNING_ENABLED=true

# 风险阈值
CHURN_HIGH_RISK_THRESHOLD=70
CHURN_MEDIUM_RISK_THRESHOLD=40

# 检查配置
CHURN_CHECK_INTERVAL_HOURS=6
CHURN_OBSERVATION_DAYS=14
CHURN_BASE_ACTIVE_DAYS=3

# 召回配置
CHURN_RECALL_ENABLED=true
CHURN_MAX_RECALL_ATTEMPTS=3

# 推送配置
PUSH_SERVICE_ENABLED=true
PUSH_SERVICE_PROVIDER=firebase  # firebase, onesignal, getui

# 邮件配置
EMAIL_SERVICE_ENABLED=true
EMAIL_FROM=churn@yourdomain.com

# 短信配置
SMS_SERVICE_ENABLED=false
SMS_PROVIDER=aliyun
```

## 快速实现方案

### Phase 1: 基础能力 (1-2 周)

1. 用户行为事件采集
2. 基础风险评分计算
3. 预警通知推送
4. 简单仪表盘

### Phase 2: 智能召回 (2-3 周)

1. 召回策略引擎
2. 智能客服集成
3. 个性化召回内容
4. 召回效果追踪

### Phase 3: 持续优化 (持续)

1. 模型调优
2. A/B 测试
3. 新渠道接入
4. 数据分析报表

## 集成点

### 与现有系统集成

| 系统 | 集成方式 | 复用内容 |
|------|----------|----------|
| 缓存服务 | `server/services/cache.ts` | 用户特征缓存、召回记录 |
| 智能客服 | `server/services/customerService.ts` | 流失用户对话场景 |
| 监控告警 | `deploy/monitoring/` | 预警指标、告警通知 |
| 配置管理 | `server/config/env.ts` | 预警阈值配置 |
| 推送服务 | 外部集成 | FCM、个推等 |

## 成功指标

| 指标 | 目标值 | 计算方式 |
|------|--------|----------|
| 流失预警准确率 | >= 75% | 预测流失且实际流失数 / 预测流失总数 |
| 召回转化率 | >= 15% | 召回后回访用户数 / 召回触达用户数 |
| 平均召回时长 | <= 48h | 从预警到用户回访的平均时长 |
| 召回 ROI | >= 300% | 召回用户贡献价值 / 召回成本 |

## 注意事项

1. **隐私合规**: 确保行为数据采集符合 GDPR/个人信息保护法要求
2. **频率控制**: 避免过度触达造成用户反感，设置最大触达次数
3. **A/B 测试**: 持续优化召回策略效果
4. **数据质量**: 确保行为数据采集完整、准确

---

文档版本: v1.0  
创建时间: 2026-07-06  
维护者: 团队

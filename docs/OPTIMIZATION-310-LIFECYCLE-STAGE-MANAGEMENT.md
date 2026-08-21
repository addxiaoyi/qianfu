# 优化项 310: 用户生命周期 - 阶段管理

## 概述

本文档描述用户生命周期阶段管理系统的设计与实现。该系统为用户提供统一的生命周期视角，整合现有的 RFM 分析、流失预警等模块，提供阶段定义、状态转换、指标追踪和运营策略联动能力。

## 现有能力

项目已具备以下相关模块：

| 模块 | 现有能力 | 与本系统的关系 |
|------|----------|----------------|
| RFM 分析 (`server/services/rfmService.ts`) | 用户价值分群 (Champions/Loyal/At-Risk 等) | 直接映射到用户价值维度 |
| 流失预警 (`docs/OPTIMIZATION-312-CHURN-PREDICTION.md`) | 流失风险评分与召回 | 为"流失"阶段提供预警 |
| 缓存服务 (`server/services/cache.ts`) | 分层缓存 | 用户阶段状态缓存 |
| 监控指标 (`server/lib/metrics.ts`) | Prometheus 指标 | 阶段转换统计 |

## 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                      用户生命周期阶段管理系统                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │                    生命周期阶段定义                          │    │
│   │                                                             │    │
│   │   ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐ │    │
│   │   │ 新用户 │───▶│ 活跃 │───▶│ 沉睡 │───▶│ 流失 │    │ 回流 │ │    │
│   │   │ New   │    │Active│    │Dormant│   │Churned│    │Reactiv│ │    │
│   │   └──────┘    └──────┘    └──────┘    └──────┘    └──────┘ │    │
│   │       ▲                                              │       │    │
│   │       └──────────────────────────────────────────────┘       │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│   ┌──────────────────────────┼───────────────────────────────┐       │
│   │                   阶段状态机                              │       │
│   │   ┌─────────┐  事件触发  ┌─────────┐  定时任务  ┌───────┐ │       │
│   │   │ 状态转换 │ ────────▶ │ 转换记录 │ ────────▶ │ 指标  │ │       │
│   │   │  引擎    │           │  持久化  │            │ 采集  │ │       │
│   │   └─────────┘           └─────────┘            └───────┘ │       │
│   └───────────────────────────────────────────────────────────┘       │
│                              │                                        │
│   ┌──────────────────────────┼───────────────────────────────┐       │
│   │                   运营策略联动                            │       │
│   │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │       │
│   │   │ RFM策略 │  │召回策略 │  │积分系统 │  │通知服务 │ │       │
│   │   └─────────┘  └─────────┘  └─────────┘  └─────────┘ │       │
│   └───────────────────────────────────────────────────────────┘       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 阶段定义

### 核心阶段

```typescript
/**
 * 用户生命周期阶段
 */
export enum LifecycleStage {
  // 核心阶段
  NEW = 'new',                 // 新用户: 注册后未完成激活
  ACTIVE = 'active',           // 活跃用户: 正常使用产品
  DORMANT = 'dormant',         // 沉睡用户: 长时间未活跃
  CHURNED = 'churned',         // 流失用户: 已判定为流失
  REACTIVATED = 'reactivated', // 回流用户: 从流失状态回归

  // 扩展阶段
  TRIAL = 'trial',             // 试用期用户
  PAID = 'paid',               // 付费用户
  VIP = 'vip',                 // 高价值用户
  INACTIVE = 'inactive',       // 永久不活跃
}

/**
 * 阶段详情
 */
export interface StageDefinition {
  /** 阶段标识 */
  stage: LifecycleStage;
  /** 阶段名称 */
  name: string;
  /** 阶段描述 */
  description: string;
  /** 进入条件 */
  entryCriteria: StageEntryCriteria;
  /** 退出条件 */
  exitCriteria: StageExitCriteria;
  /** 停留时长配置 */
  duration: {
    /** 最短停留天数 */
    minDays: number;
    /** 建议停留天数 */
    recommendedDays: number;
    /** 警告阈值 (超过此天数触发提醒) */
    warningDays?: number;
  };
  /** 关联的运营策略 */
  strategies: string[];
}

/**
 * 进入条件
 */
export interface StageEntryCriteria {
  /** 条件类型 */
  type: 'automatic' | 'manual' | 'event';
  /** 条件描述 */
  description: string;
  /** 具体配置 */
  config?: Record<string, unknown>;
}

/**
 * 退出条件
 */
export interface StageExitCriteria {
  /** 条件类型 */
  type: 'automatic' | 'manual' | 'event';
  /** 条件描述 */
  description: string;
  /** 转换到哪个阶段 */
  targetStage: LifecycleStage;
  /** 具体配置 */
  config?: Record<string, unknown>;
}

/**
 * 阶段定义配置
 */
export const STAGE_DEFINITIONS: Record<LifecycleStage, StageDefinition> = {
  [LifecycleStage.NEW]: {
    stage: LifecycleStage.NEW,
    name: '新用户',
    description: '刚注册的用户，正在完成初始设置和激活流程',
    entryCriteria: {
      type: 'automatic',
      description: '用户完成注册',
    },
    exitCriteria: {
      type: 'automatic',
      description: '完成关键激活行为',
      targetStage: LifecycleStage.ACTIVE,
      config: {
        requiredActions: ['first_login', 'complete_profile'],
        timeWindowHours: 72,
      },
    },
    duration: {
      minDays: 0,
      recommendedDays: 3,
      warningDays: 7,
    },
    strategies: ['onboarding', 'activation_reward'],
  },

  [LifecycleStage.ACTIVE]: {
    stage: LifecycleStage.ACTIVE,
    name: '活跃用户',
    description: '正常使用平台功能的活跃用户',
    entryCriteria: {
      type: 'automatic',
      description: '完成激活行为或从流失状态回归',
    },
    exitCriteria: {
      type: 'automatic',
      description: '超过沉睡阈值未活跃',
      targetStage: LifecycleStage.DORMANT,
      config: {
        inactiveDays: 14,
      },
    },
    duration: {
      minDays: 0,
      recommendedDays: 30,
    },
    strategies: ['engagement', 'upsell'],
  },

  [LifecycleStage.DORMANT]: {
    stage: LifecycleStage.DORMANT,
    name: '沉睡用户',
    description: '长时间未活跃，但尚未判定为流失',
    entryCriteria: {
      type: 'automatic',
      description: '活跃用户超过14天未登录',
      config: {
        inactiveDays: 14,
      },
    },
    exitCriteria: {
      type: 'automatic',
      description: '流失判定或重新激活',
      targetStage: LifecycleStage.CHURNED,
      config: {
        dormantDays: 30,
      },
    },
    duration: {
      minDays: 0,
      recommendedDays: 14,
      warningDays: 30,
    },
    strategies: ['reactivation', 'win_back'],
  },

  [LifecycleStage.CHURNED]: {
    stage: LifecycleStage.CHURNED,
    name: '流失用户',
    description: '已判定为流失的用户',
    entryCriteria: {
      type: 'automatic',
      description: '沉睡超过30天或主动注销',
    },
    exitCriteria: {
      type: 'event',
      description: '用户重新登录或完成关键行为',
      targetStage: LifecycleStage.REACTIVATED,
    },
    duration: {
      minDays: 0,
      recommendedDays: 0,
    },
    strategies: ['churn_recall', 'farewell'],
  },

  [LifecycleStage.REACTIVATED]: {
    stage: LifecycleStage.REACTIVATED,
    name: '回流用户',
    description: '从流失状态回归的用户',
    entryCriteria: {
      type: 'event',
      description: '流失用户重新登录',
    },
    exitCriteria: {
      type: 'automatic',
      description: '完成回流验证期',
      targetStage: LifecycleStage.ACTIVE,
      config: {
        validationDays: 7,
        requiredActions: ['login', 'core_action'],
      },
    },
    duration: {
      minDays: 7,
      recommendedDays: 14,
      warningDays: 30,
    },
    strategies: ['reactivation_reward', 'onboarding_v2'],
  },

  [LifecycleStage.TRIAL]: {
    stage: LifecycleStage.TRIAL,
    name: '试用期用户',
    description: '处于产品试用期的用户',
    entryCriteria: {
      type: 'automatic',
      description: '开始试用产品',
    },
    exitCriteria: {
      type: 'automatic',
      description: '试用期结束',
      targetStage: LifecycleStage.PAID,
      config: {
        trialDays: 14,
      },
    },
    duration: {
      minDays: 14,
      recommendedDays: 14,
      warningDays: 12,
    },
    strategies: ['trial_nurture', 'conversion_offer'],
  },

  [LifecycleStage.PAID]: {
    stage: LifecycleStage.PAID,
    name: '付费用户',
    description: '已完成付费的用户',
    entryCriteria: {
      type: 'event',
      description: '完成首次付费',
    },
    exitCriteria: {
      type: 'automatic',
      description: '续费失败或主动退订',
      targetStage: LifecycleStage.CHURNED,
    },
    duration: {
      minDays: 0,
      recommendedDays: 30,
    },
    strategies: ['retention', 'upsell', 'cross_sell'],
  },

  [LifecycleStage.VIP]: {
    stage: LifecycleStage.VIP,
    name: '高价值用户',
    description: '高消费、高活跃的优质用户',
    entryCriteria: {
      type: 'automatic',
      description: 'RFM评分达到VIP阈值',
      config: {
        minRFMScore: 444,
        minLifetimeValue: 10000,
      },
    },
    exitCriteria: {
      type: 'automatic',
      description: 'RFM评分下降或消费减少',
      targetStage: LifecycleStage.ACTIVE,
    },
    duration: {
      minDays: 0,
      recommendedDays: 90,
    },
    strategies: ['vip_exclusive', 'personal_manager'],
  },

  [LifecycleStage.INACTIVE]: {
    stage: LifecycleStage.INACTIVE,
    name: '永久不活跃',
    description: '长期不活跃或主动注销的用户',
    entryCriteria: {
      type: 'automatic',
      description: '流失超过180天或主动注销',
    },
    exitCriteria: {
      type: 'event',
      description: '用户重新注册',
      targetStage: LifecycleStage.NEW,
    },
    duration: {
      minDays: 0,
      recommendedDays: 0,
    },
    strategies: [],
  },
};
```

### 阶段转换规则

```typescript
/**
 * 阶段转换事件
 */
export enum LifecycleEvent {
  USER_REGISTER = 'user_register',           // 用户注册
  USER_LOGIN = 'user_login',               // 用户登录
  USER_LOGOUT = 'user_logout',             // 用户登出
  COMPLETE_PROFILE = 'complete_profile',   // 完成资料
  CORE_ACTION = 'core_action',             // 核心行为
  INACTIVITY_DETECTED = 'inactivity_detected', // 检测到不活跃
  CHURN_PREDICTED = 'churn_predicted',     // 预测流失
  CHURN_CONFIRMED = 'churn_confirmed',       // 流失确认
  REACTIVATION = 'reactivation',           // 重新激活
  PAYMENT = 'payment',                     // 付费
  PAYMENT_FAILED = 'payment_failed',       // 付费失败
  VIP_UPGRADE = 'vip_upgrade',             // 升级VIP
  VIP_DOWNGRADE = 'vip_downgrade',         // 降级VIP
  ACCOUNT_DELETED = 'account_deleted',    // 账号注销
}

/**
 * 阶段转换规则
 */
export interface TransitionRule {
  /** 当前阶段 */
  fromStage: LifecycleStage;
  /** 触发事件 */
  event: LifecycleEvent;
  /** 目标阶段 */
  toStage: LifecycleStage;
  /** 条件判断函数 */
  condition?: (context: TransitionContext) => boolean;
  /** 转换前钩子 */
  beforeTransition?: (context: TransitionContext) => Promise<void>;
  /** 转换后钩子 */
  afterTransition?: (context: TransitionContext) => Promise<void>;
}

/**
 * 转换上下文
 */
export interface TransitionContext {
  /** 用户 ID */
  userId: string;
  /** 触发事件 */
  event: LifecycleEvent;
  /** 事件时间 */
  timestamp: Date;
  /** 当前阶段 */
  currentStage: LifecycleStage;
  /** 用户元数据 */
  metadata?: Record<string, unknown>;
  /** 扩展数据 */
  extended?: {
    /** 最近登录时间 */
    lastLoginAt?: Date;
    /** 最近活跃时间 */
    lastActiveAt?: Date;
    /** 活跃天数 */
    activeDays?: number;
    /** 不活跃天数 */
    inactiveDays?: number;
    /** 累计消费 */
    totalSpend?: number;
    /** RFM 评分 */
    rfmScore?: string;
  };
}

/**
 * 预定义转换规则
 */
export const TRANSITION_RULES: TransitionRule[] = [
  // 新用户 -> 活跃
  {
    fromStage: LifecycleStage.NEW,
    event: LifecycleEvent.CORE_ACTION,
    toStage: LifecycleStage.ACTIVE,
    condition: (ctx) => {
      const profileComplete = ctx.metadata?.['profileComplete'] === true;
      return profileComplete || true; // 默认允许
    },
    afterTransition: async (ctx) => {
      // 发送激活成功事件
      await emitAnalyticsEvent('user_activated', { userId: ctx.userId });
    },
  },

  // 活跃 -> 沉睡
  {
    fromStage: LifecycleStage.ACTIVE,
    event: LifecycleEvent.INACTIVITY_DETECTED,
    toStage: LifecycleStage.DORMANT,
    condition: (ctx) => {
      return (ctx.extended?.inactiveDays ?? 0) >= 14;
    },
    beforeTransition: async (ctx) => {
      // 发送沉睡预警
      await sendNotification(ctx.userId, 'dormant_warning', {
        inactiveDays: ctx.extended?.inactiveDays,
      });
    },
  },

  // 活跃 -> VIP
  {
    fromStage: LifecycleStage.ACTIVE,
    event: LifecycleEvent.VIP_UPGRADE,
    toStage: LifecycleStage.VIP,
    condition: (ctx) => {
      return (ctx.extended?.rfmScore ?? '000') >= '444';
    },
    afterTransition: async (ctx) => {
      // 发送VIP升级通知
      await sendNotification(ctx.userId, 'vip_upgrade', {
        rfmScore: ctx.extended?.rfmScore,
      });
    },
  },

  // 沉睡 -> 流失
  {
    fromStage: LifecycleStage.DORMANT,
    event: LifecycleEvent.CHURN_CONFIRMED,
    toStage: LifecycleStage.CHURNED,
    condition: (ctx) => {
      return (ctx.extended?.inactiveDays ?? 0) >= 30;
    },
    afterTransition: async (ctx) => {
      // 触发流失预警
      await triggerChurnWarning(ctx.userId);
    },
  },

  // 流失 -> 回流
  {
    fromStage: LifecycleStage.CHURNED,
    event: LifecycleEvent.REACTIVATION,
    toStage: LifecycleStage.REACTIVATED,
    afterTransition: async (ctx) => {
      // 记录回流事件
      await recordReactivation(ctx.userId);
      // 触发回流奖励
      await applyReactivationReward(ctx.userId);
    },
  },

  // 回流 -> 活跃
  {
    fromStage: LifecycleStage.REACTIVATED,
    event: LifecycleEvent.CORE_ACTION,
    toStage: LifecycleStage.ACTIVE,
    condition: (ctx) => {
      const daysSinceReactivation = ctx.metadata?.['daysSinceReactivation'];
      return (daysSinceReactivation ?? 0) >= 7;
    },
    afterTransition: async (ctx) => {
      // 验证回流成功
      await confirmReactivation(ctx.userId);
    },
  },

  // VIP -> 活跃 (降级)
  {
    fromStage: LifecycleStage.VIP,
    event: LifecycleEvent.VIP_DOWNGRADE,
    toStage: LifecycleStage.ACTIVE,
    condition: (ctx) => {
      return (ctx.extended?.rfmScore ?? '000') < '444';
    },
  },
];
```

## 核心实现

### 服务类

```typescript
/**
 * 用户生命周期服务
 */
export class LifecycleService {
  private cache: Map<string, { data: LifecycleState; expiry: number }>;
  private stateTransitions: Map<string, StageTransitionRecord[]>;
  private config: LifecycleConfig;

  constructor(config: Partial<LifecycleConfig> = {}) {
    this.config = { ...DEFAULT_LIFECYCLE_CONFIG, ...config };
    this.cache = new Map();
    this.stateTransitions = new Map();
  }

  // ============== 核心方法 ==============

  /**
   * 获取用户当前阶段
   */
  async getUserStage(userId: string): Promise<LifecycleStage> {
    // 检查缓存
    const cached = this.getFromCache(`stage:${userId}`);
    if (cached) return cached.stage;

    // TODO: 从数据库获取
    // 暂时返回默认值
    return LifecycleStage.NEW;
  }

  /**
   * 获取用户生命周期状态
   */
  async getUserLifecycleState(userId: string): Promise<LifecycleState | null> {
    const cached = this.getFromCache(`state:${userId}`);
    if (cached) return cached;

    // TODO: 从数据库查询
    return null;
  }

  /**
   * 处理阶段转换
   */
  async handleTransition(
    userId: string,
    event: LifecycleEvent,
    metadata?: Record<string, unknown>
  ): Promise<TransitionResult> {
    const currentStage = await this.getUserStage(userId);

    // 查找匹配的转换规则
    const rule = this.findTransitionRule(currentStage, event);
    if (!rule) {
      return {
        success: false,
        currentStage,
        reason: 'No matching transition rule',
      };
    }

    // 构建转换上下文
    const context: TransitionContext = {
      userId,
      event,
      timestamp: new Date(),
      currentStage,
      metadata,
      extended: await this.getExtendedContext(userId),
    };

    // 检查条件
    if (rule.condition && !rule.condition(context)) {
      return {
        success: false,
        currentStage,
        reason: 'Condition not met',
      };
    }

    // 执行转换前钩子
    if (rule.beforeTransition) {
      await rule.beforeTransition(context);
    }

    // 执行转换
    const previousStage = currentStage;
    await this.persistTransition(userId, previousStage, rule.toStage, event);

    // 更新缓存
    await this.updateStageCache(userId, rule.toStage);

    // 执行转换后钩子
    if (rule.afterTransition) {
      await rule.afterTransition(context);
    }

    // 发送指标
    this.recordTransitionMetrics(userId, previousStage, rule.toStage, event);

    return {
      success: true,
      previousStage,
      currentStage: rule.toStage,
      event,
    };
  }

  /**
   * 批量处理阶段转换 (用于定时任务)
   */
  async processBatchTransitions(userIds: string[]): Promise<BatchTransitionResult> {
    const results: TransitionResult[] = [];
    const errors: Error[] = [];

    for (const userId of userIds) {
      try {
        const currentStage = await this.getUserStage(userId);
        const context = await this.getExtendedContext(userId);

        // 检查是否应该转换
        const inactiveDays = context.inactiveDays ?? 0;

        if (currentStage === LifecycleStage.ACTIVE && inactiveDays >= 14) {
          const result = await this.handleTransition(
            userId,
            LifecycleEvent.INACTIVITY_DETECTED
          );
          results.push(result);
        } else if (currentStage === LifecycleStage.DORMANT && inactiveDays >= 30) {
          const result = await this.handleTransition(
            userId,
            LifecycleEvent.CHURN_CONFIRMED
          );
          results.push(result);
        }
      } catch (error) {
        errors.push(error as Error);
      }
    }

    return {
      total: userIds.length,
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: errors.length,
      results,
      errors: errors.map(e => e.message),
    };
  }

  /**
   * 获取用户生命周期统计
   */
  async getStageStatistics(): Promise<StageStatistics> {
    // TODO: 从数据库聚合查询
    return {
      timestamp: new Date(),
      stages: {
        [LifecycleStage.NEW]: { count: 0, percentage: 0 },
        [LifecycleStage.ACTIVE]: { count: 0, percentage: 0 },
        [LifecycleStage.DORMANT]: { count: 0, percentage: 0 },
        [LifecycleStage.CHURNED]: { count: 0, percentage: 0 },
        [LifecycleStage.REACTIVATED]: { count: 0, percentage: 0 },
        [LifecycleStage.TRIAL]: { count: 0, percentage: 0 },
        [LifecycleStage.PAID]: { count: 0, percentage: 0 },
        [LifecycleStage.VIP]: { count: 0, percentage: 0 },
        [LifecycleStage.INACTIVE]: { count: 0, percentage: 0 },
      },
      totalUsers: 0,
      activeRate: 0,
      churnRate: 0,
      reactivationRate: 0,
    };
  }

  /**
   * 获取阶段分布
   */
  async getStageDistribution(): Promise<StageDistribution> {
    const stats = await this.getStageStatistics();
    const total = stats.totalUsers;

    return {
      stages: Object.entries(stats.stages).map(([stage, data]) => ({
        stage: stage as LifecycleStage,
        count: data.count,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
      })),
      generatedAt: new Date(),
    };
  }

  /**
   * 获取阶段转换历史
   */
  async getTransitionHistory(
    userId: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<StageTransitionRecord[]> {
    const transitions = this.stateTransitions.get(userId) ?? [];
    let filtered = transitions;

    if (options?.startDate) {
      filtered = filtered.filter(t => t.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter(t => t.timestamp <= options.endDate!);
    }

    const limit = options?.limit ?? 50;
    return filtered.slice(-limit);
  }

  // ============== 私有方法 ==============

  private findTransitionRule(
    fromStage: LifecycleStage,
    event: LifecycleEvent
  ): TransitionRule | undefined {
    return TRANSITION_RULES.find(
      rule => rule.fromStage === fromStage && rule.event === event
    );
  }

  private async persistTransition(
    userId: string,
    fromStage: LifecycleStage,
    toStage: LifecycleStage,
    event: LifecycleEvent
  ): Promise<void> {
    const record: StageTransitionRecord = {
      id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      fromStage,
      toStage,
      event,
      timestamp: new Date(),
    };

    // 添加到内存记录
    const transitions = this.stateTransitions.get(userId) ?? [];
    transitions.push(record);
    this.stateTransitions.set(userId, transitions);

    // TODO: 持久化到数据库

    logger.info(`[Lifecycle] User ${userId} transitioned: ${fromStage} -> ${toStage} (${event})`);
  }

  private async getExtendedContext(userId: string): Promise<TransitionContext['extended']> {
    // TODO: 从数据库获取用户扩展上下文
    return {
      lastLoginAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
      activeDays: Math.floor(Math.random() * 365),
      inactiveDays: Math.floor(Math.random() * 60),
      totalSpend: Math.random() * 50000,
      rfmScore: `${Math.floor(Math.random() * 5) + 1}${Math.floor(Math.random() * 5) + 1}${Math.floor(Math.random() * 5) + 1}`,
    };
  }

  private async updateStageCache(userId: string, stage: LifecycleStage): Promise<void> {
    const state: LifecycleState = {
      userId,
      stage,
      enteredAt: new Date(),
      previousStage: (await this.getFromCache(`stage:${userId}`)) as LifecycleStage | undefined,
    };

    this.setCache(`stage:${userId}`, state);
    this.setCache(`state:${userId}`, state);
  }

  private recordTransitionMetrics(
    userId: string,
    fromStage: LifecycleStage,
    toStage: LifecycleStage,
    event: LifecycleEvent
  ): void {
    // TODO: 发送 Prometheus 指标
    logger.debug(`[LifecycleMetrics] transition: ${fromStage} -> ${toStage}, event: ${event}`);
  }

  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (item && item.expiry > Date.now()) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl = 300000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }
}
```

### 类型定义

```typescript
/**
 * 用户生命周期状态
 */
export interface LifecycleState {
  /** 用户 ID */
  userId: string;
  /** 当前阶段 */
  stage: LifecycleStage;
  /** 进入阶段时间 */
  enteredAt: Date;
  /** 上一个阶段 */
  previousStage?: LifecycleStage;
  /** 阶段停留天数 */
  daysInStage?: number;
  /** 扩展数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 阶段转换记录
 */
export interface StageTransitionRecord {
  /** 记录 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 原阶段 */
  fromStage: LifecycleStage;
  /** 目标阶段 */
  toStage: LifecycleStage;
  /** 触发事件 */
  event: LifecycleEvent;
  /** 转换时间 */
  timestamp: Date;
  /** 备注 */
  note?: string;
}

/**
 * 转换结果
 */
export interface TransitionResult {
  /** 是否成功 */
  success: boolean;
  /** 原阶段 */
  previousStage?: LifecycleStage;
  /** 当前阶段 */
  currentStage: LifecycleStage;
  /** 触发事件 */
  event?: LifecycleEvent;
  /** 失败原因 */
  reason?: string;
}

/**
 * 批量转换结果
 */
export interface BatchTransitionResult {
  /** 总数 */
  total: number;
  /** 处理数 */
  processed: number;
  /** 成功数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 结果列表 */
  results: TransitionResult[];
  /** 错误列表 */
  errors: string[];
}

/**
 * 阶段统计
 */
export interface StageStatistics {
  /** 统计时间 */
  timestamp: Date;
  /** 各阶段数据 */
  stages: Record<LifecycleStage, { count: number; percentage: number }>;
  /** 总用户数 */
  totalUsers: number;
  /** 活跃率 */
  activeRate: number;
  /** 流失率 */
  churnRate: number;
  /** 回流率 */
  reactivationRate: number;
}

/**
 * 阶段分布
 */
export interface StageDistribution {
  /** 各阶段分布 */
  stages: {
    stage: LifecycleStage;
    count: number;
    percentage: number;
  }[];
  /** 生成时间 */
  generatedAt: Date;
}

/**
 * 生命周期配置
 */
export interface LifecycleConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 不活跃天数阈值 */
  inactivityThresholdDays: number;
  /** 沉睡判定天数 */
  dormantThresholdDays: number;
  /** 流失判定天数 */
  churnThresholdDays: number;
  /** 永久不活跃天数 */
  inactiveThresholdDays: number;
  /** 阶段转换检查间隔 (小时) */
  checkIntervalHours: number;
  /** 缓存 TTL (毫秒) */
  cacheTtl: number;
}

const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  enabled: true,
  inactivityThresholdDays: 14,
  dormantThresholdDays: 30,
  churnThresholdDays: 90,
  inactiveThresholdDays: 180,
  checkIntervalHours: 6,
  cacheTtl: 300000,
};
```

## API 设计

### 路由定义

```typescript
// 路由前缀: /api/lifecycle

/**
 * 获取用户当前阶段
 * GET /api/lifecycle/users/:userId/stage
 */
router.get('/users/:userId/stage', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const stage = await lifecycleService.getUserStage(userId);
  const state = await lifecycleService.getUserLifecycleState(userId);

  res.json({
    success: true,
    data: {
      stage,
      state,
    },
  });
}));

/**
 * 获取用户阶段转换历史
 * GET /api/lifecycle/users/:userId/history
 */
router.get('/users/:userId/history', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = '50', startDate, endDate } = req.query;

  const history = await lifecycleService.getTransitionHistory(userId, {
    limit: parseInt(String(limit), 10),
    startDate: startDate ? new Date(String(startDate)) : undefined,
    endDate: endDate ? new Date(String(endDate)) : undefined,
  });

  res.json({
    success: true,
    data: {
      total: history.length,
      transitions: history,
    },
  });
}));

/**
 * 手动触发阶段转换
 * POST /api/lifecycle/users/:userId/transition
 */
router.post('/users/:userId/transition', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { event, metadata } = req.body;

  if (!event) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少 event 参数',
    });
    return;
  }

  const result = await lifecycleService.handleTransition(
    userId,
    event as LifecycleEvent,
    metadata
  );

  res.json({
    success: result.success,
    data: result,
  });
}));

/**
 * 获取阶段统计
 * GET /api/lifecycle/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await lifecycleService.getStageStatistics();
  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * 获取阶段分布
 * GET /api/lifecycle/distribution
 */
router.get('/distribution', asyncHandler(async (req, res) => {
  const distribution = await lifecycleService.getStageDistribution();
  res.json({
    success: true,
    data: distribution,
  });
}));

/**
 * 获取阶段定义
 * GET /api/lifecycle/stages
 */
router.get('/stages', (req, res) => {
  const stages = Object.entries(STAGE_DEFINITIONS).map(([key, def]) => ({
    stage: key,
    name: def.name,
    description: def.description,
    duration: def.duration,
    strategies: def.strategies,
  }));

  res.json({
    success: true,
    data: stages,
  });
}));
```

## 数据库设计

### Prisma Schema (扩展现有模型)

```prisma
// 用户生命周期状态
model UserLifecycleStage {
  id              String          @id @default(cuid())
  userId          String          @unique
  stage           String          // LifecycleStage
  enteredAt       DateTime        @default(now())
  previousStage   String?
  metadata        Json?

  // 索引
  @@index([stage])
  @@index([enteredAt])

  // 关系
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  transitions     StageTransition[]
}

// 阶段转换记录
model StageTransition {
  id              String          @id @default(cuid())
  userId          String
  userStageId     String?
  fromStage       String
  toStage         String
  event           String          // LifecycleEvent
  timestamp       DateTime        @default(now())
  note            String?

  // 索引
  @@index([userId, timestamp])
  @@index([toStage, timestamp])
  @@index([event])

  // 关系
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  userStage       UserLifecycleStage? @relation(fields: [userStageId], references: [id])
}
```

## 环境配置

```bash
# ============== 生命周期管理配置 ==============

# 功能开关
LIFECYCLE_ENABLED=true

# 阶段阈值
LIFECYCLE_INACTIVITY_DAYS=14
LIFECYCLE_DORMANT_DAYS=30
LIFECYCLE_CHURN_DAYS=90
LIFECYCLE_INACTIVE_DAYS=180

# 检查间隔
LIFECYCLE_CHECK_INTERVAL_HOURS=6

# VIP 阈值
LIFECYCLE_VIP_MIN_RFM_SCORE=444
LIFECYCLE_VIP_MIN_LIFETIME_VALUE=10000
```

## 定时任务

### 阶段检查任务

```typescript
import cron from 'node-cron';

/**
 * 注册生命周期定时任务
 */
export function registerLifecycleJobs(): void {
  // 每 6 小时检查一次阶段转换
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[LifecycleJob] Starting stage transition check');

    try {
      // 获取需要检查的用户
      const userIds = await getUsersNeedingStageCheck();

      // 批量处理
      const result = await lifecycleService.processBatchTransitions(userIds);

      logger.info(`[LifecycleJob] Processed ${result.processed} users: ${result.succeeded} succeeded, ${result.failed} failed`);
    } catch (error) {
      logger.error('[LifecycleJob] Error processing stage transitions:', error);
    }
  });

  // 每天生成统计报告
  cron.schedule('0 0 * * *', async () => {
    logger.info('[LifecycleJob] Generating daily statistics');

    try {
      const stats = await lifecycleService.getStageStatistics();

      // 发送指标到监控系统
      await sendMetricsToMonitoring(stats);

      logger.info(`[LifecycleJob] Stats: ${stats.totalUsers} users, ${stats.activeRate}% active`);
    } catch (error) {
      logger.error('[LifecycleJob] Error generating statistics:', error);
    }
  });
}
```

## 与现有系统集成

### 与 RFM 服务集成

```typescript
/**
 * RFM 评分变化时更新生命周期阶段
 */
export async function handleRFMScoreChange(
  userId: string,
  newScore: string
): Promise<void> {
  const scoreValue = parseInt(newScore, 10);

  if (scoreValue >= 444) {
    // 升级为 VIP
    await lifecycleService.handleTransition(
      userId,
      LifecycleEvent.VIP_UPGRADE,
      { rfmScore: newScore }
    );
  } else {
    // 检查是否需要降级
    const currentStage = await lifecycleService.getUserStage(userId);
    if (currentStage === LifecycleStage.VIP) {
      await lifecycleService.handleTransition(
        userId,
        LifecycleEvent.VIP_DOWNGRADE,
        { rfmScore: newScore }
      );
    }
  }
}
```

### 与流失预警集成

```typescript
/**
 * 流失预警触发时更新阶段
 */
export async function handleChurnWarning(
  userId: string,
  riskLevel: 'high' | 'medium' | 'low'
): Promise<void> {
  const lifecycleStage = await lifecycleService.getUserStage(userId);

  // 根据当前阶段决定如何处理
  if (lifecycleStage === LifecycleStage.ACTIVE) {
    // 触发流失预警
    await lifecycleService.handleTransition(
      userId,
      LifecycleEvent.CHURN_PREDICTED,
      { riskLevel }
    );
  } else if (lifecycleStage === LifecycleStage.DORMANT && riskLevel === 'high') {
    // 高风险流失确认
    await lifecycleService.handleTransition(
      userId,
      LifecycleEvent.CHURN_CONFIRMED,
      { riskLevel }
    );
  }
}

/**
 * 流失召回成功时更新阶段
 */
export async function handleChurnRecall(
  userId: string,
  recallMethod: string
): Promise<void> {
  await lifecycleService.handleTransition(
    userId,
    LifecycleEvent.REACTIVATION,
    { recallMethod }
  );
}
```

## 成功指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 阶段转换准确率 | >= 95% | 阶段转换符合预期规则的比例 |
| 阶段停留时长达标率 | >= 80% | 用户在各阶段停留时长符合预期的比例 |
| 流失预警覆盖率 | >= 90% | 进入流失阶段的用户中有预警的比例 |
| 回流转化率 | >= 15% | 流失用户被成功召回的比例 |
| 阶段数据一致性 | >= 99% | 阶段数据在各系统间保持一致 |

## 实现计划

### Phase 1: 核心框架 (1 周)

1. 创建生命周期服务类
2. 实现阶段定义和转换规则
3. 基础 API 端点
4. 内存缓存实现

### Phase 2: 数据持久化 (1 周)

1. 设计并创建数据库表
2. 实现数据持久化
3. 定时任务实现
4. 与现有系统对接

### Phase 3: 运营集成 (1 周)

1. 与 RFM 服务集成
2. 与流失预警系统集成
3. 运营策略触发
4. 通知服务集成

### Phase 4: 监控优化 (0.5 周)

1. Prometheus 指标
2. Grafana 看板
3. 告警规则
4. 性能优化

## 注意事项

1. **幂等性**: 阶段转换必须是幂等的，防止重复处理
2. **事务性**: 多系统联动的转换需要保证事务性
3. **可追溯**: 所有转换都要有完整的审计日志
4. **性能**: 大批量用户处理需要分批进行
5. **边界条件**: 注册即流失、反复横跳等边界情况需要处理

---

文档版本: v1.0
创建时间: 2026-07-06
维护者: 团队

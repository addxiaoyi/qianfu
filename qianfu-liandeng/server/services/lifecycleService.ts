/**
 * 用户生命周期阶段管理服务
 *
 * 功能:
 * - 用户生命周期阶段定义与管理
 * - 阶段转换状态机
 * - 阶段指标统计
 * - 与 RFM、流失预警等系统联动
 *
 * 依赖:
 * - server/lib/logger: 日志记录
 * - server/config/env: 配置管理
 */

import { logger } from '../lib/logger';

// ============== 生命周期阶段枚举 ==============

/**
 * 用户生命周期阶段
 */
export enum LifecycleStage {
  // 核心阶段
  NEW = 'new',                 // 新用户: 注册后未完成激活
  ACTIVE = 'active',           // 活跃用户: 正常使用产品
  DORMANT = 'dormant',         // 沉睡用户: 长时间未活跃
  CHURNED = 'churned',         // 流失用户: 已判定为流失
  REACTIVATED = 'reactivated',  // 回流用户: 从流失状态回归

  // 扩展阶段
  TRIAL = 'trial',             // 试用期用户
  PAID = 'paid',              // 付费用户
  VIP = 'vip',                 // 高价值用户
  INACTIVE = 'inactive',       // 永久不活跃
}

// ============== 生命周期事件枚举 ==============

/**
 * 阶段转换事件
 */
export enum LifecycleEvent {
  USER_REGISTER = 'user_register',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  COMPLETE_PROFILE = 'complete_profile',
  CORE_ACTION = 'core_action',
  INACTIVITY_DETECTED = 'inactivity_detected',
  CHURN_PREDICTED = 'churn_predicted',
  CHURN_CONFIRMED = 'churn_confirmed',
  REACTIVATION = 'reactivation',
  PAYMENT = 'payment',
  PAYMENT_FAILED = 'payment_failed',
  VIP_UPGRADE = 'vip_upgrade',
  VIP_DOWNGRADE = 'vip_downgrade',
  ACCOUNT_DELETED = 'account_deleted',
}

// ============== 类型定义 ==============

/**
 * 用户生命周期状态
 */
export interface LifecycleState {
  userId: string;
  stage: LifecycleStage;
  enteredAt: Date;
  previousStage?: LifecycleStage;
  daysInStage?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 阶段转换记录
 */
export interface StageTransitionRecord {
  id: string;
  userId: string;
  fromStage: LifecycleStage;
  toStage: LifecycleStage;
  event: LifecycleEvent;
  timestamp: Date;
  note?: string;
}

/**
 * 转换结果
 */
export interface TransitionResult {
  success: boolean;
  previousStage?: LifecycleStage;
  currentStage: LifecycleStage;
  event?: LifecycleEvent;
  reason?: string;
}

/**
 * 批量转换结果
 */
export interface BatchTransitionResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  results: TransitionResult[];
  errors: string[];
}

/**
 * 阶段统计
 */
export interface StageStatistics {
  timestamp: Date;
  stages: Record<LifecycleStage, { count: number; percentage: number }>;
  totalUsers: number;
  activeRate: number;
  churnRate: number;
  reactivationRate: number;
}

/**
 * 阶段分布
 */
export interface StageDistribution {
  stages: {
    stage: LifecycleStage;
    count: number;
    percentage: number;
  }[];
  generatedAt: Date;
}

/**
 * 阶段定义
 */
export interface StageDefinition {
  stage: LifecycleStage;
  name: string;
  description: string;
  entryCriteria: {
    type: 'automatic' | 'manual' | 'event';
    description: string;
    config?: Record<string, unknown>;
  };
  exitCriteria: {
    type: 'automatic' | 'manual' | 'event';
    description: string;
    targetStage: LifecycleStage;
    config?: Record<string, unknown>;
  };
  duration: {
    minDays: number;
    recommendedDays: number;
    warningDays?: number;
  };
  strategies: string[];
}

/**
 * 转换规则
 */
export interface TransitionRule {
  fromStage: LifecycleStage;
  event: LifecycleEvent;
  toStage: LifecycleStage;
  condition?: (context: TransitionContext) => boolean;
  beforeTransition?: (context: TransitionContext) => Promise<void>;
  afterTransition?: (context: TransitionContext) => Promise<void>;
}

/**
 * 转换上下文
 */
export interface TransitionContext {
  userId: string;
  event: LifecycleEvent;
  timestamp: Date;
  currentStage: LifecycleStage;
  metadata?: Record<string, unknown>;
  extended?: {
    lastLoginAt?: Date;
    lastActiveAt?: Date;
    activeDays?: number;
    inactiveDays?: number;
    totalSpend?: number;
    rfmScore?: string;
  };
}

/**
 * 生命周期配置
 */
export interface LifecycleConfig {
  enabled: boolean;
  inactivityThresholdDays: number;
  dormantThresholdDays: number;
  churnThresholdDays: number;
  inactiveThresholdDays: number;
  checkIntervalHours: number;
  cacheTtl: number;
}

const DEFAULT_CONFIG: LifecycleConfig = {
  enabled: true,
  inactivityThresholdDays: 14,
  dormantThresholdDays: 30,
  churnThresholdDays: 90,
  inactiveThresholdDays: 180,
  checkIntervalHours: 6,
  cacheTtl: 300000,
};

// ============== 阶段定义配置 ==============

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
      config: { requiredActions: ['first_login', 'complete_profile'], timeWindowHours: 72 },
    },
    duration: { minDays: 0, recommendedDays: 3, warningDays: 7 },
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
      config: { inactiveDays: 14 },
    },
    duration: { minDays: 0, recommendedDays: 30 },
    strategies: ['engagement', 'upsell'],
  },
  [LifecycleStage.DORMANT]: {
    stage: LifecycleStage.DORMANT,
    name: '沉睡用户',
    description: '长时间未活跃，但尚未判定为流失',
    entryCriteria: {
      type: 'automatic',
      description: '活跃用户超过14天未登录',
      config: { inactiveDays: 14 },
    },
    exitCriteria: {
      type: 'automatic',
      description: '流失判定或重新激活',
      targetStage: LifecycleStage.CHURNED,
      config: { dormantDays: 30 },
    },
    duration: { minDays: 0, recommendedDays: 14, warningDays: 30 },
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
    duration: { minDays: 0, recommendedDays: 0 },
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
      config: { validationDays: 7, requiredActions: ['login', 'core_action'] },
    },
    duration: { minDays: 7, recommendedDays: 14, warningDays: 30 },
    strategies: ['reactivation_reward', 'onboarding_v2'],
  },
  [LifecycleStage.TRIAL]: {
    stage: LifecycleStage.TRIAL,
    name: '试用期用户',
    description: '处于产品试用期的用户',
    entryCriteria: { type: 'automatic', description: '开始试用产品' },
    exitCriteria: {
      type: 'automatic',
      description: '试用期结束',
      targetStage: LifecycleStage.PAID,
      config: { trialDays: 14 },
    },
    duration: { minDays: 14, recommendedDays: 14, warningDays: 12 },
    strategies: ['trial_nurture', 'conversion_offer'],
  },
  [LifecycleStage.PAID]: {
    stage: LifecycleStage.PAID,
    name: '付费用户',
    description: '已完成付费的用户',
    entryCriteria: { type: 'event', description: '完成首次付费' },
    exitCriteria: {
      type: 'automatic',
      description: '续费失败或主动退订',
      targetStage: LifecycleStage.CHURNED,
    },
    duration: { minDays: 0, recommendedDays: 30 },
    strategies: ['retention', 'upsell', 'cross_sell'],
  },
  [LifecycleStage.VIP]: {
    stage: LifecycleStage.VIP,
    name: '高价值用户',
    description: '高消费、高活跃的优质用户',
    entryCriteria: {
      type: 'automatic',
      description: 'RFM评分达到VIP阈值',
      config: { minRFMScore: 444, minLifetimeValue: 10000 },
    },
    exitCriteria: {
      type: 'automatic',
      description: 'RFM评分下降或消费减少',
      targetStage: LifecycleStage.ACTIVE,
    },
    duration: { minDays: 0, recommendedDays: 90 },
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
    duration: { minDays: 0, recommendedDays: 0 },
    strategies: [],
  },
};

// ============== 转换规则 ==============

const TRANSITION_RULES: TransitionRule[] = [
  // 新用户 -> 活跃
  {
    fromStage: LifecycleStage.NEW,
    event: LifecycleEvent.CORE_ACTION,
    toStage: LifecycleStage.ACTIVE,
    condition: () => true,
    afterTransition: async (ctx) => {
      logger.info(`[Lifecycle] User ${ctx.userId} activated`);
    },
  },

  // 活跃 -> 沉睡
  {
    fromStage: LifecycleStage.ACTIVE,
    event: LifecycleEvent.INACTIVITY_DETECTED,
    toStage: LifecycleStage.DORMANT,
    condition: (ctx) => (ctx.extended?.inactiveDays ?? 0) >= 14,
  },

  // 活跃 -> VIP
  {
    fromStage: LifecycleStage.ACTIVE,
    event: LifecycleEvent.VIP_UPGRADE,
    toStage: LifecycleStage.VIP,
    condition: (ctx) => (ctx.extended?.rfmScore ?? '000') >= '444',
    afterTransition: async (ctx) => {
      logger.info(`[Lifecycle] User ${ctx.userId} upgraded to VIP`);
    },
  },

  // 沉睡 -> 流失
  {
    fromStage: LifecycleStage.DORMANT,
    event: LifecycleEvent.CHURN_CONFIRMED,
    toStage: LifecycleStage.CHURNED,
    condition: (ctx) => (ctx.extended?.inactiveDays ?? 0) >= 30,
    afterTransition: async (ctx) => {
      logger.warn(`[Lifecycle] User ${ctx.userId} churned`);
    },
  },

  // 流失 -> 回流
  {
    fromStage: LifecycleStage.CHURNED,
    event: LifecycleEvent.REACTIVATION,
    toStage: LifecycleStage.REACTIVATED,
    afterTransition: async (ctx) => {
      logger.info(`[Lifecycle] User ${ctx.userId} reactivated`);
    },
  },

  // 回流 -> 活跃
  {
    fromStage: LifecycleStage.REACTIVATED,
    event: LifecycleEvent.CORE_ACTION,
    toStage: LifecycleStage.ACTIVE,
    condition: (ctx) => (ctx.metadata?.['daysSinceReactivation'] as number ?? 0) >= 7,
  },

  // VIP -> 活跃 (降级)
  {
    fromStage: LifecycleStage.VIP,
    event: LifecycleEvent.VIP_DOWNGRADE,
    toStage: LifecycleStage.ACTIVE,
    condition: (ctx) => (ctx.extended?.rfmScore ?? '000') < '444',
  },
];

// ============== 生命周期服务类 ==============

export class LifecycleService {
  private cache: Map<string, { data: LifecycleState; expiry: number }>;
  private stateTransitions: Map<string, StageTransitionRecord[]>;
  private config: LifecycleConfig;

  constructor(config: Partial<LifecycleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.stateTransitions = new Map();
    logger.info('[Lifecycle] Lifecycle service initialized');
  }

  // ============== 公开方法 ==============

  /**
   * 获取用户当前阶段
   */
  async getUserStage(userId: string): Promise<LifecycleStage> {
    const cached = this.getFromCache(`stage:${userId}`);
    if (cached) return cached.stage;

    // TODO: 从数据库获取
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

    const rule = this.findTransitionRule(currentStage, event);
    if (!rule) {
      return { success: false, currentStage, reason: 'No matching transition rule' };
    }

    const context: TransitionContext = {
      userId,
      event,
      timestamp: new Date(),
      currentStage,
      metadata,
      extended: await this.getExtendedContext(userId),
    };

    if (rule.condition && !rule.condition(context)) {
      return { success: false, currentStage, reason: 'Condition not met' };
    }

    // 执行转换前钩子
    if (rule.beforeTransition) {
      await rule.beforeTransition(context);
    }

    const previousStage = currentStage;
    await this.persistTransition(userId, previousStage, rule.toStage, event);
    await this.updateStageCache(userId, rule.toStage);

    // 执行转换后钩子
    if (rule.afterTransition) {
      await rule.afterTransition(context);
    }

    logger.info(`[Lifecycle] User ${userId} transitioned: ${previousStage} -> ${rule.toStage} (${event})`);

    return { success: true, previousStage, currentStage: rule.toStage, event };
  }

  /**
   * 批量处理阶段转换
   */
  async processBatchTransitions(userIds: string[]): Promise<BatchTransitionResult> {
    const results: TransitionResult[] = [];
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const currentStage = await this.getUserStage(userId);
        const context = await this.getExtendedContext(userId);
        const inactiveDays = context.inactiveDays ?? 0;

        if (currentStage === LifecycleStage.ACTIVE && inactiveDays >= 14) {
          const result = await this.handleTransition(userId, LifecycleEvent.INACTIVITY_DETECTED);
          results.push(result);
        } else if (currentStage === LifecycleStage.DORMANT && inactiveDays >= 30) {
          const result = await this.handleTransition(userId, LifecycleEvent.CHURN_CONFIRMED);
          results.push(result);
        }
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    return {
      total: userIds.length,
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * 获取阶段统计
   */
  async getStageStatistics(): Promise<StageStatistics> {
    const stages = Object.values(LifecycleStage).reduce((acc, stage) => {
      acc[stage] = { count: 0, percentage: 0 };
      return acc;
    }, {} as Record<LifecycleStage, { count: number; percentage: number }>);

    return {
      timestamp: new Date(),
      stages,
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
   * 获取转换历史
   */
  async getTransitionHistory(
    userId: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<StageTransitionRecord[]> {
    let transitions = this.stateTransitions.get(userId) ?? [];

    if (options?.startDate) {
      transitions = transitions.filter(t => t.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      transitions = transitions.filter(t => t.timestamp <= options.endDate!);
    }

    const limit = options?.limit ?? 50;
    return transitions.slice(-limit);
  }

  /**
   * 获取阶段定义
   */
  getStageDefinitions(): StageDefinition[] {
    return Object.values(STAGE_DEFINITIONS);
  }

  /**
   * 获取特定阶段定义
   */
  getStageDefinition(stage: LifecycleStage): StageDefinition | undefined {
    return STAGE_DEFINITIONS[stage];
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

    const transitions = this.stateTransitions.get(userId) ?? [];
    transitions.push(record);
    this.stateTransitions.set(userId, transitions);

    // TODO: 持久化到数据库
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
      previousStage: await this.getUserStage(userId) as LifecycleStage | undefined,
    };

    this.setCache(`stage:${userId}`, { stage });
    this.setCache(`state:${userId}`, state);
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
    this.cache.set(key, { data, expiry: Date.now() + ttl });
  }
}

// ============== 单例导出 ==============

let lifecycleServiceInstance: LifecycleService | null = null;

export function initLifecycleService(config?: Partial<LifecycleConfig>): LifecycleService {
  lifecycleServiceInstance = new LifecycleService(config);
  logger.info('[Lifecycle] Lifecycle service singleton initialized');
  return lifecycleServiceInstance;
}

export function getLifecycleService(): LifecycleService {
  if (!lifecycleServiceInstance) {
    lifecycleServiceInstance = new LifecycleService();
  }
  return lifecycleServiceInstance;
}

// ============== 便捷函数 ==============

/**
 * 处理 RFM 评分变化
 */
export async function handleRFMScoreChange(
  userId: string,
  newScore: string
): Promise<void> {
  const service = getLifecycleService();
  const scoreValue = parseInt(newScore, 10);

  if (scoreValue >= 444) {
    await service.handleTransition(userId, LifecycleEvent.VIP_UPGRADE, { rfmScore: newScore });
  } else {
    const currentStage = await service.getUserStage(userId);
    if (currentStage === LifecycleStage.VIP) {
      await service.handleTransition(userId, LifecycleEvent.VIP_DOWNGRADE, { rfmScore: newScore });
    }
  }
}

/**
 * 处理流失预警
 */
export async function handleChurnWarning(
  userId: string,
  riskLevel: 'high' | 'medium' | 'low'
): Promise<void> {
  const service = getLifecycleService();
  const currentStage = await service.getUserStage(userId);

  if (currentStage === LifecycleStage.ACTIVE) {
    await service.handleTransition(userId, LifecycleEvent.CHURN_PREDICTED, { riskLevel });
  } else if (currentStage === LifecycleStage.DORMANT && riskLevel === 'high') {
    await service.handleTransition(userId, LifecycleEvent.CHURN_CONFIRMED, { riskLevel });
  }
}

/**
 * 处理流失召回成功
 */
export async function handleChurnRecall(userId: string, recallMethod: string): Promise<void> {
  const service = getLifecycleService();
  await service.handleTransition(userId, LifecycleEvent.REACTIVATION, { recallMethod });
}

// ============== 类型导出 ==============

export type {
  LifecycleState,
  StageTransitionRecord,
  TransitionResult,
  BatchTransitionResult,
  StageStatistics,
  StageDistribution,
  StageDefinition,
  TransitionRule,
  TransitionContext,
  LifecycleConfig,
};

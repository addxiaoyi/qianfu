/**
 * RFM 模型分析服务
 *
 * 功能:
 * - Recency (最近一次购买时间)
 * - Frequency (购买频率)
 * - Monetary (购买金额)
 * - 用户分群与价值评估
 * - 运营策略建议
 *
 * 依赖:
 * - server/services/cache: 分层缓存
 * - server/config/env: 配置管理
 * - server/lib/logger: 日志记录
 */

import { logger } from '../lib/logger';
import { env } from '../config/env';

// ============== 类型定义 ==============

/**
 * RFM 维度值
 */
export interface RFMValue {
  /** 最近一次购买距今天数 */
  recency: number;
  /** 购买次数 */
  frequency: number;
  /** 购买总金额 */
  monetary: number;
}

/**
 * RFM 评分 (1-5分)
 */
export interface RFMScore {
  /** 最近性评分 */
  r: number;
  /** 频率评分 */
  f: number;
  /** 金额评分 */
  m: number;
}

/**
 * RFM 综合评分 (3位数)
 */
export interface RFMCombinedScore {
  /** 综合评分 (如 "543", "321") */
  score: string;
  /** 评分数字 */
  value: number;
  /** 等级描述 */
  label: RFMLevel;
}

/**
 * RFM 用户等级
 */
export enum RFMLevel {
  CHAMPIONS = 'champions',           // 冠军用户: 555-544
  LOYAL_CUSTOMERS = 'loyal',         // 忠诚用户: 543-454
  POTENTIAL_LOYALIST = 'potential',   // 潜在忠诚: 445-344
  RECENT_CUSTOMERS = 'recent',        // 新用户: 335-334
  PROMISING = 'promising',            // 有潜力: 325-324
  NEEDS_ATTENTION = 'attention',     // 需要关注: 323-233
  AT_RISK = 'at_risk',               // 流失风险: 332-223
  CANT_LOSE_THEM = 'cant_lose',      // 重点挽留: 255-254
  LOST = 'lost',                     // 流失用户: 225-224
  HIBERNATING = 'hibernating',        // 休眠用户: 223-214
  LOST_CHEAP = 'lost_cheap',          // 低价值流失: 213-111
}

/**
 * 用户 RFM 分析结果
 */
export interface UserRFMAnalysis {
  /** 用户 ID */
  userId: string;
  /** 用户名称 */
  userName?: string;
  /** RFM 原始值 */
  value: RFMValue;
  /** RFM 评分 */
  score: RFMScore;
  /** 综合评分 */
  combinedScore: RFMCombinedScore;
  /** RFM 等级 */
  level: RFMLevel;
  /** 等级描述 */
  levelDescription: string;
  /** 运营建议 */
  strategy: RFMStrategy;
  /** 分析时间 */
  analyzedAt: Date;
}

/**
 * RFM 分群统计
 */
export interface RFMSegmentStats {
  /** 分群名称 */
  segment: RFMLevel;
  /** 用户数量 */
  userCount: number;
  /** 用户占比 */
  percentage: number;
  /** 平均最近天数 */
  avgRecency: number;
  /** 平均购买次数 */
  avgFrequency: number;
  /** 平均购买金额 */
  avgMonetary: number;
  /** 总金额贡献 */
  totalRevenue: number;
  /** 金额贡献占比 */
  revenuePercentage: number;
}

/**
 * RFM 分析报告
 */
export interface RFMReport {
  /** 报告生成时间 */
  generatedAt: Date;
  /** 分析时间范围 */
  dateRange: {
    start: Date;
    end: Date;
  };
  /** 用户总数 */
  totalUsers: number;
  /** 有效用户数 (有交易的) */
  activeUsers: number;
  /** 各分群统计 */
  segments: RFMSegmentStats[];
  /** 整体 RFM 平均值 */
  averages: {
    recency: number;
    frequency: number;
    monetary: number;
  };
  /** 金额分布 */
  monetaryDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
}

/**
 * RFM 运营策略
 */
export interface RFMStrategy {
  /** 策略名称 */
  name: string;
  /** 策略描述 */
  description: string;
  /** 建议优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 具体建议列表 */
  recommendations: string[];
  /** 预期效果 */
  expectedOutcome: string;
}

/**
 * RFM 配置
 */
export interface RFMConfig {
  /** 分析时段 (天) */
  analysisPeriodDays: number;
  /** R 评分阈值 */
  recencyThresholds: number[];
  /** F 评分阈值 */
  frequencyThresholds: number[];
  /** M 评分阈值 */
  monetaryThresholds: number[];
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存 TTL (毫秒) */
  cacheTtl: number;
}

/**
 * RFM 查询参数
 */
export interface RFMQueryParams {
  /** 用户 ID */
  userId?: string;
  /** 分群类型 */
  segment?: RFMLevel;
  /** 最小 R 评分 */
  minRScore?: number;
  /** 最小 F 评分 */
  minFScore?: number;
  /** 最小 M 评分 */
  minMScore?: number;
  /** 分页页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: 'recency' | 'frequency' | 'monetary' | 'score';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

// ============== 默认配置 ==============

const DEFAULT_CONFIG: RFMConfig = {
  analysisPeriodDays: 90,
  recencyThresholds: [7, 30, 60, 90],     // R 评分阈值 (天数)
  frequencyThresholds: [1, 3, 5, 10],        // F 评分阈值 (次数)
  monetaryThresholds: [100, 500, 1000, 5000], // M 评分阈值 (金额)
  enableCache: true,
  cacheTtl: 3600000, // 1小时
};

// ============== Mock 数据接口 (实际项目中应从数据库获取) =============

interface MockTransaction {
  userId: string;
  userName: string;
  amount: number;
  timestamp: Date;
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// ============== RFM 服务主类 =============

export class RFMService {
  private config: RFMConfig;
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  constructor(config: Partial<RFMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============== 公开方法 ==============

  /**
   * 分析单个用户 RFM
   */
  async analyzeUser(userId: string): Promise<UserRFMAnalysis | null> {
    // 检查缓存
    if (this.config.enableCache) {
      const cached = this.getFromCache(`user:${userId}`);
      if (cached) return cached;
    }

    // 获取用户交易数据
    const transactions = await this.getUserTransactions(userId);
    if (transactions.length === 0) {
      return null;
    }

    // 计算 RFM 值
    const value = this.calculateRFMValue(transactions);

    // 计算 RFM 评分
    const score = this.calculateRFMScore(value);

    // 计算综合评分
    const combinedScore = this.calculateCombinedScore(score);

    // 获取等级
    const level = this.getRFMLevel(combinedScore.score);

    // 获取策略建议
    const strategy = this.getStrategy(level, score);

    const analysis: UserRFMAnalysis = {
      userId,
      userName: transactions[0]?.userName,
      value,
      score,
      combinedScore,
      level,
      levelDescription: this.getLevelDescription(level),
      strategy,
      analyzedAt: new Date(),
    };

    // 缓存结果
    if (this.config.enableCache) {
      this.setCache(`user:${userId}`, analysis);
    }

    return analysis;
  }

  /**
   * 批量分析用户 RFM
   */
  async analyzeUsers(userIds: string[]): Promise<UserRFMAnalysis[]> {
    const results: UserRFMAnalysis[] = [];

    for (const userId of userIds) {
      const analysis = await this.analyzeUser(userId);
      if (analysis) {
        results.push(analysis);
      }
    }

    return results;
  }

  /**
   * 查询用户分群
   */
  async querySegment(params: RFMQueryParams): Promise<{
    users: UserRFMAnalysis[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      segment,
      minRScore,
      minFScore,
      minMScore,
      page = 1,
      pageSize = 20,
      sortBy = 'score',
      sortOrder = 'desc',
    } = params;

    // 获取所有用户分析数据
    let allUsers = await this.getAllUserAnalyses();

    // 筛选
    if (segment) {
      allUsers = allUsers.filter(u => u.level === segment);
    }
    if (minRScore) {
      allUsers = allUsers.filter(u => u.score.r >= minRScore);
    }
    if (minFScore) {
      allUsers = allUsers.filter(u => u.score.f >= minFScore);
    }
    if (minMScore) {
      allUsers = allUsers.filter(u => u.score.m >= minMScore);
    }

    // 排序
    allUsers.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortBy) {
        case 'recency':
          aVal = a.value.recency;
          bVal = b.value.recency;
          break;
        case 'frequency':
          aVal = a.value.frequency;
          bVal = b.value.frequency;
          break;
        case 'monetary':
          aVal = a.value.monetary;
          bVal = b.value.monetary;
          break;
        case 'score':
        default:
          aVal = a.combinedScore.value;
          bVal = b.combinedScore.value;
      }

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // 分页
    const total = allUsers.length;
    const start = (page - 1) * pageSize;
    const users = allUsers.slice(start, start + pageSize);

    return {
      users,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 生成 RFM 分析报告
   */
  async generateReport(): Promise<RFMReport> {
    // 检查缓存
    if (this.config.enableCache) {
      const cached = this.getFromCache('report');
      if (cached) return cached;
    }

    const allUsers = await this.getAllUserAnalyses();
    const now = new Date();
    const startDate = new Date(now.getTime() - this.config.analysisPeriodDays * 24 * 60 * 60 * 1000);

    // 计算各分群统计
    const segmentMap = new Map<RFMLevel, UserRFMAnalysis[]>();
    for (const user of allUsers) {
      const list = segmentMap.get(user.level) || [];
      list.push(user);
      segmentMap.set(user.level, list);
    }

    const segments: RFMSegmentStats[] = [];
    for (const [level, users] of segmentMap) {
      const avgRecency = users.reduce((sum, u) => sum + u.value.recency, 0) / users.length;
      const avgFrequency = users.reduce((sum, u) => sum + u.value.frequency, 0) / users.length;
      const avgMonetary = users.reduce((sum, u) => sum + u.value.monetary, 0) / users.length;
      const totalRevenue = users.reduce((sum, u) => sum + u.value.monetary, 0);

      segments.push({
        segment: level,
        userCount: users.length,
        percentage: (users.length / allUsers.length) * 100,
        avgRecency: Math.round(avgRecency * 10) / 10,
        avgFrequency: Math.round(avgFrequency * 10) / 10,
        avgMonetary: Math.round(avgMonetary * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenuePercentage: 0, // 稍后计算
      });
    }

    // 按用户数排序
    segments.sort((a, b) => b.userCount - a.userCount);

    // 计算金额占比
    const totalRevenue = segments.reduce((sum, s) => sum + s.totalRevenue, 0);
    for (const seg of segments) {
      seg.revenuePercentage = totalRevenue > 0
        ? Math.round((seg.totalRevenue / totalRevenue) * 10000) / 100
        : 0;
    }

    // 计算整体平均值
    const averages = {
      recency: allUsers.length > 0
        ? Math.round(allUsers.reduce((sum, u) => sum + u.value.recency, 0) / allUsers.length * 10) / 10
        : 0,
      frequency: allUsers.length > 0
        ? Math.round(allUsers.reduce((sum, u) => sum + u.value.frequency, 0) / allUsers.length * 10) / 10
        : 0,
      monetary: allUsers.length > 0
        ? Math.round(allUsers.reduce((sum, u) => sum + u.value.monetary, 0) / allUsers.length * 100) / 100
        : 0,
    };

    // 金额分布
    const monetaryDistribution = this.calculateMonetaryDistribution(allUsers);

    const report: RFMReport = {
      generatedAt: new Date(),
      dateRange: {
        start: startDate,
        end: now,
      },
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(u => u.value.frequency > 0).length,
      segments,
      averages,
      monetaryDistribution,
    };

    // 缓存报告
    if (this.config.enableCache) {
      this.setCache('report', report);
    }

    return report;
  }

  /**
   * 获取特定等级用户列表
   */
  async getUsersByLevel(level: RFMLevel): Promise<UserRFMAnalysis[]> {
    const allUsers = await this.getAllUserAnalyses();
    return allUsers.filter(u => u.level === level);
  }

  /**
   * 获取高价值用户 (评分 >= 444)
   */
  async getHighValueUsers(): Promise<UserRFMAnalysis[]> {
    const allUsers = await this.getAllUserAnalyses();
    return allUsers.filter(u => u.combinedScore.value >= 444);
  }

  /**
   * 获取流失风险用户 (评分 <= 222)
   */
  async getAtRiskUsers(): Promise<UserRFMAnalysis[]> {
    const allUsers = await this.getAllUserAnalyses();
    return allUsers.filter(u =>
      u.combinedScore.value <= 222 || u.level === RFMLevel.AT_RISK || u.level === RFMLevel.LOST
    );
  }

  // ============== 核心计算方法 ==============

  /**
   * 计算 RFM 值
   */
  private calculateRFMValue(transactions: MockTransaction[]): RFMValue {
    if (transactions.length === 0) {
      return { recency: 999, frequency: 0, monetary: 0 };
    }

    const now = new Date();
    const latestTransaction = transactions.reduce((latest, t) =>
      t.timestamp > latest.timestamp ? t : latest
    );
    const recency = Math.floor((now.getTime() - latestTransaction.timestamp.getTime()) / (1000 * 60 * 60 * 24));

    return {
      recency,
      frequency: transactions.length,
      monetary: transactions.reduce((sum, t) => sum + t.amount, 0),
    };
  }

  /**
   * 计算 RFM 评分 (1-5分)
   */
  private calculateRFMScore(value: RFMValue): RFMScore {
    const r = this.scoreRecency(value.recency);
    const f = this.scoreFrequency(value.frequency);
    const m = this.scoreMonetary(value.monetary);

    return { r, f, m };
  }

  /**
   * R 评分: 最近越好, 分越高
   */
  private scoreRecency(recency: number): number {
    const thresholds = this.config.recencyThresholds;
    if (recency <= thresholds[0]) return 5;
    if (recency <= thresholds[1]) return 4;
    if (recency <= thresholds[2]) return 3;
    if (recency <= thresholds[3]) return 2;
    return 1;
  }

  /**
   * F 评分: 频率越高, 分越高
   */
  private scoreFrequency(frequency: number): number {
    const thresholds = this.config.frequencyThresholds;
    if (frequency >= thresholds[3]) return 5;
    if (frequency >= thresholds[2]) return 4;
    if (frequency >= thresholds[1]) return 3;
    if (frequency >= thresholds[0]) return 2;
    return 1;
  }

  /**
   * M 评分: 金额越高, 分越高
   */
  private scoreMonetary(monetary: number): number {
    const thresholds = this.config.monetaryThresholds;
    if (monetary >= thresholds[3]) return 5;
    if (monetary >= thresholds[2]) return 4;
    if (monetary >= thresholds[1]) return 3;
    if (monetary >= thresholds[0]) return 2;
    return 1;
  }

  /**
   * 计算综合评分
   */
  private calculateCombinedScore(score: RFMScore): RFMCombinedScore {
    const scoreStr = `${score.r}${score.f}${score.m}`;
    const scoreValue = parseInt(scoreStr, 10);
    const level = this.getRFMLevel(scoreStr);

    return {
      score: scoreStr,
      value: scoreValue,
      label: level,
    };
  }

  /**
   * 获取 RFM 等级
   */
  private getRFMLevel(score: string): RFMLevel {
    const r = parseInt(score[0], 10);
    const f = parseInt(score[1], 10);
    const m = parseInt(score[2], 10);

    // 冠军用户
    if ((r >= 4 && f >= 4 && m >= 4) || score === '555' || score === '544') {
      return RFMLevel.CHAMPIONS;
    }

    // 忠诚用户
    if (r >= 3 && f >= 4 && m >= 4) {
      return RFMLevel.LOYAL_CUSTOMERS;
    }

    // 重点挽留
    if (r >= 2 && f >= 5 && m >= 4) {
      return RFMLevel.CANT_LOSE_THEM;
    }

    // 潜在忠诚
    if (r >= 4 && f >= 3 && m >= 3) {
      return RFMLevel.POTENTIAL_LOYALIST;
    }

    // 新用户
    if (r >= 3 && f >= 3 && m >= 3) {
      return RFMLevel.RECENT_CUSTOMERS;
    }

    // 有潜力
    if (r >= 3 && f >= 2 && m >= 2) {
      return RFMLevel.PROMISING;
    }

    // 需要关注
    if (r >= 3 && f >= 2 && m >= 2) {
      return RFMLevel.NEEDS_ATTENTION;
    }

    // 流失风险
    if (r <= 3 && f <= 3 && m >= 2) {
      return RFMLevel.AT_RISK;
    }

    // 流失用户
    if (r <= 2 && f <= 2 && m >= 2) {
      return RFMLevel.LOST;
    }

    // 休眠用户
    if (r <= 2 && f >= 2 && m >= 1) {
      return RFMLevel.HIBERNATING;
    }

    // 低价值流失
    return RFMLevel.LOST_CHEAP;
  }

  /**
   * 获取等级描述
   */
  private getLevelDescription(level: RFMLevel): string {
    const descriptions: Record<RFMLevel, string> = {
      [RFMLevel.CHAMPIONS]: '高价值核心用户，购买频繁、金额高、最近活跃',
      [RFMLevel.LOYAL_CUSTOMERS]: '忠诚用户，购买稳定，金额较高',
      [RFMLevel.CANT_LOSE_THEM]: '重要挽留用户，曾经高价值但近期活跃度下降',
      [RFMLevel.POTENTIAL_LOYALIST]: '潜在忠诚用户，有一定购买基础',
      [RFMLevel.RECENT_CUSTOMERS]: '新用户，刚刚开始消费',
      [RFMLevel.PROMISING]: '有潜力的用户，需要培养',
      [RFMLevel.NEEDS_ATTENTION]: '需要关注的中等价值用户',
      [RFMLevel.AT_RISK]: '流失风险用户，活跃度和消费下降',
      [RFMLevel.HIBERNATING]: '休眠用户，很久没有活跃',
      [RFMLevel.LOST]: '已流失用户，需要唤醒或放弃',
      [RFMLevel.LOST_CHEAP]: '低价值流失用户',
    };
    return descriptions[level];
  }

  /**
   * 获取运营策略
   */
  private getStrategy(level: RFMLevel, score: RFMScore): RFMStrategy {
    const strategies: Record<RFMLevel, RFMStrategy> = {
      [RFMLevel.CHAMPIONS]: {
        name: 'VIP 尊享服务',
        description: '为核心用户提供专属服务，增强品牌忠诚度',
        priority: 'high',
        recommendations: [
          '提供VIP专属折扣和权益',
          '邀请参与新品内测',
          '建立专属客户经理服务',
          '生日/节日特别关怀',
        ],
        expectedOutcome: '提升用户粘性，增加复购率',
      },
      [RFMLevel.LOYAL_CUSTOMERS]: {
        name: '忠诚度培养',
        description: '保持用户购买习惯，增加互动频率',
        priority: 'high',
        recommendations: [
          '积分兑换激励',
          '推荐奖励机制',
          '专属会员活动',
          '定期回访关怀',
        ],
        expectedOutcome: '提升用户生命周期价值',
      },
      [RFMLevel.CANT_LOSE_THEM]: {
        name: '紧急挽留',
        description: '高价值用户流失风险最高，需要立即行动',
        priority: 'high',
        recommendations: [
          '主动电话回访',
          '专属挽回优惠',
          '了解流失原因',
          '解决用户问题',
        ],
        expectedOutcome: '防止高价值用户流失',
      },
      [RFMLevel.POTENTIAL_LOYALIST]: {
        name: '升级培养',
        description: '培养潜在用户向高价值用户转化',
        priority: 'medium',
        recommendations: [
          '个性化推荐',
          '满额升级优惠',
          '订阅服务引导',
          '内容营销触达',
        ],
        expectedOutcome: '提升用户消费等级',
      },
      [RFMLevel.RECENT_CUSTOMERS]: {
        name: '新客转化',
        description: '抓住新用户第一印象，促进二次购买',
        priority: 'medium',
        recommendations: [
          '新客首单优惠',
          '新手引导教程',
          '产品组合推荐',
          '定期新品推送',
        ],
        expectedOutcome: '提高新客转化率',
      },
      [RFMLevel.PROMISING]: {
        name: '潜力激活',
        description: '激活有潜力但未充分消费的用户',
        priority: 'medium',
        recommendations: [
          '限时促销活动',
          '个性化优惠券',
          '用户反馈征集',
          '功能引导',
        ],
        expectedOutcome: '提升用户活跃度',
      },
      [RFMLevel.NEEDS_ATTENTION]: {
        name: '唤醒关注',
        description: '中等价值用户需要关注，防止进一步流失',
        priority: 'medium',
        recommendations: [
          '定向优惠推送',
          '内容召回策略',
          '签到奖励',
          '互动活动邀请',
        ],
        expectedOutcome: '提升用户活跃度和消费',
      },
      [RFMLevel.AT_RISK]: {
        name: '流失干预',
        description: '活跃度下降的用户需要干预挽回',
        priority: 'high',
        recommendations: [
          '流失预警触达',
          '专属挽回优惠',
          '调查问卷收集反馈',
          '电话/短信召回',
        ],
        expectedOutcome: '延缓或阻止用户流失',
      },
      [RFMLevel.HIBERNATING]: {
        name: '休眠唤醒',
        description: '长期不活跃用户需要强力唤醒',
        priority: 'low',
        recommendations: [
          '大额优惠券',
          '限时秒杀活动',
          'Push/短信召回',
          '考虑资源重新分配',
        ],
        expectedOutcome: '尝试唤醒休眠用户',
      },
      [RFMLevel.LOST]: {
        name: '流失召回',
        description: '已流失用户尝试最后一次召回',
        priority: 'low',
        recommendations: [
          '清仓/大促通知',
          '品牌活动邀请',
          '评估是否值得投入',
        ],
        expectedOutcome: '低成本尝试召回',
      },
      [RFMLevel.LOST_CHEAP]: {
        name: '价值重估',
        description: '低价值流失用户，考虑是否值得投入资源',
        priority: 'low',
        recommendations: [
          '自动化邮件营销',
          '不投入过多资源',
          '考虑移除或归档',
        ],
        expectedOutcome: '优化运营资源配置',
      },
    };
    return strategies[level];
  }

  /**
   * 计算金额分布
   */
  private calculateMonetaryDistribution(users: UserRFMAnalysis[]): RFMReport['monetaryDistribution'] {
    const ranges = [
      { label: '0-100', min: 0, max: 100 },
      { label: '100-500', min: 100, max: 500 },
      { label: '500-1000', min: 500, max: 1000 },
      { label: '1000-5000', min: 1000, max: 5000 },
      { label: '5000+', min: 5000, max: Infinity },
    ];

    return ranges.map(range => {
      const count = users.filter(u =>
        u.value.monetary >= range.min && u.value.monetary < range.max
      ).length;

      return {
        range: range.label,
        count,
        percentage: users.length > 0 ? Math.round((count / users.length) * 10000) / 100 : 0,
      };
    });
  }

  // ============== Mock 数据方法 (实际项目中替换为数据库查询) ==============

  /**
   * 获取用户交易数据
   * TODO: 替换为实际数据库查询
   */
  private async getUserTransactions(userId: string): Promise<MockTransaction[]> {
    // Mock 数据生成
    const now = new Date();
    const mockTransactions: MockTransaction[] = [];

    // 模拟生成 0-10 笔交易
    const transactionCount = Math.floor(Math.random() * 11);
    const userNames = ['张三', '李四', '王五', '赵六', '钱七'];

    for (let i = 0; i < transactionCount; i++) {
      const daysAgo = Math.floor(Math.random() * this.config.analysisPeriodDays);
      mockTransactions.push({
        userId,
        userName: userNames[Math.floor(Math.random() * userNames.length)],
        amount: Math.floor(Math.random() * 5000) + 50,
        timestamp: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      });
    }

    return mockTransactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取所有用户分析数据
   * TODO: 替换为实际数据库查询和缓存
   */
  private async getAllUserAnalyses(): Promise<UserRFMAnalysis[]> {
    // 检查缓存
    const cached = this.getFromCache('all_users');
    if (cached) return cached;

    // Mock 用户列表
    const mockUsers: MockUser[] = [];
    for (let i = 1; i <= 100; i++) {
      mockUsers.push({
        id: `user_${i}`,
        name: `用户${i}`,
        email: `user${i}@example.com`,
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      });
    }

    // 批量分析
    const analyses: UserRFMAnalysis[] = [];
    for (const user of mockUsers) {
      const transactions = await this.getUserTransactions(user.id);
      if (transactions.length > 0) {
        const value = this.calculateRFMValue(transactions);
        const score = this.calculateRFMScore(value);
        const combinedScore = this.calculateCombinedScore(score);
        const level = this.getRFMLevel(combinedScore.score);
        const strategy = this.getStrategy(level, score);

        analyses.push({
          userId: user.id,
          userName: user.name,
          value,
          score,
          combinedScore,
          level,
          levelDescription: this.getLevelDescription(level),
          strategy,
          analyzedAt: new Date(),
        });
      }
    }

    // 缓存结果
    this.setCache('all_users', analyses);

    return analyses;
  }

  // ============== 缓存方法 ==============

  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (item && item.expiry > Date.now()) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.config.cacheTtl,
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取服务配置
   */
  getConfig(): Readonly<RFMConfig> {
    return { ...this.config };
  }
}

// ============== 单例导出 ==============

let rfmServiceInstance: RFMService | null = null;

export function initRFMService(config?: Partial<RFMConfig>): RFMService {
  rfmServiceInstance = new RFMService(config);
  logger.info('[RFM] RFM service initialized');
  return rfmServiceInstance;
}

export function getRFMService(): RFMService {
  if (!rfmServiceInstance) {
    rfmServiceInstance = new RFMService();
  }
  return rfmServiceInstance;
}

// ============== 类型导出 ==============

export type {
  RFMValue,
  RFMScore,
  RFMCombinedScore,
  RFMLevel,
  UserRFMAnalysis,
  RFMSegmentStats,
  RFMReport,
  RFMStrategy,
  RFMConfig,
  RFMQueryParams,
};

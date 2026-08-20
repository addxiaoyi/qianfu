/**
 * 风控模型 - 欺诈检测核心模块
 * 优化项 404: 风控模型 - 欺诈检测
 *
 * 功能特性:
 * - 实时风险评分
 * - 异常行为检测
 * - 设备指纹识别
 * - IP信誉评估
 * - 速度检测
 * - 模式识别
 * - 规则引擎
 * - 机器学习风险评估
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as crypto from 'crypto';

// ============================================================
// Types - 风控配置
// ============================================================

export interface FraudDetectionConfig {
  // 基础配置
  enabled: boolean;
  // 风险评分阈值 (超过此分数标记为高风险)
  riskThreshold: number;
  // 记录保留天数
  retentionDays: number;

  // 速度检测配置
  velocityCheck: {
    enabled: boolean;
    // 时间窗口(毫秒)
    timeWindow: number;
    // 最大请求数
    maxRequests: number;
  };

  // 设备指纹配置
  deviceFingerprint: {
    enabled: boolean;
    // 新设备检测
    newDeviceAlert: boolean;
    // 模拟器检测
    emulatorDetection: boolean;
  };

  // IP信誉配置
  ipReputation: {
    enabled: boolean;
    // VPN/代理检测
    vpnProxyDetection: boolean;
    // TOR出口节点检测
    torExitNodeDetection: boolean;
    // 数据中心IP检测
    datacenterIpDetection: boolean;
  };

  // 行为分析配置
  behaviorAnalysis: {
    enabled: boolean;
    // 异常时间检测 (深夜操作)
    unusualTimeDetection: boolean;
    // 异常地点检测
    unusualLocationDetection: boolean;
    // 异常金额检测
    unusualAmountDetection: boolean;
  };

  // 规则引擎配置
  rules: {
    enabled: boolean;
    // 规则列表
    rules: FraudRule[];
  };

  // 机器学习配置
  ml: {
    enabled: boolean;
    // 模型类型: simple, advanced
    modelType: 'simple' | 'advanced';
    // 置信度阈值
    confidenceThreshold: number;
  };

  // 自动处置配置
  autoAction: {
    enabled: boolean;
    // 高风险处置: block, challenge, allow
    highRiskAction: 'block' | 'challenge' | 'allow';
    // 中风险处置
    mediumRiskAction: 'block' | 'challenge' | 'allow';
  };
}

export interface FraudRule {
  id: string;
  name: string;
  description: string;
  type: 'velocity' | 'pattern' | 'amount' | 'location' | 'device' | 'behavior' | 'custom';
  conditions: FraudCondition[];
  riskWeight: number; // 风险权重 (0-100)
  action: 'block' | 'challenge' | 'flag' | 'log';
  enabled: boolean;
}

export interface FraudCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'regex' | 'in' | 'between';
  value: any;
}

export interface FraudCheckRequest {
  userId: string;
  sessionId: string;
  eventType: FraudEventType;
  amount?: number;
  currency?: string;
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface FraudCheckResult {
  decisionId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  recommendedAction: 'block' | 'challenge' | 'allow';
  reason: string;
  details: FraudDetails;
  timestamp: string;
  processingTimeMs: number;
}

export interface RiskFactor {
  type: string;
  description: string;
  score: number;
  weight: number;
  evidence: Record<string, any>;
}

export interface FraudDetails {
  velocityCheck?: VelocityCheckResult;
  deviceCheck?: DeviceCheckResult;
  ipCheck?: IpCheckResult;
  behaviorCheck?: BehaviorCheckResult;
  rulesTriggered: string[];
  mlScore?: number;
}

export interface VelocityCheckResult {
  passed: boolean;
  requestsInWindow: number;
  windowSize: number;
  limit: number;
  score: number;
}

export interface DeviceCheckResult {
  passed: boolean;
  isNewDevice: boolean;
  isEmulator: boolean;
  isRooted: boolean;
  isVirtual: boolean;
  deviceAge?: number;
  score: number;
  fingerprint?: string;
}

export interface IpCheckResult {
  passed: boolean;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  isBlacklisted: boolean;
  country?: string;
  asn?: string;
  isp?: string;
  score: number;
}

export interface BehaviorCheckResult {
  passed: boolean;
  unusualTime: boolean;
  unusualLocation: boolean;
  unusualAmount: boolean;
  unusualPattern: boolean;
  score: number;
}

export enum FraudEventType {
  LOGIN = 'login',
  LOGIN_FAILED = 'login_failed',
  REGISTER = 'register',
  PASSWORD_RESET = 'password_reset',
  PASSWORD_CHANGE = 'password_change',
  TRANSACTION = 'transaction',
  TRANSFER = 'transfer',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
  PAYMENT = 'payment',
  UPDATE_PROFILE = 'update_profile',
  ADD_PAYMENT_METHOD = 'add_payment_method',
  API_REQUEST = 'api_request',
  DATA_EXPORT = 'data_export',
  PERMISSION_CHANGE = 'permission_change',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface FraudRecord {
  id: string;
  userId: string;
  decisionId: string;
  eventType: FraudEventType;
  riskScore: number;
  riskLevel: RiskLevel;
  recommendedAction: string;
  triggeredRules: string[];
  ip: string;
  deviceFingerprint?: string;
  userAgent?: string;
  location?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface DeviceProfile {
  fingerprint: string;
  userId: string;
  firstSeen: string;
  lastSeen: string;
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  isTrusted: boolean;
  riskScore: number;
}

export interface IpProfile {
  ip: string;
  firstSeen: string;
  lastSeen: string;
  totalRequests: number;
  failedAttempts: number;
  blockedAttempts: number;
  countries: string[];
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  isBlacklisted: boolean;
  riskScore: number;
}

// 默认配置
export const defaultFraudDetectionConfig: FraudDetectionConfig = {
  enabled: true,
  riskThreshold: 70,
  retentionDays: 90,

  velocityCheck: {
    enabled: true,
    timeWindow: 60000, // 1分钟
    maxRequests: 30,
  },

  deviceFingerprint: {
    enabled: true,
    newDeviceAlert: true,
    emulatorDetection: true,
  },

  ipReputation: {
    enabled: true,
    vpnProxyDetection: true,
    torExitNodeDetection: true,
    datacenterIpDetection: true,
  },

  behaviorAnalysis: {
    enabled: true,
    unusualTimeDetection: true,
    unusualLocationDetection: true,
    unusualAmountDetection: true,
  },

  rules: {
    enabled: true,
    rules: [
      {
        id: 'RULE-001',
        name: '高频登录失败',
        description: '同一账号短时间内多次登录失败',
        type: 'velocity',
        conditions: [
          { field: 'eventType', operator: 'eq', value: FraudEventType.LOGIN_FAILED },
          { field: 'attempts', operator: 'gte', value: 3 },
        ],
        riskWeight: 40,
        action: 'challenge',
        enabled: true,
      },
      {
        id: 'RULE-002',
        name: '大额异常交易',
        description: '单笔交易金额超过历史平均值的5倍',
        type: 'amount',
        conditions: [
          { field: 'eventType', operator: 'in', value: [FraudEventType.TRANSACTION, FraudEventType.TRANSFER] },
          { field: 'amountRatio', operator: 'gt', value: 5 },
        ],
        riskWeight: 50,
        action: 'challenge',
        enabled: true,
      },
      {
        id: 'RULE-003',
        name: '新设备大额转账',
        description: '新设备首次使用即进行大额转账',
        type: 'device',
        conditions: [
          { field: 'eventType', operator: 'in', value: [FraudEventType.TRANSFER, FraudEventType.WITHDRAWAL] },
          { field: 'isNewDevice', operator: 'eq', value: true },
          { field: 'amount', operator: 'gt', value: 10000 },
        ],
        riskWeight: 60,
        action: 'block',
        enabled: true,
      },
      {
        id: 'RULE-004',
        name: '高风险IP访问敏感操作',
        description: 'VPN/代理/TOR IP访问敏感操作',
        type: 'ip',
        conditions: [
          { field: 'isHighRiskIp', operator: 'eq', value: true },
          { field: 'eventType', operator: 'in', value: [FraudEventType.TRANSFER, FraudEventType.PAYMENT] },
        ],
        riskWeight: 45,
        action: 'challenge',
        enabled: true,
      },
      {
        id: 'RULE-005',
        name: '异常时间操作',
        description: '在深夜(00:00-05:00)进行敏感操作',
        type: 'behavior',
        conditions: [
          { field: 'eventType', operator: 'in', value: [FraudEventType.TRANSFER, FraudEventType.WITHDRAWAL] },
          { field: 'isUnusualTime', operator: 'eq', value: true },
        ],
        riskWeight: 20,
        action: 'flag',
        enabled: true,
      },
      {
        id: 'RULE-006',
        name: '异地登录',
        description: '短时间内从不同地区登录',
        type: 'location',
        conditions: [
          { field: 'eventType', operator: 'eq', value: FraudEventType.LOGIN },
          { field: 'locationChanged', operator: 'eq', value: true },
        ],
        riskWeight: 35,
        action: 'challenge',
        enabled: true,
      },
      {
        id: 'RULE-007',
        name: '模拟器访问',
        description: '使用模拟器或虚拟机访问',
        type: 'device',
        conditions: [
          { field: 'isEmulator', operator: 'eq', value: true },
          { field: 'eventType', operator: 'in', value: [FraudEventType.LOGIN, FraudEventType.REGISTER] },
        ],
        riskWeight: 55,
        action: 'block',
        enabled: true,
      },
    ],
  },

  ml: {
    enabled: true,
    modelType: 'simple',
    confidenceThreshold: 0.7,
  },

  autoAction: {
    enabled: true,
    highRiskAction: 'block',
    mediumRiskAction: 'challenge',
  },
};

// ============================================================
// 欺诈检测核心类
// ============================================================

export class FraudDetectionEngine {
  private config: FraudDetectionConfig;
  private velocityStore: Map<string, VelocityRecord[]> = new Map();
  private deviceProfiles: Map<string, DeviceProfile> = new Map();
  private ipProfiles: Map<string, IpProfile> = new Map();
  private fraudRecords: FraudRecord[] = [];
  private userHistory: Map<string, UserBehaviorHistory> = new Map();

  constructor(config: FraudDetectionConfig = defaultFraudDetectionConfig) {
    this.config = config;
    this.startCleanupScheduler();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<FraudDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): FraudDetectionConfig {
    return this.config;
  }

  /**
   * 执行欺诈检测
   */
  async check(request: FraudCheckRequest): Promise<FraudCheckResult> {
    const startTime = Date.now();
    const decisionId = this.generateDecisionId();

    const riskFactors: RiskFactor[] = [];
    const triggeredRules: string[] = [];

    // 1. 速度检测
    let velocityCheck: VelocityCheckResult | undefined;
    if (this.config.velocityCheck.enabled) {
      velocityCheck = this.performVelocityCheck(request);
      if (!velocityCheck.passed) {
        riskFactors.push({
          type: 'velocity',
          description: `在${velocityCheck.windowSize}ms内请求${velocityCheck.requestsInWindow}次，超过限制${velocityCheck.limit}`,
          score: velocityCheck.score,
          weight: 30,
          evidence: { ...velocityCheck },
        });
      }
    }

    // 2. 设备指纹检测
    let deviceCheck: DeviceCheckResult | undefined;
    if (this.config.deviceFingerprint.enabled && request.deviceFingerprint) {
      deviceCheck = this.performDeviceCheck(request);
      if (!deviceCheck.passed) {
        const deviceScore = deviceCheck.score;
        if (deviceScore > 0) {
          riskFactors.push({
            type: 'device',
            description: this.getDeviceRiskDescription(deviceCheck),
            score: deviceScore,
            weight: 25,
            evidence: { ...deviceCheck },
          });
        }
      }
    }

    // 3. IP信誉检测
    let ipCheck: IpCheckResult | undefined;
    if (this.config.ipReputation.enabled && request.ip) {
      ipCheck = this.performIpCheck(request);
      if (!ipCheck.passed) {
        const ipScore = ipCheck.score;
        if (ipScore > 0) {
          riskFactors.push({
            type: 'ip',
            description: this.getIpRiskDescription(ipCheck),
            score: ipScore,
            weight: 35,
            evidence: { ...ipCheck },
          });
        }
      }
    }

    // 4. 行为分析
    let behaviorCheck: BehaviorCheckResult | undefined;
    if (this.config.behaviorAnalysis.enabled) {
      behaviorCheck = this.performBehaviorCheck(request);
      if (!behaviorCheck.passed) {
        riskFactors.push({
          type: 'behavior',
          description: this.getBehaviorRiskDescription(behaviorCheck),
          score: behaviorCheck.score,
          weight: 20,
          evidence: { ...behaviorCheck },
        });
      }
    }

    // 5. 规则引擎检测
    if (this.config.rules.enabled) {
      const rulesResult = this.evaluateRules(request, {
        velocityCheck,
        deviceCheck,
        ipCheck,
        behaviorCheck,
      });

      rulesResult.triggeredRules.forEach((rule) => {
        triggeredRules.push(rule.id);
        riskFactors.push({
          type: 'rule',
          description: `${rule.name}: ${rule.description}`,
          score: rule.riskWeight,
          weight: rule.riskWeight,
          evidence: { ruleId: rule.id },
        });
      });
    }

    // 6. 机器学习风险评估
    let mlScore: number | undefined;
    if (this.config.ml.enabled) {
      mlScore = this.calculateMlScore(request, riskFactors);
      if (mlScore > 0.3) {
        riskFactors.push({
          type: 'ml',
          description: '机器学习模型检测到异常模式',
          score: Math.round(mlScore * 100),
          weight: 40,
          evidence: { mlScore, confidence: this.config.ml.confidenceThreshold },
        });
      }
    }

    // 计算总风险评分
    const riskScore = this.calculateRiskScore(riskFactors);

    // 确定风险等级
    const riskLevel = this.determineRiskLevel(riskScore);

    // 推荐处置
    const recommendedAction = this.determineAction(riskLevel, triggeredRules);

    // 生成原因描述
    const reason = this.generateReason(riskFactors, riskLevel);

    // 记录欺诈记录
    const fraudRecord: FraudRecord = {
      id: `FRAUD-${Date.now().toString(36).toUpperCase()}`,
      userId: request.userId,
      decisionId,
      eventType: request.eventType,
      riskScore,
      riskLevel,
      recommendedAction,
      triggeredRules,
      ip: request.ip || 'unknown',
      deviceFingerprint: request.deviceFingerprint,
      userAgent: request.userAgent,
      location: request.location ? `${request.location.country}/${request.location.city}` : undefined,
      metadata: request.metadata || {},
      createdAt: new Date().toISOString(),
    };
    this.fraudRecords.push(fraudRecord);

    // 更新设备档案
    if (request.deviceFingerprint) {
      this.updateDeviceProfile(request);
    }

    // 更新IP档案
    if (request.ip) {
      this.updateIpProfile(request);
    }

    // 更新用户行为历史
    this.updateUserHistory(request);

    const processingTimeMs = Date.now() - startTime;

    return {
      decisionId,
      riskScore,
      riskLevel,
      riskFactors,
      recommendedAction,
      reason,
      details: {
        velocityCheck,
        deviceCheck,
        ipCheck,
        behaviorCheck,
        rulesTriggered: triggeredRules,
        mlScore,
      },
      timestamp: new Date().toISOString(),
      processingTimeMs,
    };
  }

  /**
   * 速度检测
   */
  private performVelocityCheck(request: FraudCheckRequest): VelocityCheckResult {
    const key = `${request.userId}:${request.eventType}`;
    const now = Date.now();
    const window = this.config.velocityCheck.timeWindow;

    let records = this.velocityStore.get(key) || [];
    // 清理过期记录
    records = records.filter((r) => now - r.timestamp < window);
    records.push({ timestamp: now });

    this.velocityStore.set(key, records);

    const requestsInWindow = records.length;
    const limit = this.config.velocityCheck.maxRequests;
    const passed = requestsInWindow <= limit;

    // 计算分数 (超出越多分数越高)
    const exceededRatio = Math.max(0, (requestsInWindow - limit) / limit);
    const score = passed ? 0 : Math.min(100, Math.round(exceededRatio * 100));

    return {
      passed,
      requestsInWindow,
      windowSize: window,
      limit,
      score,
    };
  }

  /**
   * 设备指纹检测
   */
  private performDeviceCheck(request: FraudCheckRequest): DeviceCheckResult {
    const fingerprint = request.deviceFingerprint || this.generateFingerprint(request);
    const existingProfile = this.deviceProfiles.get(fingerprint);

    const isNewDevice = !existingProfile;
    const isEmulator = this.detectEmulator(request.userAgent);
    const isRooted = this.detectRooted(request.userAgent);
    const isVirtual = this.detectVirtual(request.userAgent);

    let score = 0;

    if (isEmulator) score += 40;
    if (isRooted) score += 30;
    if (isVirtual) score += 20;
    if (isNewDevice && this.config.deviceFingerprint.newDeviceAlert) {
      score += 15;
    }

    // 更新档案
    if (!existingProfile) {
      this.deviceProfiles.set(fingerprint, {
        fingerprint,
        userId: request.userId,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        userAgent: request.userAgent || '',
        isTrusted: false,
        riskScore: 0,
      });
    } else {
      existingProfile.lastSeen = new Date().toISOString();
      existingProfile.riskScore = Math.max(existingProfile.riskScore, score);
      this.deviceProfiles.set(fingerprint, existingProfile);
    }

    const passed = score < 30;

    return {
      passed,
      isNewDevice,
      isEmulator,
      isRooted,
      isVirtual,
      deviceAge: existingProfile ? Date.now() - new Date(existingProfile.firstSeen).getTime() : 0,
      score,
      fingerprint,
    };
  }

  /**
   * IP信誉检测
   */
  private performIpCheck(request: FraudCheckRequest): IpCheckResult {
    const ip = request.ip || 'unknown';
    const existingProfile = this.ipProfiles.get(ip);

    // 模拟IP检测 (实际应调用外部API)
    const isVpn = this.detectVpn(ip);
    const isProxy = this.detectProxy(ip);
    const isTor = this.detectTor(ip);
    const isDatacenter = this.detectDatacenter(ip);
    const isBlacklisted = existingProfile?.isBlacklisted || this.isIpBlacklisted(ip);

    // 从请求中提取IP信息
    const country = request.location?.country || this.getIpCountry(ip);
    const asn = this.getIpAsn(ip);
    const isp = this.getIpIsp(ip);

    let score = 0;

    if (isVpn) score += 30;
    if (isProxy) score += 35;
    if (isTor) score += 45;
    if (isDatacenter) score += 20;
    if (isBlacklisted) score += 100;

    // 更新档案
    if (!existingProfile) {
      this.ipProfiles.set(ip, {
        ip,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        totalRequests: 1,
        failedAttempts: 0,
        blockedAttempts: 0,
        countries: country ? [country] : [],
        isVpn,
        isProxy,
        isTor,
        isDatacenter,
        isBlacklisted,
        riskScore: score,
      });
    } else {
      existingProfile.lastSeen = new Date().toISOString();
      existingProfile.totalRequests++;
      existingProfile.riskScore = Math.max(existingProfile.riskScore, score);
      if (country && !existingProfile.countries.includes(country)) {
        existingProfile.countries.push(country);
      }
      this.ipProfiles.set(ip, existingProfile);
    }

    const passed = score < 30;

    return {
      passed,
      isVpn,
      isProxy,
      isTor,
      isDatacenter,
      isBlacklisted,
      country,
      asn,
      isp,
      score,
    };
  }

  /**
   * 行为分析
   */
  private performBehaviorCheck(request: FraudCheckRequest): BehaviorCheckResult {
    const history = this.userHistory.get(request.userId);
    const now = new Date();
    const hour = now.getHours();

    const unusualTime = hour >= 0 && hour <= 5; // 深夜0-5点
    const unusualAmount = request.amount
      ? this.isUnusualAmount(request.userId, request.amount, request.eventType)
      : false;
    const unusualPattern = history ? this.detectUnusualPattern(request, history) : false;

    // 异常地点检测需要历史数据
    let unusualLocation = false;
    if (history && request.location) {
      unusualLocation = this.detectUnusualLocation(request.location, history);
    }

    let score = 0;
    if (unusualTime && this.config.behaviorAnalysis.unusualTimeDetection) score += 15;
    if (unusualLocation && this.config.behaviorAnalysis.unusualLocationDetection) score += 25;
    if (unusualAmount && this.config.behaviorAnalysis.unusualAmountDetection) score += 30;
    if (unusualPattern) score += 20;

    const passed = score < 30;

    return {
      passed,
      unusualTime,
      unusualLocation,
      unusualAmount,
      unusualPattern,
      score,
    };
  }

  /**
   * 评估规则
   */
  private evaluateRules(
    request: FraudCheckRequest,
    checks: {
      velocityCheck?: VelocityCheckResult;
      deviceCheck?: DeviceCheckResult;
      ipCheck?: IpCheckResult;
      behaviorCheck?: BehaviorCheckResult;
    }
  ): { triggeredRules: FraudRule[] } {
    const triggeredRules: FraudRule[] = [];

    for (const rule of this.config.rules.rules) {
      if (!rule.enabled) continue;

      if (this.evaluateRule(rule, request, checks)) {
        triggeredRules.push(rule);
      }
    }

    return { triggeredRules };
  }

  /**
   * 评估单条规则
   */
  private evaluateRule(
    rule: FraudRule,
    request: FraudCheckRequest,
    checks: {
      velocityCheck?: VelocityCheckResult;
      deviceCheck?: DeviceCheckResult;
      ipCheck?: IpCheckResult;
      behaviorCheck?: BehaviorCheckResult;
    }
  ): boolean {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, request, checks)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 评估条件
   */
  private evaluateCondition(
    condition: FraudCondition,
    request: FraudCheckRequest,
    checks: {
      velocityCheck?: VelocityCheckResult;
      deviceCheck?: DeviceCheckResult;
      ipCheck?: IpCheckResult;
      behaviorCheck?: BehaviorCheckResult;
    }
  ): boolean {
    let fieldValue: any;

    // 获取字段值
    switch (condition.field) {
      case 'eventType':
        fieldValue = request.eventType;
        break;
      case 'amount':
        fieldValue = request.amount;
        break;
      case 'attempts':
        fieldValue = checks.velocityCheck?.requestsInWindow || 0;
        break;
      case 'isNewDevice':
        fieldValue = checks.deviceCheck?.isNewDevice || false;
        break;
      case 'isEmulator':
        fieldValue = checks.deviceCheck?.isEmulator || false;
        break;
      case 'isHighRiskIp':
        fieldValue =
          (checks.ipCheck?.isVpn ||
            checks.ipCheck?.isProxy ||
            checks.ipCheck?.isTor ||
            checks.ipCheck?.isDatacenter ||
            checks.ipCheck?.isBlacklisted) ||
          false;
        break;
      case 'isUnusualTime':
        fieldValue = checks.behaviorCheck?.unusualTime || false;
        break;
      case 'amountRatio':
        fieldValue = this.calculateAmountRatio(request.userId, request.amount || 0);
        break;
      case 'locationChanged':
        fieldValue = checks.behaviorCheck?.unusualLocation || false;
        break;
      default:
        fieldValue = (request.metadata as any)?.[condition.field];
    }

    // 评估操作符
    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > condition.value;
      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < condition.value;
      case 'gte':
        return typeof fieldValue === 'number' && fieldValue >= condition.value;
      case 'lte':
        return typeof fieldValue === 'number' && fieldValue <= condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value as string).test(String(fieldValue));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'between':
        return (
          typeof fieldValue === 'number' &&
          Array.isArray(condition.value) &&
          fieldValue >= condition.value[0] &&
          fieldValue <= condition.value[1]
        );
      default:
        return false;
    }
  }

  /**
   * 计算机器学习风险评分
   */
  private calculateMlScore(request: FraudCheckRequest, riskFactors: RiskFactor[]): number {
    if (this.config.ml.modelType === 'simple') {
      // 简单加权平均模型
      const weights = {
        velocity: 0.2,
        device: 0.25,
        ip: 0.3,
        behavior: 0.15,
        rule: 0.1,
      };

      const scores = {
        velocity: riskFactors
          .filter((f) => f.type === 'velocity')
          .reduce((sum, f) => sum + f.score * weights.velocity, 0),
        device: riskFactors
          .filter((f) => f.type === 'device')
          .reduce((sum, f) => sum + f.score * weights.device, 0),
        ip: riskFactors
          .filter((f) => f.type === 'ip')
          .reduce((sum, f) => sum + f.score * weights.ip, 0),
        behavior: riskFactors
          .filter((f) => f.type === 'behavior')
          .reduce((sum, f) => sum + f.score * weights.behavior, 0),
        rule: riskFactors
          .filter((f) => f.type === 'rule')
          .reduce((sum, f) => sum + f.score * weights.rule, 0),
      };

      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
      return Math.min(1, totalScore / 100);
    }

    // 高级模型 (可扩展)
    return 0;
  }

  /**
   * 计算总风险评分
   */
  private calculateRiskScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0;

    // 加权平均
    const weightedSum = riskFactors.reduce((sum, factor) => sum + factor.score * (factor.weight / 100), 0);
    const totalWeight = riskFactors.reduce((sum, factor) => sum + factor.weight, 0);

    const normalizedScore = totalWeight > 0 ? (weightedSum / totalWeight) * (100 / totalWeight) : 0;

    return Math.min(100, Math.round(normalizedScore));
  }

  /**
   * 确定风险等级
   */
  private determineRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 80) return RiskLevel.CRITICAL;
    if (riskScore >= 60) return RiskLevel.HIGH;
    if (riskScore >= 30) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * 确定推荐处置
   */
  private determineAction(riskLevel: RiskLevel, triggeredRules: string[]): 'block' | 'challenge' | 'allow' {
    // 先检查触发的规则
    for (const ruleId of triggeredRules) {
      const rule = this.config.rules.rules.find((r) => r.id === ruleId);
      if (rule && rule.action === 'block') {
        return 'block';
      }
    }

    // 根据风险等级
    if (!this.config.autoAction.enabled) {
      return 'allow';
    }

    switch (riskLevel) {
      case RiskLevel.CRITICAL:
      case RiskLevel.HIGH:
        return this.config.autoAction.highRiskAction;
      case RiskLevel.MEDIUM:
        return this.config.autoAction.mediumRiskAction;
      default:
        return 'allow';
    }
  }

  /**
   * 生成原因描述
   */
  private generateReason(riskFactors: RiskFactor[], riskLevel: RiskLevel): string {
    if (riskFactors.length === 0) {
      return '未检测到异常';
    }

    const topFactors = riskFactors.sort((a, b) => b.score - a.score).slice(0, 3);
    const descriptions = topFactors.map((f) => f.description);

    return `检测到${topFactors.length}个风险因素: ${descriptions.join('; ')}`;
  }

  // ==================== 辅助方法 ====================

  private generateDecisionId(): string {
    return `FD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private generateFingerprint(request: FraudCheckRequest): string {
    const data = `${request.userAgent || ''}${request.ip || ''}${request.userId}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  private getDeviceRiskDescription(check: DeviceCheckResult): string {
    const reasons: string[] = [];
    if (check.isEmulator) reasons.push('检测到模拟器');
    if (check.isRooted) reasons.push('检测到ROOT设备');
    if (check.isVirtual) reasons.push('检测到虚拟机');
    if (check.isNewDevice) reasons.push('新设备首次访问');
    return reasons.join('; ') || '无异常';
  }

  private getIpRiskDescription(check: IpCheckResult): string {
    const reasons: string[] = [];
    if (check.isVpn) reasons.push('VPN连接');
    if (check.isProxy) reasons.push('代理服务器');
    if (check.isTor) reasons.push('TOR出口节点');
    if (check.isDatacenter) reasons.push('数据中心IP');
    if (check.isBlacklisted) reasons.push('IP在黑名单中');
    return reasons.join('; ') || '无异常';
  }

  private getBehaviorRiskDescription(check: BehaviorCheckResult): string {
    const reasons: string[] = [];
    if (check.unusualTime) reasons.push('异常时间段操作');
    if (check.unusualLocation) reasons.push('异地操作');
    if (check.unusualAmount) reasons.push('异常金额');
    if (check.unusualPattern) reasons.push('异常行为模式');
    return reasons.join('; ') || '无异常';
  }

  // 模拟检测方法 (实际应调用外部API)
  private detectEmulator(userAgent?: string): boolean {
    if (!userAgent) return false;
    const emulators = ['android emulator', 'iphone simulator', 'ipad simulator', 'bluestacks', 'nox', 'genymotion'];
    return emulators.some((e) => userAgent.toLowerCase().includes(e));
  }

  private detectRooted(userAgent?: string): boolean {
    if (!userAgent) return false;
    return userAgent.toLowerCase().includes('rooted') || userAgent.toLowerCase().includes('root');
  }

  private detectVirtual(userAgent?: string): boolean {
    if (!userAgent) return false;
    const virtuals = ['virtualbox', 'vmware', 'qemu', 'parallels', 'hyper-v', 'xen'];
    return virtuals.some((v) => userAgent.toLowerCase().includes(v));
  }

  private detectVpn(ip: string): boolean {
    // 简化实现，实际应查询VPN数据库
    const vpnPatterns = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.30.', '172.31.', '192.168.'];
    return vpnPatterns.some((p) => ip.startsWith(p));
  }

  private detectProxy(ip: string): boolean {
    // 简化实现
    return false;
  }

  private detectTor(ip: string): boolean {
    // 简化实现，实际应查询TOR出口节点列表
    return false;
  }

  private detectDatacenter(ip: string): boolean {
    // 简化实现
    return false;
  }

  private isIpBlacklisted(ip: string): boolean {
    const existing = this.ipProfiles.get(ip);
    return existing?.isBlacklisted || false;
  }

  private getIpCountry(ip: string): string | undefined {
    // 简化实现，实际应调用GeoIP服务
    return undefined;
  }

  private getIpAsn(ip: string): string | undefined {
    return undefined;
  }

  private getIpIsp(ip: string): string | undefined {
    return undefined;
  }

  private isUnusualAmount(userId: string, amount: number, eventType: FraudEventType): boolean {
    const history = this.userHistory.get(userId);
    if (!history || history.transactions.length === 0) return false;

    const avgAmount =
      history.transactions.reduce((sum, t) => sum + t.amount, 0) / history.transactions.length;
    const threshold = avgAmount * 5;

    return amount > threshold;
  }

  private calculateAmountRatio(userId: string, amount: number): number {
    const history = this.userHistory.get(userId);
    if (!history || history.transactions.length === 0) return 1;

    const avgAmount =
      history.transactions.reduce((sum, t) => sum + t.amount, 0) / history.transactions.length;
    return avgAmount > 0 ? amount / avgAmount : 1;
  }

  private detectUnusualPattern(
    request: FraudCheckRequest,
    history: UserBehaviorHistory
  ): boolean {
    // 简化实现
    if (history.events.length < 5) return false;

    // 检测短时间内事件类型突变
    const recentEvents = history.events.slice(-5);
    const eventTypes = new Set(recentEvents.map((e) => e.eventType));

    // 如果5个事件中有4种以上不同类型，可能异常
    return eventTypes.size >= 4;
  }

  private detectUnusualLocation(
    location: { country?: string; region?: string; city?: string },
    history: UserBehaviorHistory
  ): boolean {
    if (!location.country) return false;

    // 如果当前位置国家与历史记录都不同，且历史中有多个不同国家，标记为异常
    const uniqueCountries = new Set(history.events.map((e) => e.location?.country).filter(Boolean));
    if (uniqueCountries.size > 1 && !uniqueCountries.has(location.country)) {
      // 检查时间间隔 - 如果两个不同地点的操作间隔太短，标记为可疑
      const lastEvent = history.events[history.events.length - 1];
      if (lastEvent && lastEvent.location?.country !== location.country) {
        return true;
      }
    }

    return false;
  }

  private updateDeviceProfile(request: FraudCheckRequest): void {
    const fingerprint = request.deviceFingerprint || this.generateFingerprint(request);
    const existing = this.deviceProfiles.get(fingerprint);

    if (existing) {
      existing.lastSeen = new Date().toISOString();
      existing.userAgent = request.userAgent || existing.userAgent;
      this.deviceProfiles.set(fingerprint, existing);
    }
  }

  private updateIpProfile(request: FraudCheckRequest): void {
    const ip = request.ip || 'unknown';
    const existing = this.ipProfiles.get(ip);

    if (existing) {
      existing.lastSeen = new Date().toISOString();
      existing.totalRequests++;
      if (request.location?.country && !existing.countries.includes(request.location.country)) {
        existing.countries.push(request.location.country);
      }
      this.ipProfiles.set(ip, existing);
    }
  }

  private updateUserHistory(request: FraudCheckRequest): void {
    let history = this.userHistory.get(request.userId);

    if (!history) {
      history = {
        events: [],
        transactions: [],
        locations: [],
        lastEventTime: 0,
        failedAttempts: 0,
      };
      this.userHistory.set(request.userId, history);
    }

    history.events.push({
      eventType: request.eventType,
      timestamp: Date.now(),
      location: request.location,
    });

    // 只保留最近100个事件
    if (history.events.length > 100) {
      history.events = history.events.slice(-100);
    }

    // 更新最后事件时间
    history.lastEventTime = Date.now();

    // 记录交易
    if (
      request.amount &&
      [
        FraudEventType.TRANSACTION,
        FraudEventType.TRANSFER,
        FraudEventType.WITHDRAWAL,
        FraudEventType.PAYMENT,
      ].includes(request.eventType)
    ) {
      history.transactions.push({
        amount: request.amount,
        currency: request.currency || 'CNY',
        eventType: request.eventType,
        timestamp: Date.now(),
      });

      // 只保留最近100笔交易
      if (history.transactions.length > 100) {
        history.transactions = history.transactions.slice(-100);
      }
    }

    // 记录登录失败
    if (request.eventType === FraudEventType.LOGIN_FAILED) {
      history.failedAttempts++;
    }

    this.userHistory.set(request.userId, history);
  }

  /**
   * 清理调度器
   */
  private startCleanupScheduler(): void {
    // 每小时清理一次过期数据
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;

    // 清理速度记录
    for (const [key, records] of this.velocityStore.entries()) {
      const filtered = records.filter((r) => now - r.timestamp < this.config.velocityCheck.timeWindow);
      if (filtered.length === 0) {
        this.velocityStore.delete(key);
      } else {
        this.velocityStore.set(key, filtered);
      }
    }

    // 清理欺诈记录
    this.fraudRecords = this.fraudRecords.filter(
      (r) => now - new Date(r.createdAt).getTime() < retentionMs
    );

    // 清理用户历史
    for (const [userId, history] of this.userHistory.entries()) {
      const recentEvents = history.events.filter((e) => now - e.timestamp < retentionMs);
      const recentTransactions = history.transactions.filter((t) => now - t.timestamp < retentionMs);

      if (recentEvents.length === 0 && recentTransactions.length === 0) {
        this.userHistory.delete(userId);
      } else {
        history.events = recentEvents;
        history.transactions = recentTransactions;
        this.userHistory.set(userId, history);
      }
    }
  }

  // ==================== 数据访问方法 ====================

  /**
   * 获取欺诈记录
   */
  getFraudRecords(filters?: {
    userId?: string;
    riskLevel?: RiskLevel;
    startDate?: string;
    endDate?: string;
  }): FraudRecord[] {
    let records = this.fraudRecords;

    if (filters?.userId) {
      records = records.filter((r) => r.userId === filters.userId);
    }
    if (filters?.riskLevel) {
      records = records.filter((r) => r.riskLevel === filters.riskLevel);
    }
    if (filters?.startDate) {
      records = records.filter((r) => r.createdAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      records = records.filter((r) => r.createdAt <= filters.endDate!);
    }

    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 获取设备档案
   */
  getDeviceProfile(fingerprint: string): DeviceProfile | undefined {
    return this.deviceProfiles.get(fingerprint);
  }

  /**
   * 获取IP档案
   */
  getIpProfile(ip: string): IpProfile | undefined {
    return this.ipProfiles.get(ip);
  }

  /**
   * 获取用户行为历史
   */
  getUserHistory(userId: string): UserBehaviorHistory | undefined {
    return this.userHistory.get(userId);
  }

  /**
   * 添加IP到黑名单
   */
  blacklistIp(ip: string): void {
    let profile = this.ipProfiles.get(ip);
    if (!profile) {
      profile = {
        ip,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        totalRequests: 0,
        failedAttempts: 0,
        blockedAttempts: 0,
        countries: [],
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        isBlacklisted: true,
        riskScore: 100,
      };
    } else {
      profile.isBlacklisted = true;
      profile.riskScore = 100;
    }
    this.ipProfiles.set(ip, profile);
  }

  /**
   * 从黑名单移除IP
   */
  unblacklistIp(ip: string): void {
    const profile = this.ipProfiles.get(ip);
    if (profile) {
      profile.isBlacklisted = false;
      this.ipProfiles.set(ip, profile);
    }
  }

  /**
   * 获取统计数据
   */
  getStatistics(): FraudStatistics {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const lastHour = this.fraudRecords.filter((r) => new Date(r.createdAt).getTime() > hourAgo);
    const lastDay = this.fraudRecords.filter((r) => new Date(r.createdAt).getTime() > dayAgo);

    return {
      totalRecords: this.fraudRecords.length,
      recordsLastHour: lastHour.length,
      recordsLastDay: lastDay.length,
      highRiskCount: this.fraudRecords.filter((r) => r.riskLevel === RiskLevel.HIGH).length,
      criticalRiskCount: this.fraudRecords.filter((r) => r.riskLevel === RiskLevel.CRITICAL).length,
      blockedCount: this.fraudRecords.filter((r) => r.recommendedAction === 'block').length,
      challengedCount: this.fraudRecords.filter((r) => r.recommendedAction === 'challenge').length,
      uniqueUsersMonitored: this.userHistory.size,
      uniqueIpsMonitored: this.ipProfiles.size,
      uniqueDevicesMonitored: this.deviceProfiles.size,
    };
  }
}

// ============================================================
// Types - 辅助
// ============================================================

interface VelocityRecord {
  timestamp: number;
}

interface UserBehaviorHistory {
  events: {
    eventType: FraudEventType;
    timestamp: number;
    location?: {
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    };
  }[];
  transactions: {
    amount: number;
    currency: string;
    eventType: FraudEventType;
    timestamp: number;
  }[];
  locations: string[];
  lastEventTime: number;
  failedAttempts: number;
}

export interface FraudStatistics {
  totalRecords: number;
  recordsLastHour: number;
  recordsLastDay: number;
  highRiskCount: number;
  criticalRiskCount: number;
  blockedCount: number;
  challengedCount: number;
  uniqueUsersMonitored: number;
  uniqueIpsMonitored: number;
  uniqueDevicesMonitored: number;
}

// ============================================================
// 导出单例
// ============================================================

let fraudDetectionEngine: FraudDetectionEngine;

export function getFraudDetectionEngine(config?: FraudDetectionConfig): FraudDetectionEngine {
  if (!fraudDetectionEngine) {
    fraudDetectionEngine = new FraudDetectionEngine(config);
  }
  return fraudDetectionEngine;
}

export function initializeFraudDetection(config?: FraudDetectionConfig): FraudDetectionEngine {
  fraudDetectionEngine = new FraudDetectionEngine(config);
  return fraudDetectionEngine;
}

export { FraudDetectionEngine as FraudEngine };

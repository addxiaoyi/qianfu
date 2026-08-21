/**
 * 欺诈检测使用示例
 * 优化项 404: 风控模型 - 欺诈检测
 *
 * 本文件展示如何在项目中使用欺诈检测功能的各种场景
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  // 引擎
  initializeFraudDetection,
  getFraudDetectionEngine,
  FraudDetectionEngine,

  // 配置
  FraudDetectionConfig,
  defaultFraudDetectionConfig,

  // 请求/结果
  FraudCheckRequest,
  FraudCheckResult,
  FraudEventType,
  RiskLevel,

  // 中间件
  fraudDetectionMiddleware,
  loginFraudDetectionMiddleware,
  registerFraudDetectionMiddleware,
  transactionFraudDetectionMiddleware,

  // 路由
  fraudRoutes,
} from './server/middleware';

// ============================================================
// 场景1: 基本初始化和使用
// ============================================================

export function setupFraudDetection() {
  // 方式1: 使用默认配置
  const engine = initializeFraudDetection();

  // 方式2: 自定义配置
  const customConfig: FraudDetectionConfig = {
    ...defaultFraudDetectionConfig,
    enabled: true,
    riskThreshold: 70,
    velocityCheck: {
      enabled: true,
      timeWindow: 60000, // 1分钟
      maxRequests: 30,
    },
    autoAction: {
      enabled: true,
      highRiskAction: 'block',
      mediumRiskAction: 'challenge',
    },
  };
  const customEngine = initializeFraudDetection(customConfig);

  return customEngine;
}

// ============================================================
// 场景2: Express中间件使用
// ============================================================

export function setupFraudRoutes(app: any) {
  // 方式1: 注册API路由
  app.use('/api/fraud', fraudRoutes);

  // 方式2: 应用全局中间件
  app.use('/api', fraudDetectionMiddleware({
    eventType: FraudEventType.API_REQUEST,
    skipPaths: ['/health', '/metrics'],
  }));

  // 方式3: 针对特定路由应用中间件
  const fraudRouter = Router();

  // 登录
  fraudRouter.post('/login', loginFraudDetectionMiddleware(), loginHandler);

  // 注册
  fraudRouter.post('/register', registerFraudDetectionMiddleware(), registerHandler);

  // 交易
  fraudRouter.post('/transaction', transactionFraudDetectionMiddleware(), transactionHandler);

  // 自定义交易检测（带金额）
  fraudRouter.post('/payment', async (req: Request, res: Response, next: NextFunction) => {
    const engine = getFraudDetectionEngine();

    const result = await engine.check({
      userId: (req as any).userId,
      sessionId: (req as any).sessionId,
      eventType: FraudEventType.TRANSACTION,
      amount: req.body.amount,
      currency: req.body.currency,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      location: {
        country: req.headers['x-country'] as string,
        city: req.headers['x-city'] as string,
      },
      metadata: {
        orderId: req.body.orderId,
        paymentMethod: req.body.paymentMethod,
      },
    });

    // 将结果附加到请求
    (req as any).fraudResult = result;

    // 根据风险等级处理
    if (result.recommendedAction === 'block') {
      res.status(403).json({
        success: false,
        error: 'FRAUD_BLOCKED',
        message: '交易被风控拦截',
        riskLevel: result.riskLevel,
      });
      return;
    }

    if (result.recommendedAction === 'challenge') {
      res.status(200).json({
        success: true,
        challenge: true,
        message: '需要进行额外验证',
        riskLevel: result.riskLevel,
      });
      return;
    }

    next();
  }, paymentHandler);
}

// ============================================================
// 场景3: 直接调用检测
// ============================================================

export async function checkTransaction(req: Request): Promise<FraudCheckResult> {
  const engine = getFraudDetectionEngine();

  const request: FraudCheckRequest = {
    userId: (req as any).userId,
    sessionId: (req as any).sessionId,
    eventType: FraudEventType.TRANSFER,
    amount: req.body.amount,
    currency: req.body.currency || 'CNY',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    deviceFingerprint: req.headers['x-device-fingerprint'] as string,
    location: {
      country: req.headers['cf-ipcountry'] as string || 'unknown',
      region: req.headers['x-region'] as string,
      city: req.headers['x-city'] as string,
    },
    metadata: {
      orderId: req.body.orderId,
      recipientId: req.body.recipientId,
      recipientBank: req.body.recipientBank,
    },
  };

  return engine.check(request);
}

// ============================================================
// 场景4: 批量检测
// ============================================================

export async function batchCheckFraud(
  requests: FraudCheckRequest[]
): Promise<FraudCheckResult[]> {
  const engine = getFraudDetectionEngine();
  const results = await Promise.all(
    requests.map((request) => engine.check(request))
  );
  return results;
}

// ============================================================
// 场景5: 自定义规则
// ============================================================

export function addCustomRule() {
  const engine = getFraudDetectionEngine();
  const config = engine.getConfig();

  // 添加新规则
  config.rules.rules.push({
    id: 'CUSTOM-001',
    name: '大额短时间多次转账',
    description: '单用户24小时内转账超过5次且总金额超过10万',
    type: 'velocity',
    conditions: [
      { field: 'eventType', operator: 'in', value: [FraudEventType.TRANSFER, FraudEventType.WITHDRAWAL] },
      { field: 'frequency24h', operator: 'gt', value: 5 },
      { field: 'amount24h', operator: 'gt', value: 100000 },
    ],
    riskWeight: 65,
    action: 'block',
    enabled: true,
  });

  // 添加另一条规则
  config.rules.rules.push({
    id: 'CUSTOM-002',
    name: '新用户首单高风险地区',
    description: '注册时间少于24小时的用户从高风险地区发起首单',
    type: 'location',
    conditions: [
      { field: 'eventType', operator: 'in', value: [FraudEventType.TRANSACTION] },
      { field: 'userAgeHours', operator: 'lt', value: 24 },
      { field: 'isHighRiskCountry', operator: 'eq', value: true },
    ],
    riskWeight: 55,
    action: 'challenge',
    enabled: true,
  });

  engine.updateConfig(config);
}

// ============================================================
// 场景6: IP管理
// ============================================================

export function manageBlacklist() {
  const engine = getFraudDetectionEngine();

  // 封禁可疑IP
  engine.blacklistIp('1.2.3.4');

  // 批量封禁
  const suspiciousIps = ['5.6.7.8', '9.10.11.12', '13.14.15.16'];
  suspiciousIps.forEach((ip) => engine.blacklistIp(ip));

  // 解除封禁
  engine.unblacklistIp('1.2.3.4');

  // 查询IP档案
  const profile = engine.getIpProfile('1.2.3.4');
  if (profile) {
    console.log('IP档案:', {
      总请求数: profile.totalRequests,
      失败尝试: profile.failedAttempts,
      被阻止次数: profile.blockedAttempts,
      VPN: profile.isVpn,
      代理: profile.isProxy,
      TOR: profile.isTor,
      黑名单: profile.isBlacklisted,
      风险评分: profile.riskScore,
    });
  }
}

// ============================================================
// 场景7: 统计数据和监控
// ============================================================

export function fraudMonitoring() {
  const engine = getFraudDetectionEngine();

  // 获取统计数据
  const stats = engine.getStatistics();
  console.log('风控统计:', {
    总记录数: stats.totalRecords,
    最近1小时: stats.recordsLastHour,
    最近24小时: stats.recordsLastDay,
    高风险数: stats.highRiskCount,
    严重风险数: stats.criticalRiskCount,
    已拦截数: stats.blockedCount,
    挑战验证数: stats.challengedCount,
    监控用户数: stats.uniqueUsersMonitored,
    监控IP数: stats.uniqueIpsMonitored,
    监控设备数: stats.uniqueDevicesMonitored,
  });

  // 查询高风险记录
  const highRiskRecords = engine.getFraudRecords({
    riskLevel: RiskLevel.HIGH,
  });

  // 查询特定用户记录
  const userRecords = engine.getFraudRecords({
    userId: 'user123',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // 查询被拦截的记录
  const blockedRecords = engine.getFraudRecords({
    riskLevel: RiskLevel.CRITICAL,
  });

  return { stats, highRiskRecords, userRecords, blockedRecords };
}

// ============================================================
// 场景8: 用户行为历史
// ============================================================

export function analyzeUserBehavior(userId: string) {
  const engine = getFraudDetectionEngine();

  // 获取用户历史
  const history = engine.getUserHistory(userId);
  if (!history) {
    return null;
  }

  // 计算统计
  const recentEvents = history.events.slice(-10);
  const recentTransactions = history.transactions.slice(-10);

  const totalAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
  const avgAmount = recentTransactions.length > 0 ? totalAmount / recentTransactions.length : 0;

  // 检测异常模式
  const eventTypes = new Set(recentEvents.map((e) => e.eventType));
  const uniqueLocations = new Set(history.locations);

  return {
    最近事件数: recentEvents.length,
    最近交易数: recentTransactions.length,
    最近交易总额: totalAmount,
    最近平均金额: avgAmount,
    事件类型多样性: eventTypes.size,
    访问地点数: uniqueLocations.size,
    失败尝试次数: history.failedAttempts,
    最后活跃时间: new Date(history.lastEventTime).toISOString(),
  };
}

// ============================================================
// 场景9: 实时告警
// ============================================================

export function setupFraudAlerts() {
  const engine = getFraudDetectionEngine();

  // 轮询高风险事件
  setInterval(async () => {
    const criticalRecords = engine.getFraudRecords({
      riskLevel: RiskLevel.CRITICAL,
    });

    if (criticalRecords.length > 0) {
      // 发送告警
      console.error('[FRAUD-ALERT] 严重风险事件:', {
        数量: criticalRecords.length,
        最新事件: criticalRecords[0],
      });

      // 可以集成:
      // - 发送邮件
      // - 发送Slack消息
      // - 发送钉钉/飞书通知
      // - 创建安全工单
    }
  }, 60000); // 每分钟检查一次
}

// ============================================================
// 场景10: 规则动态调整
// ============================================================

export function adjustFraudRules(context: 'normal' | 'high_risk_period') {
  const engine = getFraudDetectionEngine();

  if (context === 'high_risk_period') {
    // 活动期间提高风控等级
    engine.updateConfig({
      riskThreshold: 50, // 降低阈值，更敏感
      velocityCheck: {
        enabled: true,
        timeWindow: 30000, // 更短的时间窗口
        maxRequests: 10, // 更严格的限制
      },
      autoAction: {
        enabled: true,
        highRiskAction: 'block',
        mediumRiskAction: 'block', // 中风险也拦截
      },
    });

    // 禁用部分规则
    const config = engine.getConfig();
    config.rules.rules = config.rules.rules.map((rule) => ({
      ...rule,
      enabled: rule.riskWeight >= 30, // 只启用高权重规则
    }));
    engine.updateConfig(config);
  } else {
    // 恢复正常配置
    initializeFraudDetection(defaultFraudDetectionConfig);
  }
}

// ============================================================
// 场景11: 与现有系统集成
// ============================================================

// 集成认证模块
export async function checkWithAuth(req: Request) {
  const userId = (req as any).userId;
  const sessionId = (req as any).sessionId;

  if (!userId) {
    // 未登录用户使用IP作为标识
    const engine = getFraudDetectionEngine();
    const ipProfile = engine.getIpProfile(req.ip!);

    if (ipProfile && ipProfile.riskScore > 80) {
      return {
        allowed: false,
        reason: 'IP风险评分过高',
        riskScore: ipProfile.riskScore,
      };
    }
  }

  // 继续执行欺诈检测
  return checkTransaction(req);
}

// ============================================================
// 场景12: 设备指纹管理
// ============================================================

export function manageDevices(userId: string) {
  const engine = getFraudDetectionEngine();

  // 获取用户的设备列表 (通过查询历史)
  const history = engine.getUserHistory(userId);

  if (!history) {
    return [];
  }

  // 分析设备
  const devices = new Map<string, { fingerprint: string; lastSeen: number }>();

  // 这里需要从请求中收集设备指纹
  // 实际应用中应该维护设备到用户的映射

  return Array.from(devices.values());
}

// ============================================================
// Handler 函数 (示例)
// ============================================================

async function loginHandler(req: Request, res: Response) {
  // 处理登录
  res.json({ success: true });
}

async function registerHandler(req: Request, res: Response) {
  // 处理注册
  res.json({ success: true });
}

async function transactionHandler(req: Request, res: Response) {
  // 处理交易
  res.json({ success: true });
}

async function paymentHandler(req: Request, res: Response) {
  // 处理支付
  res.json({ success: true });
}

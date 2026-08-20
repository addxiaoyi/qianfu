/**
 * 风控欺诈检测Express中间件和路由
 * 优化项 404: 风控模型 - 欺诈检测
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import {
  getFraudDetectionEngine,
  initializeFraudDetection,
  FraudDetectionEngine,
  FraudCheckRequest,
  FraudCheckResult,
  FraudEventType,
  RiskLevel,
  FraudRule,
  FraudDetectionConfig,
  FraudStatistics,
  FraudRecord,
  defaultFraudDetectionConfig,
} from '../middleware/security/fraud-detection';

// ============================================================
// Express中间件
// ============================================================

/**
 * 风控检测中间件
 * 对所有请求进行实时风控检测
 */
export function fraudDetectionMiddleware(options?: {
  eventType?: FraudEventType;
  skipPaths?: string[];
  collectDeviceFingerprint?: boolean;
}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const engine = getFraudDetectionEngine();
    const config = engine.getConfig();

    if (!config.enabled) {
      return next();
    }

    // 跳过指定路径
    if (options?.skipPaths && options.skipPaths.includes(req.path)) {
      return next();
    }

    const userId = (req as any).userId || req.ip || 'anonymous';
    const sessionId = (req as any).sessionId || req.sessionID || 'unknown';
    const eventType = options?.eventType || determineEventType(req);

    const checkRequest: FraudCheckRequest = {
      userId,
      sessionId,
      eventType,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceFingerprint: options?.collectDeviceFingerprint
        ? getDeviceFingerprint(req)
        : undefined,
      location: extractLocation(req),
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
      },
      timestamp: new Date().toISOString(),
    };

    // 异步执行检测，不阻塞请求
    engine.check(checkRequest).then((result) => {
      // 将检测结果附加到请求对象
      (req as any).fraudCheck = result;

      // 根据处置结果处理
      switch (result.recommendedAction) {
        case 'block':
          res.status(403).json({
            success: false,
            error: '请求被风控拦截',
            code: 'FRAUD_BLOCKED',
            decisionId: result.decisionId,
            riskLevel: result.riskLevel,
            message: result.reason,
          });
          return;

        case 'challenge':
          // 返回挑战响应，要求进一步验证
          res.setHeader('X-Fraud-Challenge', 'required');
          res.setHeader('X-Risk-Level', result.riskLevel);
          res.setHeader('X-Decision-Id', result.decisionId);
          break;

        case 'allow':
        default:
          // 添加风险头
          res.setHeader('X-Risk-Score', String(result.riskScore));
          res.setHeader('X-Risk-Level', result.riskLevel);
          res.setHeader('X-Decision-Id', result.decisionId);
          break;
      }

      next();
    }).catch((error) => {
      // 检测失败时默认放行
      console.error('[FRAUD-MIDDLEWARE] Check failed:', error);
      next();
    });
  };
}

/**
 * 登录风控检测中间件
 * 专门用于登录请求
 */
export function loginFraudDetectionMiddleware(): RequestHandler {
  return fraudDetectionMiddleware({
    eventType: FraudEventType.LOGIN,
    skipPaths: ['/health', '/metrics', '/api/health'],
  });
}

/**
 * 注册风控检测中间件
 * 专门用于注册请求
 */
export function registerFraudDetectionMiddleware(): RequestHandler {
  return fraudDetectionMiddleware({
    eventType: FraudEventType.REGISTER,
    skipPaths: ['/health', '/metrics', '/api/health'],
  });
}

/**
 * 交易风控检测中间件
 * 专门用于交易请求
 */
export function transactionFraudDetectionMiddleware(): RequestHandler {
  return fraudDetectionMiddleware({
    eventType: FraudEventType.TRANSACTION,
    skipPaths: ['/health', '/metrics', '/api/health'],
  });
}

// ============================================================
// API路由
// ============================================================

const router = Router();

/**
 * POST /api/fraud/check
 * 执行欺诈检测
 */
router.post('/check', async (req: Request, res: Response) => {
  const {
    userId,
    sessionId,
    eventType,
    amount,
    currency,
    ip,
    userAgent,
    deviceFingerprint,
    location,
    metadata,
  } = req.body;

  if (!userId || !eventType) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段: userId, eventType',
    });
    return;
  }

  try {
    const engine = getFraudDetectionEngine();
    const result = await engine.check({
      userId,
      sessionId: sessionId || 'unknown',
      eventType: eventType as FraudEventType,
      amount,
      currency,
      ip: ip || req.ip,
      userAgent: userAgent || req.headers['user-agent'],
      deviceFingerprint,
      location,
      metadata,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[FRAUD-ROUTE] Check error:', error);
    res.status(500).json({
      success: false,
      error: 'CHECK_FAILED',
      message: '欺诈检测失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/fraud/check/:decisionId
 * 获取特定检测结果
 */
router.get('/check/:decisionId', (req: Request, res: Response) => {
  const { decisionId } = req.params;

  const engine = getFraudDetectionEngine();
  const records = engine.getFraudRecords();

  const record = records.find((r) => r.decisionId === decisionId);

  if (!record) {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '检测结果不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: record,
  });
});

/**
 * GET /api/fraud/records
 * 获取欺诈记录列表
 */
router.get('/records', (req: Request, res: Response) => {
  const { userId, riskLevel, startDate, endDate, page = '1', pageSize = '20' } = req.query;

  const engine = getFraudDetectionEngine();
  const records = engine.getFraudRecords({
    userId: userId as string,
    riskLevel: riskLevel as RiskLevel,
    startDate: startDate as string,
    endDate: endDate as string,
  });

  // 分页
  const pageNum = parseInt(page as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);
  const start = (pageNum - 1) * pageSizeNum;
  const end = start + pageSizeNum;
  const paginatedRecords = records.slice(start, end);

  res.json({
    success: true,
    data: {
      total: records.length,
      page: pageNum,
      pageSize: pageSizeNum,
      records: paginatedRecords,
    },
  });
});

/**
 * GET /api/fraud/statistics
 * 获取风控统计数据
 */
router.get('/statistics', (req: Request, res: Response) => {
  const engine = getFraudDetectionEngine();
  const stats = engine.getStatistics();

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/fraud/user/:userId/history
 * 获取用户行为历史
 */
router.get('/user/:userId/history', (req: Request, res: Response) => {
  const { userId } = req.params;

  const engine = getFraudDetectionEngine();
  const history = engine.getUserHistory(userId);

  if (!history) {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '用户历史不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: history,
  });
});

/**
 * GET /api/fraud/ip/:ip/profile
 * 获取IP档案
 */
router.get('/ip/:ip/profile', (req: Request, res: Response) => {
  const { ip } = req.params;

  const engine = getFraudDetectionEngine();
  const profile = engine.getIpProfile(ip);

  if (!profile) {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'IP档案不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: profile,
  });
});

/**
 * POST /api/fraud/ip/:ip/blacklist
 * 将IP加入黑名单
 */
router.post('/ip/:ip/blacklist', (req: Request, res: Response) => {
  const { ip } = req.params;

  const engine = getFraudDetectionEngine();
  engine.blacklistIp(ip);

  res.json({
    success: true,
    message: 'IP已加入黑名单',
  });
});

/**
 * DELETE /api/fraud/ip/:ip/blacklist
 * 将IP从黑名单移除
 */
router.delete('/ip/:ip/blacklist', (req: Request, res: Response) => {
  const { ip } = req.params;

  const engine = getFraudDetectionEngine();
  engine.unblacklistIp(ip);

  res.json({
    success: true,
    message: 'IP已从黑名单移除',
  });
});

/**
 * GET /api/fraud/device/:fingerprint/profile
 * 获取设备档案
 */
router.get('/device/:fingerprint/profile', (req: Request, res: Response) => {
  const { fingerprint } = req.params;

  const engine = getFraudDetectionEngine();
  const profile = engine.getDeviceProfile(fingerprint);

  if (!profile) {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '设备档案不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: profile,
  });
});

/**
 * GET /api/fraud/rules
 * 获取风控规则列表
 */
router.get('/rules', (req: Request, res: Response) => {
  const engine = getFraudDetectionEngine();
  const config = engine.getConfig();

  res.json({
    success: true,
    data: {
      rules: config.rules.rules,
      enabled: config.rules.enabled,
    },
  });
});

/**
 * PUT /api/fraud/rules/:ruleId
 * 更新风控规则
 */
router.put('/rules/:ruleId', (req: Request, res: Response) => {
  const { ruleId } = req.params;
  const { enabled, riskWeight, action } = req.body;

  const engine = getFraudDetectionEngine();
  const config = engine.getConfig();

  const ruleIndex = config.rules.rules.findIndex((r) => r.id === ruleId);

  if (ruleIndex === -1) {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: '规则不存在',
    });
    return;
  }

  // 更新规则
  if (enabled !== undefined) {
    config.rules.rules[ruleIndex].enabled = enabled;
  }
  if (riskWeight !== undefined) {
    config.rules.rules[ruleIndex].riskWeight = riskWeight;
  }
  if (action !== undefined) {
    config.rules.rules[ruleIndex].action = action;
  }

  engine.updateConfig(config);

  res.json({
    success: true,
    data: config.rules.rules[ruleIndex],
    message: '规则已更新',
  });
});

/**
 * GET /api/fraud/config
 * 获取风控配置
 */
router.get('/config', (req: Request, res: Response) => {
  const engine = getFraudDetectionEngine();
  const config = engine.getConfig();

  res.json({
    success: true,
    data: config,
  });
});

/**
 * PUT /api/fraud/config
 * 更新风控配置
 */
router.put('/config', (req: Request, res: Response) => {
  const updates = req.body;

  const engine = getFraudDetectionEngine();
  engine.updateConfig(updates);

  res.json({
    success: true,
    data: engine.getConfig(),
    message: '配置已更新',
  });
});

/**
 * POST /api/fraud/config/reset
 * 重置风控配置
 */
router.post('/config/reset', (req: Request, res: Response) => {
  initializeFraudDetection(defaultFraudDetectionConfig);

  res.json({
    success: true,
    data: defaultFraudDetectionConfig,
    message: '配置已重置为默认值',
  });
});

// ============================================================
// 辅助函数
// ============================================================

function determineEventType(req: Request): FraudEventType {
  const path = req.path.toLowerCase();
  const method = req.method;

  if (path.includes('/login') || path.includes('/signin')) {
    return FraudEventType.LOGIN;
  }
  if (path.includes('/register') || path.includes('/signup')) {
    return FraudEventType.REGISTER;
  }
  if (path.includes('/password/reset')) {
    return FraudEventType.PASSWORD_RESET;
  }
  if (path.includes('/password/change')) {
    return FraudEventType.PASSWORD_CHANGE;
  }
  if (path.includes('/transaction') || path.includes('/pay')) {
    return FraudEventType.TRANSACTION;
  }
  if (path.includes('/transfer')) {
    return FraudEventType.TRANSFER;
  }
  if (path.includes('/withdraw')) {
    return FraudEventType.WITHDRAWAL;
  }
  if (path.includes('/deposit')) {
    return FraudEventType.DEPOSIT;
  }
  if (path.includes('/profile') && method === 'PUT') {
    return FraudEventType.UPDATE_PROFILE;
  }
  if (path.includes('/payment-method') || path.includes('/card')) {
    return FraudEventType.ADD_PAYMENT_METHOD;
  }
  if (path.includes('/export') || path.includes('/download')) {
    return FraudEventType.DATA_EXPORT;
  }
  if (path.includes('/permission') || path.includes('/role')) {
    return FraudEventType.PERMISSION_CHANGE;
  }

  return FraudEventType.API_REQUEST;
}

function getDeviceFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['accept-encoding'],
    req.headers['accept'],
    req.headers['sec-ch-ua'],
    req.headers['sec-ch-ua-mobile'],
    req.headers['sec-ch-ua-platform'],
    req.ip,
  ].filter(Boolean);

  const crypto = require('crypto');
  return crypto.createHash('sha256').update(components.join('|')).digest('hex').substring(0, 32);
}

function extractLocation(req: Request): { country?: string; region?: string; city?: string } | undefined {
  // 从请求头或查询参数提取位置信息
  const country = req.headers['x-geo-country'] as string || req.query.country as string;
  const region = req.headers['x-geo-region'] as string || req.query.region as string;
  const city = req.headers['x-geo-city'] as string || req.query.city as string;

  if (country || region || city) {
    return { country, region, city };
  }

  return undefined;
}

// ============================================================
// 导出
// ============================================================

export { router as fraudRoutes };

export default router;

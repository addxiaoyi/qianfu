/**
 * RFM 模型路由
 *
 * 提供 REST API 接口访问 RFM 用户价值分析功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getRFMService, RFMLevel, RFMQueryParams } from '../services/rfmService';
import { logger } from '../lib/logger';

const router = Router();

/**
 * 通用错误处理包装
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============== 单用户分析 ==============

/**
 * 分析单个用户 RFM
 * GET /api/rfm/user/:userId
 */
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const service = getRFMService();

  if (!userId) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Missing required parameter: userId',
    });
    return;
  }

  try {
    const analysis = await service.analyzeUser(userId);

    if (!analysis) {
      res.status(404).json({
        error: 'Not found',
        message: 'User has no transaction data',
        userId,
      });
      return;
    }

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    logger.error('[RFM] Failed to analyze user', { error: error.message, userId });
    res.status(500).json({
      error: 'Analysis failed',
      message: 'Failed to analyze user RFM',
    });
  }
}));

// ============== 批量用户分析 ==============

/**
 * 批量分析用户 RFM
 * POST /api/rfm/users/batch
 *
 * Body:
 * {
 *   "userIds": ["user_1", "user_2", ...]
 * }
 */
router.post('/users/batch', asyncHandler(async (req: Request, res: Response) => {
  const { userIds } = req.body;
  const service = getRFMService();

  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Missing or invalid required field: userIds (array required)',
    });
    return;
  }

  if (userIds.length > 100) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Batch size exceeds limit (max 100)',
    });
    return;
  }

  try {
    const analyses = await service.analyzeUsers(userIds);

    res.json({
      success: true,
      total: analyses.length,
      failed: userIds.length - analyses.length,
      data: analyses,
    });
  } catch (error: any) {
    logger.error('[RFM] Batch analysis failed', { error: error.message });
    res.status(500).json({
      error: 'Batch analysis failed',
      message: 'Failed to analyze users',
    });
  }
}));

// ============== 用户分群查询 ==============

/**
 * 查询用户分群
 * GET /api/rfm/users
 *
 * Query:
 * - segment: RFMLevel (可选)
 * - minRScore: number (可选)
 * - minFScore: number (可选)
 * - minMScore: number (可选)
 * - page: number (默认 1)
 * - pageSize: number (默认 20, max 100)
 * - sortBy: 'recency' | 'frequency' | 'monetary' | 'score' (默认 'score')
 * - sortOrder: 'asc' | 'desc' (默认 'desc')
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const service = getRFMService();

  const params: RFMQueryParams = {
    segment: req.query.segment as RFMLevel | undefined,
    minRScore: req.query.minRScore ? parseInt(String(req.query.minRScore), 10) : undefined,
    minFScore: req.query.minFScore ? parseInt(String(req.query.minFScore), 10) : undefined,
    minMScore: req.query.minMScore ? parseInt(String(req.query.minMScore), 10) : undefined,
    page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
    pageSize: req.query.pageSize ? Math.min(parseInt(String(req.query.pageSize), 10), 100) : 20,
    sortBy: req.query.sortBy as RFMQueryParams['sortBy'] || 'score',
    sortOrder: req.query.sortOrder as RFMQueryParams['sortOrder'] || 'desc',
  };

  // 验证分群参数
  if (params.segment && !Object.values(RFMLevel).includes(params.segment)) {
    res.status(400).json({
      error: 'Invalid parameter',
      message: `Invalid segment value. Valid values: ${Object.values(RFMLevel).join(', ')}`,
    });
    return;
  }

  try {
    const result = await service.querySegment(params);

    res.json({
      success: true,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
      data: result.users,
    });
  } catch (error: any) {
    logger.error('[RFM] Query segment failed', { error: error.message });
    res.status(500).json({
      error: 'Query failed',
      message: 'Failed to query users',
    });
  }
}));

// ============== 特定分群 ==============

/**
 * 获取特定等级用户
 * GET /api/rfm/segment/:level/users
 */
router.get('/segment/:level/users', asyncHandler(async (req: Request, res: Response) => {
  const { level } = req.params;
  const { page, pageSize } = req.query;
  const service = getRFMService();

  // 验证分群参数
  if (!Object.values(RFMLevel).includes(level as RFMLevel)) {
    res.status(400).json({
      error: 'Invalid parameter',
      message: `Invalid level value. Valid values: ${Object.values(RFMLevel).join(', ')}`,
    });
    return;
  }

  const pageNum = page ? parseInt(String(page), 10) : 1;
  const size = pageSize ? Math.min(parseInt(String(pageSize), 10), 100) : 20;

  try {
    const allUsers = await service.getUsersByLevel(level as RFMLevel);

    // 分页
    const start = (pageNum - 1) * size;
    const users = allUsers.slice(start, start + size);

    res.json({
      success: true,
      segment: level,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: allUsers.length,
        totalPages: Math.ceil(allUsers.length / size),
      },
      data: users,
    });
  } catch (error: any) {
    logger.error('[RFM] Get segment users failed', { error: error.message, level });
    res.status(500).json({
      error: 'Query failed',
      message: 'Failed to get segment users',
    });
  }
}));

// ============== 高价值和风险用户 ==============

/**
 * 获取高价值用户 (评分 >= 444)
 * GET /api/rfm/users/high-value
 */
router.get('/users/high-value', asyncHandler(async (req: Request, res: Response) => {
  const service = getRFMService();

  try {
    const users = await service.getHighValueUsers();

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    logger.error('[RFM] Get high value users failed', { error: error.message });
    res.status(500).json({
      error: 'Query failed',
      message: 'Failed to get high value users',
    });
  }
}));

/**
 * 获取流失风险用户
 * GET /api/rfm/users/at-risk
 */
router.get('/users/at-risk', asyncHandler(async (req: Request, res: Response) => {
  const service = getRFMService();

  try {
    const users = await service.getAtRiskUsers();

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    logger.error('[RFM] Get at-risk users failed', { error: error.message });
    res.status(500).json({
      error: 'Query failed',
      message: 'Failed to get at-risk users',
    });
  }
}));

// ============== 分析报告 ==============

/**
 * 生成 RFM 分析报告
 * GET /api/rfm/report
 */
router.get('/report', asyncHandler(async (req: Request, res: Response) => {
  const service = getRFMService();

  try {
    const report = await service.generateReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('[RFM] Generate report failed', { error: error.message });
    res.status(500).json({
      error: 'Report generation failed',
      message: 'Failed to generate RFM report',
    });
  }
}));

/**
 * 获取分群统计摘要
 * GET /api/rfm/segments/summary
 */
router.get('/segments/summary', asyncHandler(async (req: Request, res: Response) => {
  const service = getRFMService();

  try {
    const report = await service.generateReport();

    // 提取分群摘要
    const summary = report.segments.map(seg => ({
      segment: seg.segment,
      userCount: seg.userCount,
      percentage: Math.round(seg.percentage * 100) / 100,
      revenuePercentage: seg.revenuePercentage,
    }));

    res.json({
      success: true,
      data: {
        totalUsers: report.totalUsers,
        activeUsers: report.activeUsers,
        segments: summary,
      },
    });
  } catch (error: any) {
    logger.error('[RFM] Get segments summary failed', { error: error.message });
    res.status(500).json({
      error: 'Query failed',
      message: 'Failed to get segments summary',
    });
  }
}));

// ============== 缓存管理 ==============

/**
 * 清除 RFM 缓存
 * POST /api/rfm/cache/clear
 */
router.post('/cache/clear', asyncHandler(async (req: Request, res: Response) => {
  const service = getRFMService();

  try {
    service.clearCache();

    logger.info('[RFM] Cache cleared');

    res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error: any) {
    logger.error('[RFM] Clear cache failed', { error: error.message });
    res.status(500).json({
      error: 'Operation failed',
      message: 'Failed to clear cache',
    });
  }
}));

// ============== 配置信息 ==============

/**
 * 获取 RFM 配置
 * GET /api/rfm/config
 */
router.get('/config', asyncHandler(async (_req: Request, res: Response) => {
  const service = getRFMService();
  const config = service.getConfig();

  res.json({
    success: true,
    data: config,
  });
}));

// ============== 等级定义 ==============

/**
 * 获取 RFM 等级定义
 * GET /api/rfm/levels
 */
router.get('/levels', asyncHandler(async (_req: Request, res: Response) => {
  const levels = {
    [RFMLevel.CHAMPIONS]: {
      name: '冠军用户',
      description: '高价值核心用户，购买频繁、金额高、最近活跃',
      color: '#10b981',
    },
    [RFMLevel.LOYAL_CUSTOMERS]: {
      name: '忠诚用户',
      description: '忠诚用户，购买稳定，金额较高',
      color: '#3b82f6',
    },
    [RFMLevel.CANT_LOSE_THEM]: {
      name: '重点挽留',
      description: '重要挽留用户，曾经高价值但近期活跃度下降',
      color: '#f59e0b',
    },
    [RFMLevel.POTENTIAL_LOYALIST]: {
      name: '潜在忠诚',
      description: '潜在忠诚用户，有一定购买基础',
      color: '#8b5cf6',
    },
    [RFMLevel.RECENT_CUSTOMERS]: {
      name: '新用户',
      description: '新用户，刚刚开始消费',
      color: '#06b6d4',
    },
    [RFMLevel.PROMISING]: {
      name: '有潜力',
      description: '有潜力的用户，需要培养',
      color: '#84cc16',
    },
    [RFMLevel.NEEDS_ATTENTION]: {
      name: '需要关注',
      description: '需要关注的中等价值用户',
      color: '#f97316',
    },
    [RFMLevel.AT_RISK]: {
      name: '流失风险',
      description: '流失风险用户，活跃度和消费下降',
      color: '#ef4444',
    },
    [RFMLevel.HIBERNATING]: {
      name: '休眠用户',
      description: '休眠用户，很久没有活跃',
      color: '#6b7280',
    },
    [RFMLevel.LOST]: {
      name: '已流失',
      description: '已流失用户，需要唤醒或放弃',
      color: '#374151',
    },
    [RFMLevel.LOST_CHEAP]: {
      name: '低价值流失',
      description: '低价值流失用户',
      color: '#1f2937',
    },
  };

  res.json({
    success: true,
    data: levels,
  });
}));

export default router;

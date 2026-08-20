/**
 * 用户生命周期管理 API 路由
 * 优化项 310: 用户生命周期 - 阶段管理
 *
 * 提供以下 API 端点:
 * - GET  /api/lifecycle/users/:userId/stage       - 获取用户当前阶段
 * - GET  /api/lifecycle/users/:userId/history    - 获取阶段转换历史
 * - POST /api/lifecycle/users/:userId/transition - 手动触发阶段转换
 * - GET  /api/lifecycle/stats                    - 获取阶段统计
 * - GET  /api/lifecycle/distribution             - 获取阶段分布
 * - GET  /api/lifecycle/stages                  - 获取阶段定义
 */

import { Router, Request, Response } from 'express';
import {
  getLifecycleService,
  LifecycleEvent,
  LifecycleStage,
  LifecycleState,
  STAGE_DEFINITIONS,
} from '../services/lifecycleService';
import { logger } from '../lib/logger';

const router = Router();

// ============== 用户阶段接口 ==============

/**
 * GET /api/lifecycle/users/:userId/stage
 * 获取用户当前阶段
 */
router.get('/users/:userId/stage', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const service = getLifecycleService();

    const stage = await service.getUserStage(userId);
    const state = await service.getUserLifecycleState(userId);

    res.json({
      success: true,
      data: {
        stage,
        state,
        definition: STAGE_DEFINITIONS[stage],
      },
    });
  } catch (error) {
    logger.error('[Lifecycle] Error getting user stage:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取用户阶段失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/lifecycle/users/:userId/history
 * 获取用户阶段转换历史
 */
router.get('/users/:userId/history', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = '50', startDate, endDate } = req.query;
    const service = getLifecycleService();

    const history = await service.getTransitionHistory(userId, {
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
  } catch (error) {
    logger.error('[Lifecycle] Error getting transition history:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取转换历史失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/lifecycle/users/:userId/transition
 * 手动触发阶段转换
 */
router.post('/users/:userId/transition', async (req: Request, res: Response) => {
  try {
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

    // 验证事件是否有效
    const validEvents = Object.values(LifecycleEvent);
    if (!validEvents.includes(event as LifecycleEvent)) {
      res.status(400).json({
        success: false,
        error: 'INVALID_EVENT',
        message: `无效的事件类型。可选值: ${validEvents.join(', ')}`,
      });
      return;
    }

    const service = getLifecycleService();
    const result = await service.handleTransition(
      userId,
      event as LifecycleEvent,
      metadata
    );

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: `阶段转换成功: ${result.previousStage} -> ${result.currentStage}`,
      });
    } else {
      res.json({
        success: false,
        data: result,
        message: result.reason || '阶段转换失败',
      });
    }
  } catch (error) {
    logger.error('[Lifecycle] Error handling transition:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '阶段转换失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============== 统计接口 ==============

/**
 * GET /api/lifecycle/stats
 * 获取阶段统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const service = getLifecycleService();
    const stats = await service.getStageStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('[Lifecycle] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取统计数据失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/lifecycle/distribution
 * 获取阶段分布
 */
router.get('/distribution', async (req: Request, res: Response) => {
  try {
    const service = getLifecycleService();
    const distribution = await service.getStageDistribution();

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    logger.error('[Lifecycle] Error getting distribution:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取阶段分布失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============== 配置接口 ==============

/**
 * GET /api/lifecycle/stages
 * 获取阶段定义
 */
router.get('/stages', (req: Request, res: Response) => {
  const stages = Object.entries(STAGE_DEFINITIONS).map(([key, def]) => ({
    stage: key,
    name: def.name,
    description: def.description,
    duration: def.duration,
    strategies: def.strategies,
    entryCriteria: def.entryCriteria,
    exitCriteria: {
      ...def.exitCriteria,
      targetStageName: STAGE_DEFINITIONS[def.exitCriteria.targetStage]?.name || def.exitCriteria.targetStage,
    },
  }));

  res.json({
    success: true,
    data: stages,
  });
});

/**
 * GET /api/lifecycle/events
 * 获取转换事件定义
 */
router.get('/events', (req: Request, res: Response) => {
  const events = Object.values(LifecycleEvent).map(event => ({
    event,
    name: getEventName(event),
    description: getEventDescription(event),
  }));

  res.json({
    success: true,
    data: events,
  });
});

/**
 * GET /api/lifecycle/stages/:stage
 * 获取特定阶段详情
 */
router.get('/stages/:stage', (req: Request, res: Response) => {
  const { stage } = req.params;

  if (!Object.values(LifecycleStage).includes(stage as LifecycleStage)) {
    res.status(404).json({
      success: false,
      error: 'STAGE_NOT_FOUND',
      message: '阶段不存在',
    });
    return;
  }

  const definition = STAGE_DEFINITIONS[stage as LifecycleStage];

  res.json({
    success: true,
    data: {
      ...definition,
      exitCriteria: {
        ...definition.exitCriteria,
        targetStageName: STAGE_DEFINITIONS[definition.exitCriteria.targetStage]?.name,
      },
    },
  });
});

// ============== 批量操作接口 ==============

/**
 * POST /api/lifecycle/batch/transition
 * 批量处理阶段转换
 */
router.post('/batch/transition', async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '请提供有效的 userIds 数组',
      });
      return;
    }

    const service = getLifecycleService();
    const result = await service.processBatchTransitions(userIds);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[Lifecycle] Error processing batch transitions:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '批量处理失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============== 辅助函数 ==============

function getEventName(event: LifecycleEvent): string {
  const names: Record<LifecycleEvent, string> = {
    [LifecycleEvent.USER_REGISTER]: '用户注册',
    [LifecycleEvent.USER_LOGIN]: '用户登录',
    [LifecycleEvent.USER_LOGOUT]: '用户登出',
    [LifecycleEvent.COMPLETE_PROFILE]: '完成资料',
    [LifecycleEvent.CORE_ACTION]: '核心行为',
    [LifecycleEvent.INACTIVITY_DETECTED]: '检测到不活跃',
    [LifecycleEvent.CHURN_PREDICTED]: '预测流失',
    [LifecycleEvent.CHURN_CONFIRMED]: '流失确认',
    [LifecycleEvent.REACTIVATION]: '重新激活',
    [LifecycleEvent.PAYMENT]: '付费',
    [LifecycleEvent.PAYMENT_FAILED]: '付费失败',
    [LifecycleEvent.VIP_UPGRADE]: '升级VIP',
    [LifecycleEvent.VIP_DOWNGRADE]: '降级VIP',
    [LifecycleEvent.ACCOUNT_DELETED]: '账号注销',
  };
  return names[event] || event;
}

function getEventDescription(event: LifecycleEvent): string {
  const descriptions: Record<LifecycleEvent, string> = {
    [LifecycleEvent.USER_REGISTER]: '用户完成注册流程',
    [LifecycleEvent.USER_LOGIN]: '用户成功登录系统',
    [LifecycleEvent.USER_LOGOUT]: '用户主动登出系统',
    [LifecycleEvent.COMPLETE_PROFILE]: '用户完善了个人资料',
    [LifecycleEvent.CORE_ACTION]: '用户完成核心功能操作',
    [LifecycleEvent.INACTIVITY_DETECTED]: '系统检测到用户长时间未活跃',
    [LifecycleEvent.CHURN_PREDICTED]: '流失预警模型预测用户可能流失',
    [LifecycleEvent.CHURN_CONFIRMED]: '用户被正式判定为流失',
    [LifecycleEvent.REACTIVATION]: '流失用户重新回到平台',
    [LifecycleEvent.PAYMENT]: '用户完成付费行为',
    [LifecycleEvent.PAYMENT_FAILED]: '用户付费失败',
    [LifecycleEvent.VIP_UPGRADE]: '用户升级为VIP',
    [LifecycleEvent.VIP_DOWNGRADE]: '用户从VIP降级',
    [LifecycleEvent.ACCOUNT_DELETED]: '用户账号被删除',
  };
  return descriptions[event] || event;
}

// ============== 导出 ==============

export default router;

/**
 * Server Service - 服务器路由
 * GET/POST/PUT/DELETE /servers/* - 服务器相关接口
 */

import { Router, Request, Response, NextFunction } from 'express';
import { serverService } from '../services/serverService';
import { successResponse, paginatedResponse } from '@qianfu/shared';
import { AppError } from '@qianfu/shared';

const router = Router();

// ============================================================================
// 中间件: 模拟认证（生产环境应使用 JWT 或 SuperTokens）
// ============================================================================

async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    throw AppError.unauthorized('Authentication required');
  }

  (req as any).userId = userId;
  next();
}

// ============================================================================
// GET /servers - 列出服务器（分页）
// ============================================================================

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const ownerId = req.query.ownerId as string;

    const result = await serverService.list({ page, limit, status, type, ownerId });

    res.json(paginatedResponse(result.servers, result.pagination));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GET /servers/:id - 获取服务器详情
// ============================================================================

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const server = await serverService.getById(id);

    if (!server) {
      throw AppError.notFound('Server not found');
    }

    res.json(successResponse(server));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// POST /servers - 创建服务器
// ============================================================================

router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { name, type, maxPlayers, config, version } = req.body;

    const server = await serverService.create(userId, {
      name,
      type,
      maxPlayers,
      config,
      version,
    });

    res.status(201).json(successResponse(server, 'Server created successfully'));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// PUT /servers/:id - 更新服务器
// ============================================================================

router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { name, maxPlayers, config, version } = req.body;

    const server = await serverService.update(id, userId, {
      name,
      maxPlayers,
      config,
      version,
    });

    res.json(successResponse(server, 'Server updated'));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// DELETE /servers/:id - 删除服务器
// ============================================================================

router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    await serverService.delete(id, userId);

    res.json(successResponse(null, 'Server deleted'));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// POST /servers/:id/start - 启动服务器实例
// ============================================================================

router.post('/:id/start', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await serverService.startInstance(id, userId);

    res.json(successResponse(result, 'Server starting...'));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// POST /servers/:id/stop - 停止服务器实例
// ============================================================================

router.post('/:id/stop', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await serverService.stopInstance(id, userId);

    res.json(successResponse(result, 'Server stopped'));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GET /servers/:id/players - 获取玩家列表
// ============================================================================

router.get('/:id/players', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const players = await serverService.getPlayers(id);

    res.json(successResponse(players));
  } catch (error) {
    next(error);
  }
});

export { router as serverRoutes, authenticate };

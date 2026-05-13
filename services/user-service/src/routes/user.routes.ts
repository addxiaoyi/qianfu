/**
 * User Service - 用户路由
 * GET/POST/PUT/DELETE /users/* - 用户相关接口
 */

import { Router, Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { paginatedResponse, successResponse } from '@qianfu/shared';
import { AppError } from '@qianfu/shared';
import { authenticate } from './auth.routes';

const router = Router();

// ============================================================================
// GET /users - 列出用户（分页）
// ============================================================================

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;

      const result = await userService.list({ page, limit, search });

      res.json(
        paginatedResponse(result.users, result.pagination, {
          pagination: result.pagination,
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /users/:id - 获取用户详情
// ============================================================================

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userService.getById(id);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // 移除敏感字段
      const safeUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };

      res.json(successResponse(safeUser));
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /users - 创建用户
// ============================================================================

router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, username, firstName, lastName } = req.body;

      const user = await userService.create({
        email,
        username,
        firstName,
        lastName,
      });

      res.status(201).json(
        successResponse(
          {
            id: user.id,
            email: user.email,
            username: user.username,
          },
          'User created successfully'
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// PUT /users/:id - 更新用户
// ============================================================================

router.put(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      // 只能修改自己的资料
      if (id !== userId) {
        throw AppError.forbidden('Cannot update other users');
      }

      const { username, firstName, lastName, bio, avatarUrl } = req.body;

      const user = await userService.update(id, {
        username,
        firstName,
        lastName,
        bio,
        avatar_url: avatarUrl,
      });

      res.json(successResponse(user, 'User updated'));
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DELETE /users/:id - 删除用户
// ============================================================================

router.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      // 只能删除自己
      if (id !== userId) {
        throw AppError.forbidden('Cannot delete other users');
      }

      await userService.delete(id);

      res.json(successResponse(null, 'User deleted'));
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /users/me - 获取当前用户
// ============================================================================

router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const user = await userService.getById(userId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      res.json(successResponse({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        createdAt: user.created_at,
      }));
    } catch (error) {
      next(error);
    }
  }
);

export { router as userRoutes };

/**
 * User Service - 认证路由
 * POST /auth/* - 认证相关接口
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { validateBody, successResponse } from '@qianfu/shared';
import { AppError } from '@qianfu/shared';

const router = Router();

// ============================================================================
// 中间件: 验证会话
// ============================================================================

async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.headers['x-session-id'] as string ||
                    req.cookies?.session_id;

  if (!sessionId) {
    throw AppError.unauthorized('Authentication required');
  }

  const session = await authService.verifySession(sessionId);
  if (!session) {
    throw AppError.unauthorized('Session expired or invalid');
  }

  (req as any).userId = session.userId;
  (req as any).sessionId = sessionId;
  next();
}

// ============================================================================
// POST /auth/login - 登录
// ============================================================================

router.post(
  '/login',
  validateBody({
    email: String,
    password: String,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const result = await authService.verifyCredentials(email, password);
      if (!result) {
        throw AppError.unauthorized('Invalid credentials');
      }

      const session = await authService.createSession(result.userId);

      res.cookie('session_id', session.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
      });

      res.json(
        successResponse({
          sessionId: session.sessionId,
          expiresAt: session.expiresAt.toISOString(),
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /auth/logout - 登出
// ============================================================================

router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = (req as any).sessionId;
      await authService.revokeSession(sessionId);

      res.clearCookie('session_id');

      res.json(successResponse(null, 'Logged out successfully'));
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /auth/sessions - 获取会话列表
// ============================================================================

router.get(
  '/sessions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const sessions = await authService.getUserSessions(userId);

      const currentSessionId = (req as any).sessionId;
      const safeSessions = sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent: s.id === currentSessionId,
      }));

      res.json(successResponse(safeSessions));
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DELETE /auth/sessions/:sessionId - 撤销指定会话
// ============================================================================

router.delete(
  '/sessions/:sessionId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).userId;
      const currentSessionId = (req as any).sessionId;

      if (sessionId === currentSessionId) {
        throw AppError.badRequest('Cannot revoke current session');
      }

      const sessions = await authService.getUserSessions(userId);
      if (!sessions.find((s) => s.id === sessionId)) {
        throw AppError.notFound('Session not found');
      }

      await authService.revokeSession(sessionId);

      res.json(successResponse(null, 'Session revoked'));
    } catch (error) {
      next(error);
    }
  }
);

export { router as authRoutes, authenticate };

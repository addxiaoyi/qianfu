import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notificationLimiter } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrf';
import { sendSuccess } from '../utils/response';
import { idParamSchema } from '../utils/validation';
import { AppError, ErrorCode } from '../utils/errors';

const router = Router();

router.use(authenticate);
router.use(notificationLimiter);

/**
 * Get user notifications
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user!.id },
      orderBy: { created_at: 'desc' },
      take: 50
    });
    return sendSuccess(res, notifications);
  } catch (error: any) {
    next(error);
  }
});

/**
 * Mark notification as read
 */
router.patch('/:id/read', csrfProtection, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = idParamSchema.safeParse(req.params);
    if (!validation.success) {
      throw new AppError('Invalid notification ID', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { id } = validation.data;
    
    await prisma.notification.update({
      where: { 
        id,
        user_id: req.user!.id
      },
      data: { is_read: true }
    });
    return sendSuccess(res, { message: 'Notification marked as read' });
  } catch (error: any) {
    next(error);
  }
});

/**
 * Mark all as read
 */
router.post('/read-all', csrfProtection, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { 
        user_id: req.user!.id,
        is_read: false
      },
      data: { is_read: true }
    });
    return sendSuccess(res, { message: 'All notifications marked as read' });
  } catch (error: any) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { notificationLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { sendSuccess } from '../utils/response.js';
import { idParamSchema } from '../utils/validation.js';
import { AppError, ErrorCode } from '../utils/errors.js';
const router = Router();
router.use(authenticate);
router.use(notificationLimiter);
/**
 * Get user notifications
 */
router.get('/', async (req, res, next) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { user_id: req.user.id },
            orderBy: { created_at: 'desc' },
            take: 50
        });
        return sendSuccess(res, notifications);
    }
    catch (error) {
        next(error);
    }
});
/**
 * Mark notification as read
 */
router.patch('/:id/read', csrfProtection, async (req, res, next) => {
    try {
        const validation = idParamSchema.safeParse(req.params);
        if (!validation.success) {
            throw new AppError('Invalid notification ID', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { id } = validation.data;
        await prisma.notification.update({
            where: {
                id,
                user_id: req.user.id
            },
            data: { is_read: true }
        });
        return sendSuccess(res, { message: 'Notification marked as read' });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Mark all as read
 */
router.post('/read-all', csrfProtection, async (req, res, next) => {
    try {
        await prisma.notification.updateMany({
            where: {
                user_id: req.user.id,
                is_read: false
            },
            data: { is_read: true }
        });
        return sendSuccess(res, { message: 'All notifications marked as read' });
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=notification.js.map
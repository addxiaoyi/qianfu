import { Router } from 'express';
import * as moderationController from '../controllers/moderationController';
import { authenticate, hasPermission } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrf';

const router = Router();

// All moderation config routes require admin permission
router.use(authenticate, hasPermission(['ADMIN']), adminLimiter);

router.get('/config', moderationController.getModerationConfig);
router.post('/config', csrfProtection, moderationController.updateModerationConfig);
router.get('/logs', moderationController.getModerationLogs);
router.post('/logs/:id/review', csrfProtection, moderationController.reviewModerationLog);

export default router;

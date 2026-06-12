import { Router } from 'express';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { getModerationSettings, updateModerationSetting, getModerationLogs, reviewModerationLog } from '../controllers/moderationAdminController.js';
import { csrfProtection } from '../middleware/csrf.js';
import { verifySignature } from '../middleware/signature.js';
const router = Router();
// All routes require admin permission
router.use(authenticate);
router.use(hasPermission(['admin']));
router.use(adminLimiter);
router.use(verifySignature);
// Get config and stats
router.get('/settings', getModerationSettings);
// Update config (CSRF protected)
router.post('/settings', csrfProtection, updateModerationSetting);
// Get moderation logs
router.get('/logs', getModerationLogs);
router.post('/logs/:id/review', csrfProtection, reviewModerationLog);
export default router;
//# sourceMappingURL=moderationAdmin.js.map
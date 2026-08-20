import { Router } from 'express';
import { createAdminAnnouncement, deleteAdminAnnouncement, getAdminAnnouncements, updateAdminAnnouncement, } from '../controllers/announcementController';
import { authenticate, hasPermission } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { adminLimiter } from '../middleware/rateLimiter';
const router = Router();
router.use(authenticate);
router.use(hasPermission(['admin']));
router.use(adminLimiter);
const protectWrite = [
    csrfProtection,
    createIdempotencyMiddleware({ keyPrefix: 'announcement', requireHeader: true }),
];
router.get('/', getAdminAnnouncements);
router.post('/', ...protectWrite, createAdminAnnouncement);
router.patch('/:id', ...protectWrite, updateAdminAnnouncement);
router.delete('/:id', ...protectWrite, deleteAdminAnnouncement);
export default router;
//# sourceMappingURL=announcementAdmin.js.map
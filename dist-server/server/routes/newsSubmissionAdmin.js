import { Router } from 'express';
import { approveNewsSubmissionController, getNewsSubmissionsForReview, rejectNewsSubmissionController, } from '../controllers/newsSubmissionController.js';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { createIdempotencyMiddleware } from '../middleware/idempotency.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
const router = Router();
router.use(authenticate);
router.use(hasPermission(['admin']));
router.use(adminLimiter);
router.get('/', getNewsSubmissionsForReview);
router.post('/:id/approve', csrfProtection, createIdempotencyMiddleware({ keyPrefix: 'news-submission-review', requireHeader: true }), approveNewsSubmissionController);
router.post('/:id/reject', csrfProtection, createIdempotencyMiddleware({ keyPrefix: 'news-submission-review', requireHeader: true }), rejectNewsSubmissionController);
export default router;
//# sourceMappingURL=newsSubmissionAdmin.js.map
import { Router } from 'express';

import {
  approveNewsSubmissionController,
  getNewsSubmissionsForReview,
  rejectNewsSubmissionController,
} from '../controllers/newsSubmissionController';
import { authenticate, hasPermission } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { adminLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(authenticate);
router.use(hasPermission(['admin']));
router.use(adminLimiter);

router.get('/', getNewsSubmissionsForReview);
router.post('/:id/approve', csrfProtection, createIdempotencyMiddleware({ keyPrefix: 'news-submission-review', requireHeader: true }), approveNewsSubmissionController);
router.post('/:id/reject', csrfProtection, createIdempotencyMiddleware({ keyPrefix: 'news-submission-review', requireHeader: true }), rejectNewsSubmissionController);

export default router;

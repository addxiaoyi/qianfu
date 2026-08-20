import { Router } from 'express';

import {
  createOwnNewsSubmission,
  getOwnNewsSubmissions,
  updateOwnNewsSubmissionController,
} from '../controllers/newsSubmissionController';
import { authenticate } from '../middleware/auth';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard';
import { csrfProtection } from '../middleware/csrf';
import { createDuplicateRequestGuard, createIdempotencyMiddleware } from '../middleware/idempotency';
import { cmsStrictLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(authenticate);
router.use(cmsStrictLimiter);

router.get('/me', getOwnNewsSubmissions);
router.post(
  '/',
  requireVerifiedEmail,
  csrfProtection,
  createDuplicateRequestGuard({ ttlSeconds: 10, keyPrefix: 'news-submission' }),
  createIdempotencyMiddleware({ keyPrefix: 'news-submission', requireHeader: true }),
  createOwnNewsSubmission,
);
router.patch(
  '/:id',
  requireVerifiedEmail,
  csrfProtection,
  createIdempotencyMiddleware({ keyPrefix: 'news-submission', requireHeader: true }),
  updateOwnNewsSubmissionController,
);

export default router;

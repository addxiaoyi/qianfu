import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard';
import { createReport, getReports, getReport, updateReportStatus, batchUpdateReportStatus } from '../controllers/reportController';
import { ticketLimiter } from '../middleware/rateLimiter';
import { createDuplicateRequestGuard, createIdempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

// Reuse ticket limiter for reports as they have similar abuse potential
router.use(ticketLimiter);
router.use(authenticate);

router.post(
  '/',
  requireVerifiedEmail,
  createDuplicateRequestGuard({ ttlSeconds: 10 }),
  createIdempotencyMiddleware({ ttlSeconds: 60 * 60 }),
  createReport,
);
router.patch('/batch-status', batchUpdateReportStatus);
router.get('/', getReports);
router.get('/:id', getReport);
router.patch('/:id/status', updateReportStatus);

export default router;

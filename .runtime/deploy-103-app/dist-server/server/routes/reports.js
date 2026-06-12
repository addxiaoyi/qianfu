import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard.js';
import { createReport, getReports, getReport, updateReportStatus, batchUpdateReportStatus } from '../controllers/reportController.js';
import { ticketLimiter } from '../middleware/rateLimiter.js';
import { createDuplicateRequestGuard, createIdempotencyMiddleware } from '../middleware/idempotency.js';
const router = Router();
// Reuse ticket limiter for reports as they have similar abuse potential
router.use(ticketLimiter);
router.use(authenticate);
router.post('/', requireVerifiedEmail, createDuplicateRequestGuard({ ttlSeconds: 10 }), createIdempotencyMiddleware({ ttlSeconds: 60 * 60 }), createReport);
router.patch('/batch-status', batchUpdateReportStatus);
router.get('/', getReports);
router.get('/:id', getReport);
router.patch('/:id/status', updateReportStatus);
export default router;
//# sourceMappingURL=reports.js.map
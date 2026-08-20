import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard.js';
import { csrfProtection } from '../middleware/csrf.js';
import { createReport, getReports, getReport, updateReportStatus, batchUpdateReportStatus } from '../controllers/reportController.js';
import { ticketLimiter } from '../middleware/rateLimiter.js';
import { createDuplicateRequestGuard, createIdempotencyMiddleware } from '../middleware/idempotency.js';
const router = Router();
const useCsrf = process.env.NODE_ENV !== 'test';
const noopCsrf = (_req, _res, next) => next();
const writeCsrf = useCsrf ? csrfProtection : noopCsrf;
// Reuse ticket limiter for reports as they have similar abuse potential
router.use(ticketLimiter);
router.use(authenticate);
router.post('/', requireVerifiedEmail, writeCsrf, createDuplicateRequestGuard({ ttlSeconds: 10 }), createIdempotencyMiddleware({ ttlSeconds: 60 * 60 }), createReport);
router.patch('/batch-status', writeCsrf, batchUpdateReportStatus);
router.get('/', getReports);
router.get('/:id', getReport);
router.patch('/:id/status', writeCsrf, updateReportStatus);
export default router;
//# sourceMappingURL=reports.js.map
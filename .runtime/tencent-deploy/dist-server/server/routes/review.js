import { Router } from 'express';
import { getPendingReviews, reviewServer, getReviewHistory, batchReview, getReviewStats } from '../controllers/reviewController.js';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateBody, validateParams, validateQuery } from '../middleware/requestValidation.js';
import { batchReviewSchema, paginationQuerySchema, reviewActionSchema, reviewQuerySchema, serverIdParamSchema, } from '../utils/validation.js';
const router = Router();
// All review routes require authentication and are limited to users with review permissions
router.use(authenticate);
router.use(hasPermission(['review_servers']));
router.use(adminLimiter);
// Get list of pending servers for review
router.get('/pending', validateQuery(reviewQuerySchema), getPendingReviews);
// Review a single server
router.post('/:serverId', csrfProtection, validateParams(serverIdParamSchema), validateBody(reviewActionSchema), reviewServer);
// Get review history
router.get('/:serverId/history', validateParams(serverIdParamSchema), validateQuery(paginationQuerySchema), getReviewHistory);
// Batch review
router.post('/batch', csrfProtection, validateBody(batchReviewSchema), batchReview);
// Get review stats
router.get('/stats', getReviewStats);
export default router;
//# sourceMappingURL=review.js.map
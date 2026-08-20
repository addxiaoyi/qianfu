import { Router } from 'express';
import { adminOnly, authenticate } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { promoBindingLimiter, promoClaimLimiter } from '../middleware/rateLimiter.js';
import { approvePromoClaim, bindPlatformAccount, createPromoTask, updatePromoTask, getMyBindings, getMyPromoClaims, getPromoAuditSummary, getPromoClaimDetail, listPromoTasks, pausePromoTask, publishPromoTask, disablePromoTask, rejectPromoClaim, } from '../controllers/promoController.js';
import { submitPromoClaim } from '../controllers/promoClaimController.js';
import { getAdminPromoTask, getUserPromoTask, listAdminPromoClaims, } from '../controllers/promoReadController.js';
const router = Router();
router.use(authenticate);
// 用户侧
router.get('/tasks', listPromoTasks);
router.get('/tasks/:id', getUserPromoTask);
router.post('/bindings', promoBindingLimiter, csrfProtection, bindPlatformAccount);
router.get('/bindings/me', getMyBindings);
router.post('/claims', promoClaimLimiter, csrfProtection, submitPromoClaim);
router.get('/claims/me', getMyPromoClaims);
// 管理侧
router.post('/tasks', adminOnly, csrfProtection, createPromoTask);
router.patch('/tasks/:id', adminOnly, csrfProtection, updatePromoTask);
router.post('/tasks/:id/publish', adminOnly, csrfProtection, publishPromoTask);
router.post('/tasks/:id/pause', adminOnly, csrfProtection, pausePromoTask);
router.post('/tasks/:id/disable', adminOnly, csrfProtection, disablePromoTask);
router.get('/admin/tasks/:id', adminOnly, getAdminPromoTask);
router.get('/admin/claims', adminOnly, listAdminPromoClaims);
router.get('/claims/:id/detail', adminOnly, getPromoClaimDetail);
router.post('/claims/:id/approve', adminOnly, csrfProtection, approvePromoClaim);
router.post('/claims/:id/reject', adminOnly, csrfProtection, rejectPromoClaim);
router.get('/admin/summary', adminOnly, getPromoAuditSummary);
export default router;
//# sourceMappingURL=promo.js.map
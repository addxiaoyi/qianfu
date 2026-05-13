import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { approvePromoClaim, bindPlatformAccount, createPromoTask, updatePromoTask, getMyBindings, getMyPromoClaims, getPromoAuditSummary, getPromoClaimDetail, getPromoTask, listPromoTasks, pausePromoTask, publishPromoTask, disablePromoTask, rejectPromoClaim, submitPromoClaim, } from '../controllers/promoController';
const router = Router();
router.use(authenticate);
// 用户侧
router.get('/tasks', listPromoTasks);
router.get('/tasks/:id', getPromoTask);
router.post('/bindings', csrfProtection, bindPlatformAccount);
router.get('/bindings/me', getMyBindings);
router.post('/claims', csrfProtection, submitPromoClaim);
router.get('/claims/me', getMyPromoClaims);
// 管理侧
router.post('/tasks', csrfProtection, createPromoTask);
router.patch('/tasks/:id', csrfProtection, updatePromoTask);
router.post('/tasks/:id/publish', csrfProtection, publishPromoTask);
router.post('/tasks/:id/pause', csrfProtection, pausePromoTask);
router.post('/tasks/:id/disable', csrfProtection, disablePromoTask);
router.get('/tasks/:id/detail', getPromoTask);
router.get('/claims/:id/detail', getPromoClaimDetail);
router.post('/claims/:id/approve', csrfProtection, approvePromoClaim);
router.post('/claims/:id/reject', csrfProtection, rejectPromoClaim);
router.get('/admin/summary', getPromoAuditSummary);
export default router;
//# sourceMappingURL=promo.js.map
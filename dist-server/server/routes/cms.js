import { Router } from 'express';
import { getPage, saveDraft, submitReview, rejectReview, publish, unlock, listVersions, rollbackVersion, listAudit, } from '../controllers/cmsController';
import { authenticate, hasPermission } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { cmsLimiter, cmsStrictLimiter } from '../middleware/rateLimiter';
const router = Router();
router.get('/admin/intro/page', cmsLimiter, authenticate, hasPermission(['manage_content']), getPage);
router.post('/admin/intro/save', cmsStrictLimiter, authenticate, hasPermission(['manage_content']), csrfProtection, saveDraft);
router.post('/admin/intro/submit', cmsStrictLimiter, authenticate, hasPermission(['manage_content']), csrfProtection, submitReview);
router.post('/admin/intro/reject', cmsStrictLimiter, authenticate, hasPermission(['manage_content']), csrfProtection, rejectReview);
router.post('/admin/intro/publish', cmsStrictLimiter, authenticate, hasPermission(['manage_content']), csrfProtection, publish);
router.post('/admin/intro/unlock', cmsStrictLimiter, authenticate, hasPermission(['manage_content']), csrfProtection, unlock);
router.post('/admin/intro/rollback', cmsStrictLimiter, authenticate, hasPermission(['manage_content']), csrfProtection, rollbackVersion);
router.get('/admin/intro/versions', cmsLimiter, authenticate, hasPermission(['manage_content']), listVersions);
router.get('/admin/audit', cmsLimiter, authenticate, hasPermission(['manage_content']), listAudit);
export default router;
//# sourceMappingURL=cms.js.map
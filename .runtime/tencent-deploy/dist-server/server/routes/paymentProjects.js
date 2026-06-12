import { Router } from 'express';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { listPaymentProjects, upsertPaymentProject, deletePaymentProject } from '../controllers/paymentProjectController.js';
const router = Router();
router.use(authenticate);
router.use(adminLimiter);
router.use(hasPermission(['system_config']));
router.get('/', listPaymentProjects);
router.put('/:projectKey', csrfProtection, upsertPaymentProject);
router.delete('/:projectKey', csrfProtection, deletePaymentProject);
export default router;
//# sourceMappingURL=paymentProjects.js.map
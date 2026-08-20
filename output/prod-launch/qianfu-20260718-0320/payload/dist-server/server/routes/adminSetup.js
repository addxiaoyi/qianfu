import { Router } from 'express';
import { setupSoleAdmin, getAdminStatus } from '../controllers/adminSetupController.js';
import { authenticate } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { verifySignature } from '../middleware/signature.js';
import { validateBody } from '../middleware/requestValidation.js';
import { setupSoleAdminSchema } from '../utils/validation.js';
const router = Router();
// Set system sole admin
router.post('/setup-sole-admin', adminLimiter, authenticate, verifySignature, validateBody(setupSoleAdminSchema), setupSoleAdmin);
// Get admin status
router.get('/admin-status', adminLimiter, authenticate, verifySignature, getAdminStatus);
export default router;
//# sourceMappingURL=adminSetup.js.map
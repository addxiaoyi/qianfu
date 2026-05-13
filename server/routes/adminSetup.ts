import { Router } from 'express';
import { setupSoleAdmin, getAdminStatus } from '../controllers/adminSetupController';
import { authenticate } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimiter';
import { verifySignature } from '../middleware/signature';
import { validateBody } from '../middleware/requestValidation';
import { setupSoleAdminSchema } from '../utils/validation';

const router = Router();

// Set system sole admin
router.post('/setup-sole-admin', adminLimiter, authenticate, verifySignature, validateBody(setupSoleAdminSchema), setupSoleAdmin);

// Get admin status
router.get('/admin-status', adminLimiter, authenticate, verifySignature, getAdminStatus);

export default router;

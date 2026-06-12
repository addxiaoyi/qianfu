import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { updatePreferences, getPreferences } from '../controllers/preferencesController.js';
import { userLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateBody } from '../middleware/requestValidation.js';
import { preferencesUpdateSchema } from '../utils/validation.js';
const router = Router();
// All preference routes require authentication
router.use(authenticate);
router.use(userLimiter);
// Get user preferences
router.get('/', getPreferences);
// Update user preferences
router.put('/', csrfProtection, validateBody(preferencesUpdateSchema), updatePreferences);
export default router;
//# sourceMappingURL=preferences.js.map
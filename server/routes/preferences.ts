import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { updatePreferences, getPreferences } from '../controllers/preferencesController';
import { userLimiter } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrf';
import { validateBody } from '../middleware/requestValidation';
import { preferencesUpdateSchema } from '../utils/validation';

const router = Router();

// All preference routes require authentication
router.use(authenticate);
router.use(userLimiter);

// Get user preferences
router.get('/', getPreferences);

// Update user preferences
router.put('/', csrfProtection, validateBody(preferencesUpdateSchema), updatePreferences);

export default router;

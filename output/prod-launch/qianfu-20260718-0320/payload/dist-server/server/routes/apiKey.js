import { Router } from 'express';
import { createApiKey, listApiKeys, deleteApiKey, rotateApiKey, getApiKeyStats, } from '../controllers/apiKeyController.js';
import { authenticate } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
const router = Router();
const useCsrf = process.env.NODE_ENV !== 'test';
const noopCsrf = (_req, _res, next) => next();
const writeCsrf = useCsrf ? csrfProtection : noopCsrf;
// All API key routes require authentication
router.use(authenticate);
router.use(adminLimiter);
// List API keys for current user
router.get('/', listApiKeys);
// Create a new API key
router.post('/', writeCsrf, createApiKey);
// Rotate an existing API key
router.post('/rotate', writeCsrf, rotateApiKey);
// Get API key statistics
router.get('/stats', getApiKeyStats);
// Delete an API key
router.delete('/:id', writeCsrf, deleteApiKey);
export default router;
//# sourceMappingURL=apiKey.js.map
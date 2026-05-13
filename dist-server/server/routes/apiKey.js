import { Router } from 'express';
import { createApiKey, listApiKeys, deleteApiKey, rotateApiKey, getApiKeyStats, } from '../controllers/apiKeyController';
import { authenticate } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimiter';
const router = Router();
// All API key routes require authentication
router.use(authenticate);
router.use(adminLimiter);
// List API keys for current user
router.get('/', listApiKeys);
// Create a new API key
router.post('/', createApiKey);
// Rotate an existing API key
router.post('/rotate', rotateApiKey);
// Get API key statistics
router.get('/stats', getApiKeyStats);
// Delete an API key
router.delete('/:id', deleteApiKey);
export default router;
//# sourceMappingURL=apiKey.js.map
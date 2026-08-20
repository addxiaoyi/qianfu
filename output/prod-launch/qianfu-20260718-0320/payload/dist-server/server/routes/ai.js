import { Router } from 'express';
import { chat } from '../controllers/aiController.js';
import { authenticate } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateBody } from '../middleware/requestValidation.js';
import { aiChatSchema } from '../utils/validation.js';
const router = Router();
router.post('/chat', authenticate, aiLimiter, csrfProtection, validateBody(aiChatSchema), chat);
export default router;
//# sourceMappingURL=ai.js.map
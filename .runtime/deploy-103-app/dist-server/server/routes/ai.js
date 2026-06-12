import { Router } from 'express';
import { chat } from '../controllers/aiController.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateBody } from '../middleware/requestValidation.js';
import { aiChatSchema } from '../utils/validation.js';
const router = Router();
// Optional: require authentication?
// router.use(authenticate); 
router.post('/chat', aiLimiter, csrfProtection, validateBody(aiChatSchema), chat);
export default router;
//# sourceMappingURL=ai.js.map
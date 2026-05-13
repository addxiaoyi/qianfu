import { Router } from 'express';
import { chat } from '../controllers/aiController';
import { aiLimiter } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrf';
import { validateBody } from '../middleware/requestValidation';
import { aiChatSchema } from '../utils/validation';

const router = Router();

// Optional: require authentication?
// router.use(authenticate); 

router.post('/chat', aiLimiter, csrfProtection, validateBody(aiChatSchema), chat);

export default router;

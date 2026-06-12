import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard.js';
import { createTicket, getTickets, getTicket, addMessage, updateTicketStatus } from '../controllers/ticketController.js';
import { ticketLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateBody, validateParams, validateQuery } from '../middleware/requestValidation.js';
import { createDuplicateRequestGuard, createIdempotencyMiddleware } from '../middleware/idempotency.js';
import { idParamSchema, ticketMessageSchema, ticketQuerySchema, ticketSchema, ticketStatusSchema } from '../utils/validation.js';
const router = Router();
router.use(authenticate);
router.use(ticketLimiter);
router.post('/', requireVerifiedEmail, csrfProtection, createDuplicateRequestGuard({ ttlSeconds: 10 }), createIdempotencyMiddleware({ ttlSeconds: 60 * 60 }), validateBody(ticketSchema), createTicket);
router.get('/', validateQuery(ticketQuerySchema), getTickets);
router.get('/:id', validateParams(idParamSchema), getTicket);
router.put('/:id/status', csrfProtection, validateParams(idParamSchema), validateBody(ticketStatusSchema), updateTicketStatus);
router.post('/:id/messages', requireVerifiedEmail, csrfProtection, createDuplicateRequestGuard({ ttlSeconds: 5 }), validateParams(idParamSchema), validateBody(ticketMessageSchema), addMessage);
export default router;
//# sourceMappingURL=tickets.js.map
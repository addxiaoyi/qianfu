import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard';
import { createTicket, getTickets, getTicket, addMessage, updateTicketStatus } from '../controllers/ticketController';
import { ticketLimiter } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrf';
import { validateBody, validateParams, validateQuery } from '../middleware/requestValidation';
import { createDuplicateRequestGuard, createIdempotencyMiddleware } from '../middleware/idempotency';
import { idParamSchema, ticketMessageSchema, ticketQuerySchema, ticketSchema, ticketStatusSchema } from '../utils/validation';
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
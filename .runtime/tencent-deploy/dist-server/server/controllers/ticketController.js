import { sendCreatedResponse, sendDetailResponse, sendListResponse, sendUpdatedResponse, } from '../utils/response.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import prisma from '../db.js';
import { logger } from '../utils/logger.js';
import { notificationQueue } from '../services/notificationQueue.js';
import { redisService } from '../services/redisService.js';
import { logDataChange } from '../services/auditService.js';
import { ticketSchema, ticketMessageSchema, ticketStatusSchema, idParamSchema, ticketQuerySchema } from '../utils/validation.js';
import { sanitize } from '../services/sanitize.js';
import { buildDateRange, buildKeywordOrConditions, buildPagination, resolveSortField, resolveSortOrder, } from '../utils/queryBuilder.js';
export const createTicket = async (req, res, next) => {
    try {
        const validation = ticketSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: validation.error.issues,
            });
        }
        const { title, description, priority, paymentId } = validation.data;
        // Rate limit ticket creation (1 per minute)
        const rateLimitKey = `ticket:create:${req.user.id}`;
        const lastCreated = await redisService.get(rateLimitKey);
        if (lastCreated) {
            throw new AppError('Please wait a moment before creating another ticket', 429, ErrorCode.LIMIT_EXCEEDED);
        }
        // Security check: if paymentId is provided, verify it belongs to the user (unless admin)
        if (paymentId && !req.isAdmin) {
            const payment = await prisma.payment.findUnique({
                where: { id: paymentId }
            });
            if (!payment || payment.user_id !== req.user.id) {
                throw new AppError('Invalid payment ID', 400, ErrorCode.VALIDATION_ERROR);
            }
        }
        // Sanitize title and description
        const cleanTitle = sanitize(title, { allowedTags: [] });
        const cleanDescription = sanitize(description);
        const ticket = await prisma.ticket.create({
            data: {
                title: cleanTitle,
                description: cleanDescription,
                priority: priority || 'MEDIUM',
                payment_id: paymentId,
                user_id: req.user.id,
                messages: {
                    create: {
                        content: cleanDescription,
                        sender_id: req.user.id,
                        is_ai: false
                    }
                }
            }
        });
        // Set rate limit for next request
        await redisService.set(rateLimitKey, 'true', 60);
        // Notify admins asynchronously
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { email: true }
        });
        const adminEmails = admins.map(a => a.email).filter(Boolean);
        if (adminEmails.length > 0) {
            await notificationQueue.push({
                type: 'TICKET_NOTIFICATION',
                payload: { ticket, user: req.user, adminEmails },
                userId: req.user.id
            });
        }
        await logDataChange(req.user.id, 'CREATE_TICKET', `ticket_${ticket.id}`, req, null, ticket);
        return sendCreatedResponse(res, ticket, {
            resource: 'Ticket',
            location: `/api/v1/tickets/${ticket.id}`,
        });
    }
    catch (err) {
        next(err);
    }
};
export const getTickets = async (req, res, next) => {
    try {
        const validation = ticketQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: validation.error.issues,
            });
        }
        const { page, limit, status, priority, search, fuzzy, sortBy, sortOrder, startDate, endDate } = validation.data;
        const { skip, take } = buildPagination({ page, limit });
        const where = req.isAdmin ? {} : { user_id: req.user.id };
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (search) {
            where.OR = [
                ...buildKeywordOrConditions(['title', 'description'], search, fuzzy),
            ];
        }
        const range = buildDateRange({ startDate, endDate });
        if (range) {
            where.created_at = range;
        }
        const normalizedSortField = resolveSortField(sortBy, ['updated_at', 'created_at', 'priority', 'status'], 'updated_at');
        const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');
        const [tickets, total] = await Promise.all([
            prisma.ticket.findMany({
                where,
                orderBy: { [normalizedSortField]: normalizedSortOrder },
                include: {
                    messages: {
                        take: 1,
                        orderBy: { created_at: 'desc' }
                    },
                    user: req.isAdmin ? { select: { username: true, email: true } } : false
                },
                skip,
                take,
            }),
            prisma.ticket.count({ where })
        ]);
        return sendListResponse(res, tickets, total, page, limit, { resource: 'Ticket' });
    }
    catch (err) {
        next(err);
    }
};
export const getTicket = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid ID format', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: idValidation.error.issues,
            });
        }
        const { id } = idValidation.data;
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: { created_at: 'asc' },
                    include: { sender: { select: { username: true, avatar_url: true, role: true } } }
                },
                user: { select: { username: true, email: true, role: true } }
            }
        });
        if (!ticket) {
            throw new AppError('Ticket not found', 404, ErrorCode.NOT_FOUND);
        }
        if (ticket.user_id !== req.user.id && !req.isAdmin) {
            throw new AppError('Unauthorized', 403, ErrorCode.FORBIDDEN);
        }
        return sendDetailResponse(res, ticket, { resource: 'Ticket' });
    }
    catch (err) {
        next(err);
    }
};
export const updateTicketStatus = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid ID format', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: idValidation.error.issues,
            });
        }
        const { id } = idValidation.data;
        const validation = ticketStatusSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: validation.error.issues,
            });
        }
        const { status } = validation.data;
        const ticket = await prisma.ticket.findUnique({ where: { id } });
        if (!ticket) {
            throw new AppError('Ticket not found', 404, ErrorCode.NOT_FOUND);
        }
        // Only admin can change to anything. User can only CLOSE their own ticket.
        if (req.isAdmin) {
            // Admin can do anything
        }
        else if (ticket.user_id === req.user.id) {
            if (status !== 'CLOSED') {
                throw new AppError('Users can only close tickets', 403, ErrorCode.FORBIDDEN);
            }
        }
        else {
            throw new AppError('Unauthorized', 403, ErrorCode.FORBIDDEN);
        }
        const updated = await prisma.ticket.update({
            where: { id },
            data: {
                status,
                updated_at: new Date()
            }
        });
        await logDataChange(req.user.id, 'UPDATE_TICKET_STATUS', `ticket_${id}`, req, ticket, updated);
        return sendUpdatedResponse(res, updated, { resource: 'Ticket' });
    }
    catch (err) {
        next(err);
    }
};
/**
 * Cleanup stale tickets (inactive for 30 days and not closed)
 */
export const cleanupOldTickets = async () => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const result = await prisma.ticket.deleteMany({
            where: {
                updated_at: { lt: thirtyDaysAgo },
                status: { not: 'CLOSED' }
            }
        });
        if (result.count > 0) {
            logger.info(`[Cleanup] Deleted ${result.count} stale tickets.`);
        }
    }
    catch (err) {
        logger.error('[Cleanup] Error cleaning up tickets:', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
};
/**
 * Add a new message to a ticket
 */
export const addMessage = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid ID format', 400, ErrorCode.VALIDATION_ERROR, true, idValidation.error.issues);
        }
        const { id } = idValidation.data;
        const validation = ticketMessageSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, validation.error.issues);
        }
        const { content } = validation.data;
        const ticket = await prisma.ticket.findUnique({ where: { id } });
        if (!ticket) {
            throw new AppError('Ticket not found', 404, ErrorCode.NOT_FOUND);
        }
        if (ticket.user_id !== req.user.id && !req.isAdmin) {
            throw new AppError('Unauthorized', 403, ErrorCode.FORBIDDEN);
        }
        const cleanContent = sanitize(content);
        const { message, updatedTicket } = await prisma.$transaction(async (tx) => {
            const msg = await tx.ticketMessage.create({
                data: {
                    ticket_id: id,
                    content: cleanContent,
                    sender_id: req.user.id,
                    is_ai: false
                }
            });
            const updated = await tx.ticket.update({
                where: { id },
                data: { updated_at: new Date() }
            });
            return { message: msg, updatedTicket: updated };
        });
        await logDataChange(req.user.id, 'ADD_TICKET_MESSAGE', `ticket_${id}`, req, ticket, updatedTicket);
        return sendCreatedResponse(res, message, {
            resource: 'Ticket message',
            location: `/api/v1/tickets/${id}`,
            statusCode: 201,
        });
    }
    catch (err) {
        next(err);
    }
};
//# sourceMappingURL=ticketController.js.map
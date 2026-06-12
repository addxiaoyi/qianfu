import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const createTicket: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getTickets: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getTicket: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateTicketStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Cleanup stale tickets (inactive for 30 days and not closed)
 */
export declare const cleanupOldTickets: () => Promise<void>;
/**
 * Add a new message to a ticket
 */
export declare const addMessage: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=ticketController.d.ts.map
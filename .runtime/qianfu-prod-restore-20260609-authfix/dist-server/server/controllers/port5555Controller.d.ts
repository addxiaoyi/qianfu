import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getPort5555Stats: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get Port 5555 access logs
 */
export declare const getPort5555AccessLogs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Export Port 5555 access logs
 */
export declare const exportPort5555AccessLogs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Cleanup Port 5555 access logs
 */
export declare const cleanupPort5555Logs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get current Port 5555 configuration
 */
export declare const getPort5555Config: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Recheck a specific port5555 access log record.
 * Compares "actual" access outcome stored in AuditLog.action with the
 * expected access outcome derived from the target user's role/permissions.
 */
export declare const recheckPort5555AccessLog: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=port5555Controller.d.ts.map
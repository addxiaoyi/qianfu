import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
/**
 * Get audit logs
 */
export declare const getAuditLogs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get audit statistics
 */
export declare const getAuditStats: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get audit log time series data
 */
export declare const getAuditTimeSeries: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Generate audit report
 */
export declare const generateAuditReport: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Cleanup old audit logs
 */
export declare const cleanupAuditLogs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Export audit logs
 */
export declare const exportAuditLogs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=auditController.d.ts.map
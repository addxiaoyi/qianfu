/**
 * Server version control endpoints
 */
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
/**
 * Rollback server to a previous version
 */
export declare const rollbackServer: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get server details by ID
 */
export declare const getServer: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * List server versions
 */
export declare const listVersions: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Compare two saved server content versions (side-by-side data for admin/owner).
 */
export declare const compareServerVersions: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=versions.d.ts.map
/**
 * User-related server endpoints
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
/**
 * Get current user profile and server limits
 */
export declare const getMe: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * List servers owned by current user
 */
export declare const listMyServers: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=user.d.ts.map
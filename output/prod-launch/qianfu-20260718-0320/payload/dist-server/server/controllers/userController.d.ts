import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
/**
 * Get current user profile
 */
export declare const getProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Update current user profile
 */
export declare const updateProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * List biography versions for current user
 */
export declare const listBioVersions: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=userController.d.ts.map
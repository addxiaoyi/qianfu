import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
/**
 * Update user preferences
 */
export declare const updatePreferences: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get user preferences
 */
export declare const getPreferences: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=preferencesController.d.ts.map
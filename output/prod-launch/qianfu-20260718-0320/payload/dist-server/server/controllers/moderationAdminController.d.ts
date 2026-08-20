import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
/**
 * Get list of moderation settings (Admin only)
 */
export declare const getModerationSettings: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Update a moderation setting (Admin only)
 */
export declare const updateModerationSetting: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Retrieve moderation logs (Admin only)
 */
export declare const getModerationLogs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Manually review a moderation log (Admin only)
 */
export declare const reviewModerationLog: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=moderationAdminController.d.ts.map
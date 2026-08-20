import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
export declare function getPublicAnnouncement(_req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getAdminAnnouncements(_req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function createAdminAnnouncement(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function updateAdminAnnouncement(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function deleteAdminAnnouncement(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=announcementController.d.ts.map
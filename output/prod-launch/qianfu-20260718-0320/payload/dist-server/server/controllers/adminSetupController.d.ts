import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const setupSoleAdmin: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAdminStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=adminSetupController.d.ts.map
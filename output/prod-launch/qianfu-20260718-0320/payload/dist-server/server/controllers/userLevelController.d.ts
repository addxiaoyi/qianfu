import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getCheckinStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const postCheckin: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=userLevelController.d.ts.map
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
export declare const port5555Auth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const port5555Session: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const port5555RateLimit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const port5555SecurityHeaders: (req: Request, res: Response, next: NextFunction) => void;
declare global {
    namespace Express {
        interface Request {
            port5555Access?: {
                hasAccess: boolean;
                userRole: string;
                userPermissions: string[];
                accessTime: Date;
            };
        }
    }
}
//# sourceMappingURL=port5555Auth.d.ts.map
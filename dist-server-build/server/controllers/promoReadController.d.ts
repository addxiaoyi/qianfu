import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
export declare const getUserPromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>;
export declare const getAdminPromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>;
export declare const listAdminPromoClaims: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>;
//# sourceMappingURL=promoReadController.d.ts.map
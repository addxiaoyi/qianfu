import type { NextFunction, Response } from 'express';
import { type AuthRequest } from '../middleware/auth';
export declare const recordPromoClaimMetrics: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>;
export declare const getPromoClaimProgress: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>;
//# sourceMappingURL=promoMetricController.d.ts.map
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
/**
 * Require users to verify/bind email before accessing advanced actions.
 */
export declare const requireVerifiedEmail: (req: AuthRequest, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=emailVerifiedGuard.d.ts.map
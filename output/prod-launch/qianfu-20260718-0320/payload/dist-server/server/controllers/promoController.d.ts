import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const validateTaskPayload: (body: Record<string, unknown>) => {
    title: string;
    platform: string;
    targetId: string;
    targetUrl: string;
    rewardAmount: number;
};
interface PromoClaimCapacity {
    claimLimitPerUser: number;
    dailyLimit: number | null;
    totalLimit: number | null;
    userClaimCount: number;
    dailyClaimCount: number;
    totalClaimCount: number;
}
export declare const assertPromoClaimCapacity: (capacity: PromoClaimCapacity) => void;
export declare const listPromoTasks: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPromoClaimDetail: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createPromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updatePromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const publishPromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const pausePromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const disablePromoTask: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const bindPlatformAccount: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyBindings: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyPromoClaims: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const approvePromoClaim: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const rejectPromoClaim: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPromoAuditSummary: (_req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=promoController.d.ts.map
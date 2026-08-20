import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth';
export declare const listPaymentProjects: (_req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const upsertPaymentProject: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deletePaymentProject: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPaymentProjectDiagnostics: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPaymentProjectXpayTenant: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const syncPaymentProjectXpayTenant: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const uploadPaymentProjectXpayTenantQr: (req: Request & {
    file?: Express.Multer.File;
}, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createPaymentProjectTestOrder: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPaymentProjectOrder: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const simulatePaymentProjectOrderSuccess: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=paymentProjectController.d.ts.map
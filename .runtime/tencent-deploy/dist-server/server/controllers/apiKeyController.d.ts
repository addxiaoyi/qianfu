import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const createApiKey: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const listApiKeys: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteApiKey: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const rotateApiKey: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getApiKeyStats: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const validateApiKey: (key: string) => Promise<{
    apiKey: any;
    plainKey: string;
    permissions: string[];
} | null>;
//# sourceMappingURL=apiKeyController.d.ts.map
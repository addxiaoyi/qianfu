import type { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
export declare function startCloudflareOauth(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function cloudflareOauthCallback(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function revokeCloudflareOauthController(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function listFreeDomainSuffixes(_req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function listAdminFreeDomainSuffixes(_req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function upsertAdminFreeDomainSuffix(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getServerDomainStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function retryDnsTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function listAdminDnsTasks(_req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function revokeServerDomain(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function runDnsTasks(_req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=freeDomainDnsController.d.ts.map
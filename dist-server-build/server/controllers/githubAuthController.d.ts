import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth';
export declare const startGitHubAuth: (_req: Request, res: ExpressResponse, next: NextFunction) => Promise<void>;
export declare const handleGitHubAuthCallback: (req: Request, res: ExpressResponse, _next: NextFunction) => Promise<void>;
export declare const getGitHubLinkStatus: (req: AuthRequest, res: ExpressResponse, next: NextFunction) => Promise<void | ExpressResponse<any, Record<string, any>>>;
export declare const unlinkGitHubIdentity: (req: AuthRequest, res: ExpressResponse, next: NextFunction) => Promise<void | ExpressResponse<any, Record<string, any>>>;
//# sourceMappingURL=githubAuthController.d.ts.map
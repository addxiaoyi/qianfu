import type { Request, Response as ExpressResponse, NextFunction } from 'express';
export declare const startGitHubAuth: (_req: Request, res: ExpressResponse, next: NextFunction) => Promise<void>;
export declare const handleGitHubAuthCallback: (req: Request, res: ExpressResponse, next: NextFunction) => Promise<void>;
//# sourceMappingURL=githubAuthController.d.ts.map
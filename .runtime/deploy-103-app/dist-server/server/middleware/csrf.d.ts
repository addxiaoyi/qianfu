import { Request, Response, NextFunction } from 'express';
export declare const csrfProtection: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const cleanupCsrfCache: () => Promise<number>;
export declare const generateCsrfTokens: (req: Request, res: Response, next: NextFunction) => void;
export declare const rotateCsrfToken: (req: Request, res: Response, next: NextFunction) => void;
export declare const clearCsrfTokens: (res: Response) => void;
export declare const validateCsrfOrigin: (req: Request, _res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const createCsrfErrorHandler: () => (err: Error, _req: Request, res: Response, _next: NextFunction) => void;
//# sourceMappingURL=csrf.d.ts.map
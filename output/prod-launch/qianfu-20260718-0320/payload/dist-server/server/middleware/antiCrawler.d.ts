import { Request, Response, NextFunction } from 'express';
export declare const antiCrawler: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const addToBlacklist: (ip: string) => Promise<void>;
//# sourceMappingURL=antiCrawler.d.ts.map
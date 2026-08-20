import { Request, Response, NextFunction } from 'express';
interface WAFConfig {
    enabled: boolean;
    blockSuspiciousIPs: boolean;
    rateLimitWindow: number;
    maxRequestsPerWindow: number;
}
export declare function createWAFMiddleware(config: WAFConfig): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare function getWAFStats(): Promise<{
    redisEnabled: boolean;
    activeBans: string;
}>;
export {};
//# sourceMappingURL=waf.d.ts.map
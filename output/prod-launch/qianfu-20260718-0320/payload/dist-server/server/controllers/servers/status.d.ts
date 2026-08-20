/**
 * Server status check endpoint
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Check Minecraft server status with SSRF protection
 */
export declare const checkServerStatus: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=status.d.ts.map
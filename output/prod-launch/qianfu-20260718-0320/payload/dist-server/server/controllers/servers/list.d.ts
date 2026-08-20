/**
 * Server public listing endpoint
 */
import { Request, Response, NextFunction } from 'express';
/**
 * List all approved public servers
 */
export declare const listAllServers: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=list.d.ts.map
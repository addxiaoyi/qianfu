import { Request, Response, NextFunction } from 'express';
/**
 * Get Minecraft server status
 * @param req Request object
 * @param res Response object
 * @param next Error passing middleware
 */
export declare const getServerStatus: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Batch get multiple Minecraft server status (parallel detection)
 * @param req Request object
 * @param res Response object
 * @param next Error passing middleware
 */
export declare const getMultipleServerStatusHandler: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=probeController.d.ts.map
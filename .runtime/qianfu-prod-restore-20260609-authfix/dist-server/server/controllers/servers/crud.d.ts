/**
 * Server CRUD operations
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
/**
 * Create a new server
 */
export declare const createServer: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Update an existing server
 */
export declare const updateServer: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Delete a server
 */
export declare const deleteServer: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=crud.d.ts.map
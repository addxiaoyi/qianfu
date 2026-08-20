import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getPendingReviews: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Review a server submission
 */
export declare const reviewServer: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Retrieve review history for a server
 */
export declare const getReviewHistory: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Batch review multiple servers
 */
export declare const batchReview: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get review system statistics
 */
export declare const getReviewStats: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=reviewController.d.ts.map
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
export declare function getOwnNewsSubmissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function createOwnNewsSubmission(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function updateOwnNewsSubmissionController(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getNewsSubmissionsForReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function approveNewsSubmissionController(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function rejectNewsSubmissionController(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=newsSubmissionController.d.ts.map
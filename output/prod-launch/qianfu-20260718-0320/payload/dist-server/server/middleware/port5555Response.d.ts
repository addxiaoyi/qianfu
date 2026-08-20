import { Response } from 'express';
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export declare function successResponse<T>(res: Response, data?: T, message?: string, statusCode?: number): void;
export declare function errorResponse(res: Response, error: string, statusCode?: number): void;
//# sourceMappingURL=port5555Response.d.ts.map
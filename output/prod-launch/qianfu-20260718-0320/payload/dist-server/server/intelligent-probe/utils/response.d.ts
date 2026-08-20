import { Response } from 'express';
export declare const successResponse: <T>(res: Response, data: T, message?: string, statusCode?: number) => void;
export declare const errorResponse: (res: Response, message?: string, statusCode?: number, errorDetails?: any) => void;
//# sourceMappingURL=response.d.ts.map
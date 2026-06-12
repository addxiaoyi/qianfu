/**
 * 全局错误处理中间件
 * 统一处理所有错误，提供一致的错误响应
 */
import type { Request, Response, NextFunction } from 'express';
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function asyncHandler(fn: AsyncRequestHandler): (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=errorHandler.d.ts.map
import { Request, Response, NextFunction } from 'express';
import type { SessionContainerInterface } from 'supertokens-node/recipe/session/types';
import { User } from '../db';
export interface AuthRequest extends Request {
    user?: User;
    isAdmin?: boolean;
    stSession?: SessionContainerInterface;
    file?: Express.Multer.File;
}
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateOptional: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authorize: (roles?: string[]) => (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare const adminOnly: (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare const hasPermission: (permissions: string[]) => (req: AuthRequest, _res: Response, next: NextFunction) => void;
/**
 * 清除用户缓存
 * 在用户信息更新后调用，确保下次认证时获取最新数据
 */
export declare function invalidateUserCache(userId: string | number): Promise<void>;
//# sourceMappingURL=auth.d.ts.map
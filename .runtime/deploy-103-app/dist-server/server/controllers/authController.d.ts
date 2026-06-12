import { Request, Response, NextFunction } from 'express';
export declare const login: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 开发环境降级登录（不依赖 SuperTokens Core）
 */
export declare const devLogin: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 开发环境降级登出
 */
export declare const devLogout: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 检查用户名是否可用（注册前调用）
 */
export declare const checkUsernameAvailability: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 修改密码（凭证由 SuperTokens EmailPassword 管理）
 */
export declare const changePassword: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 列出当前 SuperTokens 会话
 */
export declare const getSessions: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 撤销指定 SuperTokens 会话（sessionId 为 session handle）
 */
export declare const revokeSession: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 登出：撤销当前 SuperTokens 会话并清理历史 JWT Cookie（兼容旧客户端）
 */
export declare const logout: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 注册统计（管理）
 */
export declare const getRegistrationStats: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=authController.d.ts.map
import { Request, Response, NextFunction } from 'express';
/**

 * 注册用户

 * 流程：验证验证码 → 创建用户 → 创建 SuperTokens 用户 → 创建会话 → 返回 token

 * 支持 email 和 phone 双通道注册

 *

 * 关键修复：注册成功后立即清除 Prisma 中的 verification_token，

 * 防止验证码被复用攻击。

 */
export declare const registerUser: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=registerController.d.ts.map
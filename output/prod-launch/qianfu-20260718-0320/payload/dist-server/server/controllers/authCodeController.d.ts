import { Request, Response, NextFunction } from 'express';
/**
 * 发送验证码
 * 支持 email 和 phone 双通道
 */
export declare const sendLoginCode: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**

 * 验证验证码

 * 支持 email 和 phone 双通道

 */
export declare const verifyLoginCode: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=authCodeController.d.ts.map
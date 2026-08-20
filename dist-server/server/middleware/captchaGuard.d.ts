import { Request, Response, NextFunction } from 'express';
/**
 * 验证客户端提交的 CAPTCHA/Turnstile Token
 * 如果配置了 CAPTCHA_SECRET_KEY，则对关键路由强制进行人机验证
 */
export declare function captchaGuard(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=captchaGuard.d.ts.map
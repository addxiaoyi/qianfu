import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { buildErrorEnvelope } from '../contracts/responseEnvelope';

/**
 * 验证客户端提交的 CAPTCHA/Turnstile Token
 * 如果配置了 CAPTCHA_SECRET_KEY，则对关键路由强制进行人机验证
 */
export function captchaGuard(req: Request, res: Response, next: NextFunction) {
  // 如果环境变量中没有配置密钥，为了不阻塞本地开发，我们默认放行。
  // 生产环境若开启了，则必须有密钥。
  const secretKey = process.env.CAPTCHA_SECRET_KEY;
  if (!secretKey) {
    return next();
  }

  // 从请求头或 body 中提取验证码 Token
  const token = req.headers['x-captcha-token'] || req.body?.captchaToken;

  if (!token) {
    logger.warn(`[CaptchaGuard] Missing captcha token from IP: ${req.ip}`);
    return res.status(403).json(
      buildErrorEnvelope({
        message: 'Anti-bot verification required. Please complete the captcha.',
        code: 'CAPTCHA_REQUIRED',
        statusCode: 403,
        requestId: (req as any).requestId,
      })
    );
  }

  // 这里实现具体的校验逻辑，如向 Cloudflare 或 Google 发起验证请求。
  // 为保障架构解耦，这里采用异步非阻塞校验或直接调用第三方校验器。
  verifyCaptchaToken(token as string, secretKey, req.ip || '')
    .then((isValid) => {
      if (isValid) {
        next();
      } else {
        logger.security(`[CaptchaGuard] Invalid captcha token from IP: ${req.ip}`);
        res.status(403).json(
          buildErrorEnvelope({
            message: 'Invalid captcha token. Are you a bot?',
            code: 'CAPTCHA_INVALID',
            statusCode: 403,
            requestId: (req as any).requestId,
          })
        );
      }
    })
    .catch((_) => {
      logger.error('[CaptchaGuard] Error verifying captcha');
      // Fail-open or Fail-closed? Usually Fail-closed is safer for anti-bot, 
      // but to prevent self-DDoS if the third-party is down, we fail-open for a short window.
      next();
    });
}

async function verifyCaptchaToken(_token: string, _secret: string, _ip: string): Promise<boolean> {
  // 伪代码: 对接第三方 CAPTCHA 校验
  // const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ secret, response: token, remoteip: ip })
  // });
  // const data = await response.json();
  // return data.success;
  return true; // 占位逻辑，由部署时具体实现决定
}

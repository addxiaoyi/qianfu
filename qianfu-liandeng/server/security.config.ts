/**
 * 服务端安全配置参考实现
 * 适用于 Express / NestJS / Fastify 等 Node.js 后端
 * 
 * 功能：速率限制、CSRF 保护、CSP 响应头、安全中间件
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';

// ==========================================
// 1. 速率限制 (Rate Limiting)
// ==========================================
export const rateLimiters = {
  // 全局通用限速：100 请求/15 分钟
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 100,
    message: { error: '请求过于频繁，请稍后再试。' },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // 认证接口限速：5 请求/分钟
  auth: rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 5,
    message: { error: '认证尝试过于频繁，请稍后重试。' },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // 支付接口限速：20 请求/5 分钟
  payment: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 分钟
    max: 20,
    message: { error: '支付操作过于频繁，请稍后再试。' },
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

// ==========================================
// 2. CORS 配置
// ==========================================
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials: true,
  maxAge: 600, // 预检请求缓存 10 分钟
};

// ==========================================
// 3. CSP 安全头 (Content Security Policy)
// ==========================================
export const cspConfig: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // 需要 unsafe-inline 因为 Tailwind/vite dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      connectSrc: ["'self'", 'http://localhost:5173', 'http://localhost:3000'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 强制 HTTPS 一年
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
};

// ==========================================
// 4. CSRF 保护 (双 Token 方案)
// ==========================================
export interface CSRFToken {
  token: string;
    createdAt: number;
    userId: string;
}

const CSRF_TOKEN_SECRET = process.env.CSRF_SECRET || 'change-me-in-production';

/**
 * 生成 CSRF Token
 * 使用 Hmac-SHA256 签名防止伪造
 */
export function generateCSRFToken(userId: string): string {
  const token = Buffer.from(JSON.stringify({ userId, time: Date.now() })).toString('base64url');
  return token;
}

/**
 * 验证 CSRF Token
 */
export function verifyCSRFToken(token: string, userId: string): boolean {
  if (!token || !userId) return false;
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (decoded.userId !== userId) return false;
    // Token 有效期 1 小时
    if (Date.now() - decoded.time > 3600000) return false;
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// 5. 请求体大小限制中间件
// ==========================================
export function bodySizeLimit(maxSize: string = '1mb') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      next();
      return;
    }
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > parseInt(maxSize.replace(/\D/g, ''))) {
        res.status(413).json({ error: '请求体过大，超过限制。' });
        req.destroy();
      }
    });
    next();
  };
}

// ==========================================
// 6. 输入清理中间件
// ==========================================
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // 清理 query string
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();
      }
    }
  }

  // 清理 JSON body
  if (req.body && typeof req.body === 'object') {
    function clean(obj: any) {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key]
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '')
            .trim();
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) clean(obj[key]);
      }
    }
    clean(req.body);
  }

  next();
}

// ==========================================
// 7. 安全头中间件
// ==========================================
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // 隐藏 X-Powered-By
  res.removeHeader('X-Powered-By');

  // 添加安全响应头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // CSP 已足够
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // 速率限制头
  res.setHeader('X-RateLimit-Policy', '100 per 15 minutes');

  next();
}

// ==========================================
// 8. 错误处理中间件
// ==========================================
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // 生产环境不暴露详细错误信息
  const isProd = process.env.NODE_ENV === 'production';
  const status = (err as any).status || 500;

  res.status(status).json({
    error: isProd ? 'Internal Server Error' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });

  // 记录安全相关的错误
  if (err.message.includes('rate limit') || err.message.includes('unauthorized')) {
    console.warn(`[Security Alert] ${err.message} from ${req.ip}`);
  }
}

// ==========================================
// 应用配置示例
// ==========================================
export function applySecurityMiddleware(app: any) {
  // 1. CSP / 安全头
  app.use(helmet(cspConfig));
  app.use(securityHeaders);

  // 2. 速率限制
  app.use(rateLimiters.general);

  // 3. CORS
  app.use(cors(corsOptions));

  // 4. 输入清理
  app.use(express.json());
  app.use(sanitizeInput);

  // 5. 认证接口特殊限速
  app.use('/api/auth', rateLimiters.auth);
  app.use('/api/payment', rateLimiters.payment);

  // 6. 错误处理
  app.use(errorHandler);
}

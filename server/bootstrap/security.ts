import type { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import { logger } from '../utils/logger';

export function registerSecurityHeaders(app: Application) {
  const isProdEnv = process.env.NODE_ENV === 'production';

  logger.info('Initializing Helmet with custom CSP...');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      originAgentCluster: true,
      dnsPrefetchControl: { allow: false },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.tailwindcss.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          scriptSrc: ["'self'", 'https://cdn.tailwindcss.com', 'https://*.tinymce.com', 'https://*.tiny.cloud'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          frameSrc: ["'self'", 'https://*.bilibili.com', 'https://*.youtube.com', 'https://*.youku.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: isProdEnv ? [] : null,
          frameAncestors: ["'none'"],
          reportUri: process.env.CSP_REPORT_URI || null,
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProdEnv
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      xContentTypeOptions: true,
      xFrameOptions: { action: 'deny' },
    })
  );

  app.use((_req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
      );
    }
    next();
  });
}

export function registerCors(app: Application) {
  const allowedOrigins = getAllowedOrigins();

  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.has(origin)) {
          callback(null, true);
        } else if (process.env.NODE_ENV === 'production') {
          logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        } else {
          logger.debug(`[CORS] Allowing unknown origin in development: ${origin}`);
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'X-CSRF-Token',
        'Authorization',
        'x-csrf-token',
        'anti-csrf',
        'fdi-version',
        'rid',
        'st-auth-mode',
      ],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 86400,
      optionsSuccessStatus: 204,
    })
  );
}

export function registerHpp(app: Application) {
  app.use(
    hpp({
      whitelist: ['page', 'limit', 'sortBy', 'order', 'tags', 'category', 'status'],
    })
  );
}

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  if (process.env.NODE_ENV === 'production') {
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || [];
    for (const origin of envOrigins) origins.add(origin);

    if (process.env.FRONTEND_URL) origins.add(process.env.FRONTEND_URL);
    if (process.env.PREVIEW_URL) origins.add(process.env.PREVIEW_URL);
  } else {
    origins.add('http://localhost:4123');
    origins.add('http://127.0.0.1:4123');
    origins.add('http://localhost:4137');
    origins.add('http://127.0.0.1:4137');
  }

  return origins;
}

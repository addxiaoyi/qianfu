import type { Application } from 'express';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticate, hasPermission } from '../middleware/auth';
import { logger } from '../utils/logger';

const __filenameResolved =
  typeof import.meta.url !== 'undefined'
    ? fileURLToPath(import.meta.url)
    : typeof __filename !== 'undefined'
      ? __filename
      : '';

const __dirnameResolved = __filenameResolved
  ? path.dirname(__filenameResolved)
  : typeof __dirname !== 'undefined'
    ? __dirname
    : '';

const projectRoot = path.resolve(__dirnameResolved, '../../');
const PUBLIC_CMS_PATH_PATTERN = /^\/[a-zA-Z0-9/_.,~@-]*$/;
const INLINE_UPLOAD_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const resolveFrontendOrigin = () => {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    logger.warn('[FallbackMiddleware] Invalid FRONTEND_URL, skipping redirect fallback');
    return null;
  }
};

const publicCmsGuard: express.RequestHandler = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed on public CMS proxy' });
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    return res.status(400).json({ error: 'Invalid public CMS path encoding' });
  }
  if (
    req.originalUrl.length > 2048 ||
    !PUBLIC_CMS_PATH_PATTERN.test(decodedPath) ||
    decodedPath.includes('..') ||
    decodedPath.includes('//')
  ) {
    return res.status(400).json({ error: 'Invalid public CMS path' });
  }

  return next();
};

export function registerProxyRoutes(app: Application) {
  app.use(
    '/api/public/cms',
    publicCmsGuard,
    createProxyMiddleware({
      target: 'http://localhost:3030',
      changeOrigin: true,
      xfwd: false,
      timeout: 8000,
      proxyTimeout: 8000,
      pathRewrite: {
        '^/': '/api/',
      },
      on: {
        proxyReq: (proxyReq: any, req: any) => {
          proxyReq.removeHeader('cookie');
          proxyReq.removeHeader('authorization');
          proxyReq.setHeader('Accept', 'application/json, text/plain;q=0.9, */*;q=0.8');
          logger.info(`[Public Proxy] Forwarding ${req.method} ${req.url} -> ${proxyReq.path}`);
        },
        error: (err: Error, _req: any, res: any) => {
          logger.warn(`[Public Proxy] CMS proxy failed: ${err.message}`);
          if (!res.headersSent) {
            res.status(502).json({ error: 'Public CMS service unavailable' });
          }
        },
      },
    })
  );

  app.use(
    '/cms-api',
    authenticate,
    hasPermission(['manage_content']),
    createProxyMiddleware({
      target: 'http://localhost:3030',
      changeOrigin: true,
      xfwd: false,
      timeout: 15000,
      proxyTimeout: 15000,
      pathRewrite: {
        '^/': '/api/',
      },
      on: {
        proxyReq: (proxyReq: any, req: any) => {
          if (process.env.NODE_ENV === 'development') {
            logger.debug(`[Admin Proxy] Forwarding ${req.method} ${req.url} -> ${proxyReq.path}`);
          }

          const cmsApiKey = process.env.CMS_API_KEY;
          if (cmsApiKey) {
            proxyReq.setHeader('Authorization', `users API-Key ${cmsApiKey}`);
          }

          proxyReq.removeHeader('cookie');
        },
      },
    })
  );
}

export function registerStaticAndFallback(app: Application) {
  const uploadsDir = path.resolve(projectRoot, 'uploads');
  app.use('/uploads', express.static(uploadsDir, {
    dotfiles: 'deny',
    fallthrough: false,
    index: false,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      if (!INLINE_UPLOAD_EXTENSIONS.has(ext)) {
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      }
      if (!INLINE_UPLOAD_EXTENSIONS.has(ext)) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath).replace(/"/g, '')}"`);
      }
    },
  }));

  const tinyDir = path.resolve(projectRoot, 'node_modules/tinymce');
  app.use(
    '/tinymce',
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(tinyDir)
  );

  const isProd = process.env.NODE_ENV === 'production';
  const publicDir = isProd ? path.resolve(projectRoot, 'dist') : path.resolve(projectRoot, 'public');

  app.use('/', express.static(publicDir));

  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();

    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      logger.debug(`[FallbackMiddleware] API/auth request detected, skipping fallback: ${req.path}`);
      return next();
    }

    if (!isProd && process.env.FRONTEND_URL) {
      const hasExtension = path.extname(req.path) !== '';
      if (!hasExtension) {
        const frontendOrigin = resolveFrontendOrigin();
        if (!frontendOrigin) {
          return next();
        }
        const target = `${frontendOrigin}${req.url}`;
        return res.redirect(target);
      }
    }

    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    return next();
  });
}

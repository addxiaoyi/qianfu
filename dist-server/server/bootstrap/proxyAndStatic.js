import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticate, hasPermission } from '../middleware/auth';
import { logger } from '../utils/logger';
const __filenameResolved = typeof import.meta.url !== 'undefined'
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
export function registerProxyRoutes(app) {
    app.use('/api/public/cms', createProxyMiddleware({
        target: 'http://localhost:3030',
        changeOrigin: true,
        pathRewrite: {
            '^/': '/api/',
        },
        on: {
            proxyReq: (proxyReq, req, res) => {
                if (req.method !== 'GET') {
                    return res.status(403).json({ error: 'Method not allowed on public proxy' });
                }
                logger.info(`[Public Proxy] Forwarding ${req.method} ${req.url} -> ${proxyReq.path}`);
            },
        },
    }));
    app.use('/cms-api', authenticate, hasPermission(['manage_content']), createProxyMiddleware({
        target: 'http://localhost:3030',
        changeOrigin: true,
        pathRewrite: {
            '^/': '/api/',
        },
        on: {
            proxyReq: (proxyReq, req) => {
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
    }));
}
export function registerStaticAndFallback(app) {
    const uploadsDir = path.resolve(projectRoot, 'uploads');
    app.use('/uploads', express.static(uploadsDir));
    const tinyDir = path.resolve(projectRoot, 'node_modules/tinymce');
    app.use('/tinymce', (_req, res, next) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        next();
    }, express.static(tinyDir));
    const isProd = process.env.NODE_ENV === 'production';
    const publicDir = isProd ? path.resolve(projectRoot, 'dist') : path.resolve(projectRoot, 'public');
    app.use('/', express.static(publicDir));
    app.use((req, res, next) => {
        if (req.method !== 'GET')
            return next();
        if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
            logger.debug(`[FallbackMiddleware] API/auth request detected, skipping fallback: ${req.path}`);
            return next();
        }
        if (!isProd && process.env.FRONTEND_URL) {
            const hasExtension = path.extname(req.path) !== '';
            if (!hasExtension) {
                return res.redirect(process.env.FRONTEND_URL + req.url);
            }
        }
        const indexPath = path.join(publicDir, 'index.html');
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
        return next();
    });
}
//# sourceMappingURL=proxyAndStatic.js.map
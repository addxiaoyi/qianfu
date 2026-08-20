import express, { Router } from 'express';
import path from 'node:path';
import { UPLOADS_DIR } from '../config/uploadStorage';

const INLINE_UPLOAD_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const router = Router();

router.use(express.static(UPLOADS_DIR, {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (!INLINE_UPLOAD_EXTENSIONS.has(ext)) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath).replace(/"/g, '')}"`);
    }
  },
}));

export default router;

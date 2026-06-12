import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import QRCode from 'qrcode';
import { staticDataLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { getLlmsTxt, getRobotsTxt, getSitemapXml } from '../controllers/seoController';

const router = Router();
const MAX_QR_DATA_LENGTH = 2048;

async function fetchTinyMCE(): Promise<string> {
  const tinymcePath = path.resolve(process.cwd(), 'node_modules/tinymce/tinymce.min.js');
  const txt = await fs.readFile(tinymcePath, 'utf8');
  if (txt && txt.includes('tinymce')) {
    return txt;
  }
  throw new Error('Local TinyMCE bundle unavailable');
}

router.get('/tinymce', staticDataLimiter, async (req, res) => {
  try {
    const js = await fetchTinyMCE();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(200).send(js);
  } catch (err) {
    logger.error('[Assets] Failed to fetch TinyMCE:', err);
    res.status(502).send('// tinymce unavailable');
  }
});

router.get('/qr', staticDataLimiter, async (req, res) => {
  const data = typeof req.query.data === 'string' ? req.query.data.trim() : '';
  if (!data || data.length > MAX_QR_DATA_LENGTH) {
    return res.status(400).json({ success: false, error: 'QR data is required and must be <= 2048 characters' });
  }

  const sizeRaw = typeof req.query.size === 'string' ? Number(req.query.size) : 220;
  const width = Number.isFinite(sizeRaw) ? Math.min(360, Math.max(120, Math.floor(sizeRaw))) : 220;

  try {
    const png = await QRCode.toBuffer(data, {
      type: 'png',
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    return res.status(200).send(png);
  } catch (err) {
    logger.error('[Assets] Failed to generate QR:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate QR' });
  }
});

router.get('/robots.txt', staticDataLimiter, getRobotsTxt);
router.get('/llms.txt', staticDataLimiter, getLlmsTxt);
router.get('/sitemap.xml', staticDataLimiter, getSitemapXml);

export default router;

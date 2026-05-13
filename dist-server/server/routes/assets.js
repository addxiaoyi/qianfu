import { Router } from 'express';
import { staticDataLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
const router = Router();
async function fetchTinyMCE() {
    const urls = [
        'https://cdn.jsdelivr.net/npm/tinymce@6.9.2/tinymce.min.js',
        'https://unpkg.com/tinymce@6.9.2/tinymce.min.js',
    ];
    for (const url of urls) {
        try {
            const r = await fetch(url);
            if (r.ok) {
                const txt = await r.text();
                if (txt && txt.includes('tinymce'))
                    return txt;
            }
        }
        catch { }
    }
    throw new Error('Upstream unavailable');
}
router.get('/tinymce', staticDataLimiter, async (req, res) => {
    try {
        const js = await fetchTinyMCE();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.status(200).send(js);
    }
    catch (err) {
        logger.error('[Assets] Failed to fetch TinyMCE:', err);
        res.status(502).send('// tinymce unavailable');
    }
});
export default router;
//# sourceMappingURL=assets.js.map
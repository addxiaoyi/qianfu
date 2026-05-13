import { Router } from 'express';
import { metricsService } from '../services/metricsService';
import { authenticate, hasPermission } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimiter';
const router = Router();
router.get('/metrics-stream', adminLimiter, authenticate, hasPermission(['system_config']), (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const send = () => {
        const now = Date.now();
        const summary = metricsService.summary(metricsService['data'] || []);
        const payload = { time: now, status: 'ok', summary };
        res.write(`data:${JSON.stringify(payload)}\n\n`);
    };
    send();
    const timer = setInterval(send, 5000);
    req.on('close', () => {
        clearInterval(timer);
    });
});
export default router;
//# sourceMappingURL=events.js.map
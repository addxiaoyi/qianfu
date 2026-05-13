import { Router } from 'express';
import { metricsService } from '../services/metricsService';
import { metricsQuerySchema } from '../utils/validation';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimiter';
const router = Router();
router.get('/metrics', adminLimiter, authenticate, (req, res) => {
    // If authenticated and has system_config permission or is admin, show full metrics
    if (req.user) {
        const userPermissions = req.user.permissions ? JSON.parse(req.user.permissions) : [];
        if (req.isAdmin || userPermissions.includes('system_config')) {
            const validation = metricsQuerySchema.safeParse(req.query);
            if (!validation.success) {
                return res.status(400).json({ error: 'Invalid query parameters', details: validation.error.format() });
            }
            const result = metricsService.query(validation.data);
            return sendSuccess(res, result);
        }
    }
    // If authenticated but no permission, or if we want to allow public summary for logged in users:
    // For "Forced Authentication", we ensure they are logged in (done by middleware).
    // We can still return public summary for non-admin users if desired, 
    // OR we can restrict this endpoint entirely to admins.
    // Given the previous code allowed public summary, we'll allow it for authenticated users.
    const result = metricsService.getPublicSummary();
    return sendSuccess(res, result);
});
router.get('/prometheus', async (req, res) => {
    try {
        const metrics = await metricsService.getPrometheusMetrics();
        res.set('Content-Type', metricsService.getRegistryContentType());
        res.end(metrics);
    }
    catch (err) {
        res.status(500).end(err);
    }
});
export default router;
//# sourceMappingURL=metrics.js.map
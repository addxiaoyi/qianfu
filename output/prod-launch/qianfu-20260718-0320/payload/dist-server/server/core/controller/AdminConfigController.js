import { Router } from 'express';
import { z } from 'zod';
import { qianfuConfig } from '../utils/SignatureUtil.js';
import { adminOnly, authenticate } from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';
const router = Router();
const adminConfig = {
    qianfu: {
        enabled: qianfuConfig.enabled,
        appId: qianfuConfig.appId,
        secretKey: qianfuConfig.secretKey,
        apiUrl: qianfuConfig.apiUrl,
        callbackUrl: qianfuConfig.callbackUrl,
        whitelist: qianfuConfig.whitelist || [],
    },
};
const qianfuConfigUpdateSchema = z.object({
    enabled: z.boolean().optional(),
    appId: z.string().trim().min(1).max(256).optional(),
    secretKey: z.string().trim().min(1).max(1_024).optional(),
    apiUrl: z.string().trim().url().max(2_048).optional(),
    callbackUrl: z.string().trim().url().max(2_048).optional(),
    whitelist: z.array(z.string().trim().min(1).max(256)).max(100).optional(),
}).strict();
function presentQianFuConfig() {
    const { secretKey: _secretKey, ...config } = adminConfig.qianfu;
    return {
        ...config,
        secretKeyConfigured: Boolean(adminConfig.qianfu.secretKey),
    };
}
router.use(authenticate, adminOnly);
router.get('/config/qianfu', (_req, res) => {
    res.json({
        success: true,
        data: presentQianFuConfig(),
    });
});
router.post('/config/qianfu', csrfProtection, (req, res) => {
    const validation = qianfuConfigUpdateSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: 'Invalid QianFu configuration',
            details: validation.error.issues,
        });
    }
    const { enabled, appId, secretKey, apiUrl, callbackUrl, whitelist } = validation.data;
    if (enabled !== undefined) {
        adminConfig.qianfu.enabled = enabled;
        process.env.QIANFU_ENABLED = enabled ? 'true' : 'false';
    }
    if (appId !== undefined) {
        adminConfig.qianfu.appId = appId;
        process.env.QIANFU_APP_ID = appId;
    }
    if (secretKey !== undefined) {
        adminConfig.qianfu.secretKey = secretKey;
        process.env.QIANFU_SECRET_KEY = secretKey;
    }
    if (apiUrl !== undefined) {
        adminConfig.qianfu.apiUrl = apiUrl;
        process.env.QIANFU_API_URL = apiUrl;
    }
    if (callbackUrl !== undefined) {
        adminConfig.qianfu.callbackUrl = callbackUrl;
        process.env.QIANFU_CALLBACK_URL = callbackUrl;
    }
    if (whitelist !== undefined) {
        adminConfig.qianfu.whitelist = whitelist;
        process.env.QIANFU_WHITELIST = whitelist.join(',');
    }
    res.json({
        success: true,
        data: presentQianFuConfig(),
        message: 'Configuration updated successfully',
    });
});
export default router;
//# sourceMappingURL=AdminConfigController.js.map
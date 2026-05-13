import { Router } from 'express';
import { qianfuConfig } from '../utils/SignatureUtil';
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
router.get('/config/qianfu', (req, res) => {
    res.json({
        success: true,
        data: adminConfig.qianfu,
    });
});
router.post('/config/qianfu', (req, res) => {
    const { enabled, appId, secretKey, apiUrl, callbackUrl, whitelist } = req.body;
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
        data: adminConfig.qianfu,
        message: 'Configuration updated successfully',
    });
});
export default router;
//# sourceMappingURL=AdminConfigController.js.map
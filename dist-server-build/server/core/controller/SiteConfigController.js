import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, hasPermission } from '../../middleware/auth';
import { csrfProtection } from '../../middleware/csrf';
import { adminLimiter } from '../../middleware/rateLimiter';
import { createDuplicateRequestGuard } from '../../middleware/idempotency';
import { logger } from '../../utils/logger';
const router = Router();
const SITE_CONFIG_KEY = 'SITE_CONFIG';
// Get site config
router.get('/site-config', adminLimiter, authenticate, hasPermission(['admin']), async (req, res) => {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key: SITE_CONFIG_KEY }
        });
        if (!config) {
            return res.json({
                success: true,
                data: getDefaultSiteConfig()
            });
        }
        const siteConfig = JSON.parse(config.value);
        res.json({
            success: true,
            data: siteConfig
        });
    }
    catch (error) {
        logger.error('[SiteConfigController] Failed to get site config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get site config'
        });
    }
});
// Save site config
router.post('/site-config', adminLimiter, authenticate, hasPermission(['admin']), csrfProtection, createDuplicateRequestGuard({ ttlSeconds: 30 }), async (req, res) => {
    try {
        const siteConfig = req.body;
        await prisma.systemConfig.upsert({
            where: { key: SITE_CONFIG_KEY },
            update: {
                value: JSON.stringify(siteConfig),
                description: 'Site configuration for homepage, banners, features, etc.'
            },
            create: {
                key: SITE_CONFIG_KEY,
                value: JSON.stringify(siteConfig),
                is_secret: false,
                description: 'Site configuration for homepage, banners, features, etc.'
            }
        });
        logger.info('[SiteConfigController] Site config updated successfully');
        res.json({
            success: true,
            message: 'Site config saved successfully'
        });
    }
    catch (error) {
        logger.error('[SiteConfigController] Failed to save site config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save site config'
        });
    }
});
function getDefaultSiteConfig() {
    return {
        siteName: '千服',
        siteTitle: '',
        siteDescription: '',
        serverIP: '',
        serverVersion: '',
        announcement: '',
        contactEmail: '',
        discordLink: '',
        qqGroup: '',
        banners: [],
        launcherLinks: [],
        hero: {
            badge: '',
            titleLine1: '',
            titleHighlight: '',
            subtitle: '',
            features: [],
            bgImage: ''
        },
        specs: {
            title: '',
            items: []
        },
        helpSteps: {
            title: '',
            items: []
        },
        features: {
            title: '',
            items: []
        },
        gallery: {
            title: '',
            items: []
        },
        friendLinks: {
            title: '',
            items: []
        },
        teamMembers: []
    };
}
export default router;
//# sourceMappingURL=SiteConfigController.js.map
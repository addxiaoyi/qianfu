import authRoutes from './auth.js';
import eventsRoutes from './events.js';
import serversRoutes from './servers.js';
import metricsRoutes from './metrics.js';
import statsRoutes from './stats.js';
import visitRoutes from './visit.js';
import uploadRoutes from './upload.js';
import assetsRoutes from './assets.js';
import cmsRoutes from './cms.js';
import userRoutes from './user.js';
import userManagementRoutes from './userManagement.js';
import port5555Routes from './port5555.js';
import reviewRoutes from './review.js';
import permissionGroupRoutes from './permissionGroups.js';
import auditRoutes from './audit.js';
import aiRoutes from './ai.js';
import ticketRoutes from './tickets.js';
import reportRoutes from './reports.js';
import paymentRoutes from './payment.js';
import walletRoutes from './wallet.js';
import notificationRoutes from './notification.js';
import preferencesRoutes from './preferences.js';
import moderationAdminRoutes from './moderationAdmin.js';
import qianfuRoutes from '../core/controller/QianFuController.js';
import promoRoutes from './promo.js';
import adminConfigRoutes from '../core/controller/AdminConfigController.js';
import { backwardCompatRedirect } from '../middleware/apiVersioning.js';
import { API_PREFIX, API_VERSION_PREFIX } from '../constants/api.js';
/** 当前 API 版本前缀 */
const V1 = API_VERSION_PREFIX;
/**
 * 注册 API 路由
 *
 * 所有路由挂载在 /api/v1 下，实现 URL 版本化。
 * backwardCompatRedirect 中间件确保 /api/* 旧请求仍能正常访问。
 */
export function registerApiRoutes(app) {
    // 向后兼容：将 /api/* 旧路径 rewrite 到 /api/v1/*
    app.use(API_PREFIX, backwardCompatRedirect);
    // ---- v1 路由 ----
    app.use(`${V1}`, authRoutes);
    app.use(`${V1}`, serversRoutes);
    app.use(`${V1}`, metricsRoutes);
    app.use(`${V1}`, statsRoutes);
    app.use(`${V1}`, visitRoutes);
    app.use(`${V1}`, uploadRoutes);
    app.use(`${V1}`, assetsRoutes);
    app.use(`${V1}`, cmsRoutes);
    app.use(`${V1}`, userRoutes);
    app.use(`${V1}`, eventsRoutes);
    app.use(`${V1}/admin`, userManagementRoutes);
    app.use(`${V1}/admin`, adminConfigRoutes);
    app.use(`${V1}/promo`, promoRoutes);
    app.use(`${V1}/port5555`, port5555Routes);
    app.use(`${V1}/review`, reviewRoutes);
    app.use(`${V1}/permission-groups`, permissionGroupRoutes);
    app.use(`${V1}/audit`, auditRoutes);
    app.use(`${V1}/ai`, aiRoutes);
    app.use(`${V1}/tickets`, ticketRoutes);
    app.use(`${V1}/reports`, reportRoutes);
    app.use(`${V1}/payment`, paymentRoutes);
    app.use(`${V1}/qianfu`, qianfuRoutes);
    app.use(`${V1}/wallet`, walletRoutes);
    app.use(`${V1}/notifications`, notificationRoutes);
    app.use(`${V1}/preferences`, preferencesRoutes);
    app.use(`${V1}/admin/moderation`, moderationAdminRoutes);
    // ---- 未来版本路由在此添加 ----
    // app.use('/api/v2', v2Routes);
}
//# sourceMappingURL=index.js.map
import authRoutes from './auth';
import eventsRoutes from './events';
import serversRoutes from './servers';
import metricsRoutes from './metrics';
import statsRoutes from './stats';
import visitRoutes from './visit';
import uploadRoutes from './upload';
import assetsRoutes from './assets';
import cmsRoutes from './cms';
import userRoutes from './user';
import userManagementRoutes from './userManagement';
import port5555Routes from './port5555';
import reviewRoutes from './review';
import permissionGroupRoutes from './permissionGroups';
import auditRoutes from './audit';
import aiRoutes from './ai';
import ticketRoutes from './tickets';
import reportRoutes from './reports';
import paymentRoutes from './payment';
import walletRoutes from './wallet';
import notificationRoutes from './notification';
import preferencesRoutes from './preferences';
import moderationAdminRoutes from './moderationAdmin';
import qianfuRoutes from '../core/controller/QianFuController';
import promoRoutes from './promo';
import adminConfigRoutes from '../core/controller/AdminConfigController';
import { backwardCompatRedirect } from '../middleware/apiVersioning';
import { API_PREFIX, API_VERSION_PREFIX } from '../constants/api';
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
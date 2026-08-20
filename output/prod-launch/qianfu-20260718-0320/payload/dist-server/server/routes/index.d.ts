import type { Application } from 'express';
/**
 * 注册 API 路由
 *
 * 所有路由挂载在 /api/v1 下，实现 URL 版本化。
 * backwardCompatRedirect 中间件确保 /api/* 旧请求仍能正常访问。
 */
export declare function registerApiRoutes(app: Application): void;
//# sourceMappingURL=index.d.ts.map
/**
 * 中间件分层架构
 *
 * 将 Express 中间件按职责分层，提高可维护性和扩展性
 *
 * Layer 0: 基础设施层 (Foundation)
 * Layer 1: 安全层 (Security)
 * Layer 2: 业务前准备 (Business Prep)
 * Layer 3: 业务路由 (Business Routes)
 * Layer 4: 错误处理 (Error Handling)
 */
import { Application } from 'express';
/**
 * 初始化 Layer 0: 基础设施层
 */
export declare function registerFoundationLayer(app: Application): void;
/**
 * 初始化 Layer 1: 安全层
 */
export declare function registerSecurityLayer(app: Application): void;
/**
 * 初始化 Layer 2: 业务准备层
 */
export declare function registerBusinessPrepLayer(app: Application): void;
/**
 * 初始化 Layer 3: 业务路由
 */
export declare function registerBusinessRouteLayer(app: Application): void;
/**
 * 初始化 Layer 4: 错误处理层
 */
export declare function registerErrorHandlerLayer(app: Application): void;
/**
 * 一次性初始化所有层级（推荐用于新项目）
 */
export declare function initializeMiddlewareLayers(app: Application): void;
/**
 * 获取中间件层级信息
 */
export declare function getMiddlewareLayersInfo(): Array<{
    layer: number;
    name: string;
    description: string;
}>;
declare const _default: {
    initializeMiddlewareLayers: typeof initializeMiddlewareLayers;
    registerFoundationLayer: typeof registerFoundationLayer;
    registerSecurityLayer: typeof registerSecurityLayer;
    registerBusinessPrepLayer: typeof registerBusinessPrepLayer;
    registerBusinessRouteLayer: typeof registerBusinessRouteLayer;
    registerErrorHandlerLayer: typeof registerErrorHandlerLayer;
    getMiddlewareLayersInfo: typeof getMiddlewareLayersInfo;
};
export default _default;
//# sourceMappingURL=middlewareLayers.d.ts.map
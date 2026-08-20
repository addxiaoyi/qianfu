/**
 * 本地服务发现 - 无容器版本
 * 使用环境变量配置服务地址，支持后续扩展为 Consul/Zookeeper
 */
interface ServiceConfig {
    host: string;
    port: number;
    url: string;
}
interface ServiceRegistry {
    [key: string]: ServiceConfig;
}
/**
 * 初始化本地服务发现
 * 在应用启动时调用，加载所有已知服务
 */
export declare function initServiceDiscovery(): void;
/**
 * 获取服务地址
 */
export declare function getServiceUrl(serviceName: string): string | null;
/**
 * 获取服务列表
 */
export declare function getServices(): ServiceRegistry;
/**
 * 注册服务（供服务启动时调用）
 */
export declare function registerService(serviceName: string, config?: Partial<ServiceConfig>): void;
/**
 * 检查服务健康状态
 */
export declare function checkServiceHealth(serviceName: string): Promise<boolean>;
/**
 * 健康检查路由（供 Express 使用）
 */
export declare function createHealthCheckRouter(): import("express-serve-static-core").Router;
declare const _default: {
    initServiceDiscovery: typeof initServiceDiscovery;
    getServiceUrl: typeof getServiceUrl;
    getServices: typeof getServices;
    registerService: typeof registerService;
    checkServiceHealth: typeof checkServiceHealth;
    createHealthCheckRouter: typeof createHealthCheckRouter;
};
export default _default;
//# sourceMappingURL=service-discovery.d.ts.map
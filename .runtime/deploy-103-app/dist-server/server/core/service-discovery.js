/**
 * 本地服务发现 - 无容器版本
 * 使用环境变量配置服务地址，支持后续扩展为 Consul/Zookeeper
 */
import express from 'express';
import { logger } from '../utils/logger.js';
// 默认端口配置
const DEFAULT_PORTS = {
    monolith: 3050,
    'event-bus': 3060,
    'user-service': 3070,
    'server-service': 3071,
    'payment-service': 3072,
    'ai-service': 3073,
};
// 从环境变量加载服务配置
function loadServiceConfig(serviceName) {
    const port = parseInt(process.env[`${serviceName.toUpperCase()}_PORT`] || '') ||
        DEFAULT_PORTS[serviceName] ||
        3000;
    const host = process.env[`${serviceName.toUpperCase()}_HOST`] || 'localhost';
    const protocol = process.env[`${serviceName.toUpperCase()}_PROTOCOL`] || 'http';
    return {
        host,
        port,
        url: `${protocol}://${host}:${port}`,
    };
}
// 内存中的服务注册表
const registry = {};
/**
 * 初始化本地服务发现
 * 在应用启动时调用，加载所有已知服务
 */
export function initServiceDiscovery() {
    const services = Object.keys(DEFAULT_PORTS);
    for (const service of services) {
        const config = loadServiceConfig(service);
        // 只注册明确配置过的服务
        if (process.env[`${service.toUpperCase()}_HOST`]) {
            registry[service] = config;
            logger.info(`Service discovered: ${service} -> ${config.url}`);
        }
    }
    // 注册自身
    const selfConfig = loadServiceConfig('self');
    registry['self'] = {
        host: process.env['HOST'] || 'localhost',
        port: parseInt(process.env['PORT'] || '3050'),
        url: `${process.env['PROTOCOL'] || 'http'}://${selfConfig.host}:${selfConfig.port}`,
    };
}
/**
 * 获取服务地址
 */
export function getServiceUrl(serviceName) {
    if (registry[serviceName]) {
        return registry[serviceName].url;
    }
    // 尝试从环境变量加载
    const config = loadServiceConfig(serviceName);
    if (process.env[`${serviceName.toUpperCase()}_HOST`]) {
        registry[serviceName] = config;
        return config.url;
    }
    return null;
}
/**
 * 获取服务列表
 */
export function getServices() {
    return { ...registry };
}
/**
 * 注册服务（供服务启动时调用）
 */
export function registerService(serviceName, config) {
    const fullConfig = {
        host: config?.host || 'localhost',
        port: config?.port || DEFAULT_PORTS[serviceName] || 3000,
        url: config?.url || `http://localhost:${DEFAULT_PORTS[serviceName] || 3000}`,
    };
    registry[serviceName] = fullConfig;
    logger.info(`Service registered: ${serviceName} -> ${fullConfig.url}`);
}
/**
 * 检查服务健康状态
 */
export async function checkServiceHealth(serviceName) {
    const url = getServiceUrl(serviceName);
    if (!url)
        return false;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`${url}/health`, {
            signal: controller.signal,
            method: 'GET',
        });
        clearTimeout(timeout);
        return response.ok;
    }
    catch {
        return false;
    }
}
/**
 * 健康检查路由（供 Express 使用）
 */
export function createHealthCheckRouter() {
    const router = express.Router();
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            service: process.env['SERVICE_NAME'] || 'unknown',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: Object.keys(registry).map((name) => ({
                name,
                url: registry[name].url,
            })),
        });
    });
    router.get('/health/ready', async (req, res) => {
        // 检查所有依赖服务
        const checks = await Promise.all(Object.keys(registry).map(async (name) => ({
            name,
            healthy: await checkServiceHealth(name),
        })));
        const allHealthy = checks.every((c) => c.healthy);
        res.status(allHealthy ? 200 : 503).json({
            status: allHealthy ? 'ready' : 'not_ready',
            checks,
        });
    });
    return router;
}
export default {
    initServiceDiscovery,
    getServiceUrl,
    getServices,
    registerService,
    checkServiceHealth,
    createHealthCheckRouter,
};
//# sourceMappingURL=service-discovery.js.map
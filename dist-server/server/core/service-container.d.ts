/**
 * Service Registry
 * Central service registration and dependency injection
 */
import { EventEmitter } from 'events';
export interface ServiceInfo {
    name: string;
    host: string;
    port: number;
    healthCheck: string;
    status: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
    lastHealthCheck?: Date;
    version?: string;
    metadata?: Record<string, unknown>;
}
export interface Service extends EventEmitter {
    boot?(): Promise<void>;
    shutdown?(): Promise<void>;
    healthCheck?(): Promise<boolean>;
    name: string;
}
declare class ServiceRegistryClass {
    private services;
    private serviceInfo;
    private healthCheckInterval;
    private isShuttingDown;
    /**
     * Register a service
     */
    register(name: string, service: Service): void;
    /**
     * Get a service by name
     */
    get<T extends Service = Service>(name: string): T | undefined;
    /**
     * Get all registered service names
     */
    getServiceNames(): string[];
    /**
     * Register service info for discovery
     */
    registerInfo(info: ServiceInfo): void;
    /**
     * Get service info
     */
    getInfo(name: string): ServiceInfo | undefined;
    /**
     * Get all service infos
     */
    getAllInfos(): ServiceInfo[];
    /**
     * Update service status
     */
    updateStatus(name: string, status: ServiceInfo['status']): void;
    /**
     * Boot all services in dependency order
     */
    boot(): Promise<void>;
    /**
     * Shutdown all services in reverse dependency order
     */
    shutdown(): Promise<void>;
    /**
     * Topological sort based on service dependencies
     * Services with no dependencies boot first
     */
    private topologicalSort;
    /**
     * Start periodic health checks
     */
    private startHealthChecks;
    /**
     * Stop health checks
     */
    private stopHealthChecks;
    /**
     * Get system health status
     */
    getHealthStatus(): {
        overall: 'healthy' | 'degraded' | 'unhealthy';
        services: ServiceInfo[];
        uptime: number;
    };
}
export declare const ServiceRegistry: ServiceRegistryClass;
export default ServiceRegistry;
//# sourceMappingURL=service-container.d.ts.map
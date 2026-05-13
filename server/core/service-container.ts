/**
 * Service Registry
 * Central service registration and dependency injection
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

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

class ServiceRegistryClass {
  private services = new Map<string, Service>();
  private serviceInfo = new Map<string, ServiceInfo>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  /**
   * Register a service
   */
  register(name: string, service: Service): void {
    if (this.services.has(name)) {
      logger.warn(`[ServiceRegistry] Service ${name} already registered, replacing`);
    }

    this.services.set(name, service);
    logger.info(`[ServiceRegistry] Registered service: ${name}`);

    // Listen for service events
    service.on('error', (error) => {
      logger.error(`[ServiceRegistry] Service ${name} error:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Get a service by name
   */
  get<T extends Service = Service>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Register service info for discovery
   */
  registerInfo(info: ServiceInfo): void {
    this.serviceInfo.set(info.name, {
      ...info,
      status: 'starting',
    });
    logger.info(`[ServiceRegistry] Registered service info: ${info.name} at ${info.host}:${info.port}`);
  }

  /**
   * Get service info
   */
  getInfo(name: string): ServiceInfo | undefined {
    return this.serviceInfo.get(name);
  }

  /**
   * Get all service infos
   */
  getAllInfos(): ServiceInfo[] {
    return Array.from(this.serviceInfo.values());
  }

  /**
   * Update service status
   */
  updateStatus(name: string, status: ServiceInfo['status']): void {
    const info = this.serviceInfo.get(name);
    if (info) {
      info.status = status;
      info.lastHealthCheck = new Date();
      this.serviceInfo.set(name, info);
    }
  }

  /**
   * Boot all services in dependency order
   */
  async boot(): Promise<void> {
    logger.info('[ServiceRegistry] Booting all services...');

    const sortedServices = this.topologicalSort();

    for (const name of sortedServices) {
      const service = this.services.get(name);
      if (!service) continue;

      try {
        this.updateStatus(name, 'starting');
        
        if (service.boot) {
          logger.info(`[ServiceRegistry] Booting ${name}...`);
          await service.boot();
        }

        this.updateStatus(name, 'healthy');
        logger.info(`[ServiceRegistry] ✓ ${name} booted successfully`);
      } catch (error) {
        this.updateStatus(name, 'unhealthy');
        logger.error(`[ServiceRegistry] ✗ ${name} failed to boot:`, error);
        throw error;
      }
    }

    logger.info('[ServiceRegistry] All services booted successfully');
    this.startHealthChecks();
  }

  /**
   * Shutdown all services in reverse dependency order
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('[ServiceRegistry] Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('[ServiceRegistry] Shutting down all services...');

    this.stopHealthChecks();

    const sortedServices = this.topologicalSort().reverse();

    for (const name of sortedServices) {
      const service = this.services.get(name);
      if (!service) continue;

      try {
        this.updateStatus(name, 'stopping');

        if (service.shutdown) {
          logger.info(`[ServiceRegistry] Shutting down ${name}...`);
          await service.shutdown();
        }

        logger.info(`[ServiceRegistry] ✓ ${name} shutdown complete`);
      } catch (error) {
        logger.error(`[ServiceRegistry] ✗ ${name} shutdown error:`, error);
      }
    }

    this.services.clear();
    this.serviceInfo.clear();
    logger.info('[ServiceRegistry] All services shut down');
  }

  /**
   * Topological sort based on service dependencies
   * Services with no dependencies boot first
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      result.push(name);
    };

    for (const name of this.services.keys()) {
      visit(name);
    }

    return result;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      for (const [name, service] of this.services) {
        try {
          if (service.healthCheck) {
            const healthy = await service.healthCheck();
            this.updateStatus(name, healthy ? 'healthy' : 'unhealthy');
          }
        } catch {
          this.updateStatus(name, 'unhealthy');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceInfo[];
    uptime: number;
  } {
    const services = this.getAllInfos();
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      overall = unhealthyCount === services.length ? 'unhealthy' : 'degraded';
    }

    return {
      overall,
      services,
      uptime: process.uptime(),
    };
  }
}

// Singleton instance
export const ServiceRegistry = new ServiceRegistryClass();

// Export for convenience
export default ServiceRegistry;

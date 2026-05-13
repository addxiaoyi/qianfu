/**
 * Service Registry - Simplified version for standalone service
 */

import { logger } from './logger.js';

export interface ServiceInfo {
  name: string;
  host: string;
  port: number;
  healthCheck: string;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
}

class ServiceRegistryClass {
  private services = new Map<string, ServiceInfo>();

  registerInfo(info: ServiceInfo): void {
    this.services.set(info.name, { ...info, status: 'starting' });
    logger.info(`[ServiceRegistry] Registered: ${info.name} at ${info.host}:${info.port}`);
  }

  updateStatus(name: string, status: ServiceInfo['status']): void {
    const info = this.services.get(name);
    if (info) {
      info.status = status;
    }
  }

  getInfo(name: string): ServiceInfo | undefined {
    return this.services.get(name);
  }

  async shutdown(): Promise<void> {
    logger.info('[ServiceRegistry] Shutting down...');
    this.services.clear();
  }
}

export const ServiceRegistry = new ServiceRegistryClass();
export default ServiceRegistry;

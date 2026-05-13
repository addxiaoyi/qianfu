/**
 * Service-to-Service Communication Middleware
 * 
 * Provides tracing, retries, circuit breaker, and metrics for inter-service calls.
 */

import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService';
import { logger } from '../utils/logger';

export interface ServiceClientOptions {
  serviceName: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers: Map<string, CircuitBreakerState> = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

export function getCircuitBreakerState(service: string): CircuitBreakerState {
  if (!circuitBreakers.has(service)) {
    circuitBreakers.set(service, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    });
  }
  return circuitBreakers.get(service)!;
}

export function recordCircuitBreakerState(service: string) {
  const cb = getCircuitBreakerState(service);
  metricsService.setCircuitBreakerState(service, cb.state);
}

export async function callService<T>(
  caller: string,
  target: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const startTime = Date.now();
  const { timeout = 5000, ...fetchOptions } = options;
  
  const cb = getCircuitBreakerState(target);
  
  // Check circuit breaker
  if (cb.state === 'open') {
    if (Date.now() - cb.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      cb.state = 'half-open';
      recordCircuitBreakerState(target);
    } else {
      throw new Error(`Circuit breaker open for service: ${target}`);
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await (async () => {
      try {
        return await fetch(target, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Caller': caller,
            'X-Request-Id': crypto.randomUUID(),
            ...fetchOptions.headers,
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    const duration = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      throw new Error(`Service call failed: ${response.status}`);
    }

    // Success - reset circuit breaker
    if (cb.state === 'half-open') {
      cb.state = 'closed';
      cb.failures = 0;
    }
    
    recordCircuitBreakerState(target);
    metricsService.recordServiceCall(caller, target, fetchOptions.method || 'GET', 'success', duration);

    return response.json();
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    cb.failures++;
    cb.lastFailure = Date.now();
    
    if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      cb.state = 'open';
      logger.warn(`Circuit breaker opened for service: ${target}`);
    }
    
    recordCircuitBreakerState(target);
    metricsService.recordServiceCall(caller, target, fetchOptions.method || 'GET', 'error', duration);
    
    throw error;
  }
}

// Service registry for dynamic service discovery
interface ServiceEndpoint {
  url: string;
  healthCheck?: string;
  lastHealthCheck?: number;
  isHealthy?: boolean;
}

const serviceRegistry: Map<string, ServiceEndpoint> = new Map();

export function registerService(name: string, url: string, healthCheck?: string) {
  serviceRegistry.set(name, { url, healthCheck });
  logger.info(`Service registered: ${name} -> ${url}`);
}

export function getServiceUrl(name: string): string | undefined {
  return serviceRegistry.get(name)?.url;
}

export async function getHealthyServiceUrl(name: string): Promise<string | undefined> {
  const service = serviceRegistry.get(name);
  if (!service) return undefined;
  
  // Check health if stale (older than 30 seconds)
  if (!service.lastHealthCheck || Date.now() - service.lastHealthCheck > 30000) {
    if (service.healthCheck) {
      try {
        const response = await fetch(service.healthCheck, { signal: AbortSignal.timeout(2000) });
        service.isHealthy = response.ok;
        service.lastHealthCheck = Date.now();
      } catch {
        service.isHealthy = false;
      }
    }
  }
  
  return service.isHealthy !== false ? service.url : undefined;
}

// Middleware to track outgoing service calls
export function createServiceCallMiddleware(callerName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Add caller header to outgoing requests
    res.locals.serviceCaller = callerName;
    next();
  };
}

// Metrics update for database connections
export function updateDbPoolMetrics(idle: number, active: number, total: number) {
  metricsService.setDbPoolSize('idle', idle);
  metricsService.setDbPoolSize('active', active);
  metricsService.setDbPoolSize('total', total);
}

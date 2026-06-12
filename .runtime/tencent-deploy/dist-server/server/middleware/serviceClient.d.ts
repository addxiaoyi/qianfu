/**
 * Service-to-Service Communication Middleware
 *
 * Provides tracing, retries, circuit breaker, and metrics for inter-service calls.
 */
import { Request, Response, NextFunction } from 'express';
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
export declare function getCircuitBreakerState(service: string): CircuitBreakerState;
export declare function recordCircuitBreakerState(service: string): void;
export declare function callService<T>(caller: string, target: string, options?: RequestInit & {
    timeout?: number;
}): Promise<T>;
export declare function registerService(name: string, url: string, healthCheck?: string): void;
export declare function getServiceUrl(name: string): string | undefined;
export declare function getHealthyServiceUrl(name: string): Promise<string | undefined>;
export declare function createServiceCallMiddleware(callerName: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function updateDbPoolMetrics(idle: number, active: number, total: number): void;
//# sourceMappingURL=serviceClient.d.ts.map
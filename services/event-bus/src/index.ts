/**
 * Event Bus Service - RabbitMQ Central Hub
 * Routes events between microservices with Express API
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { logger } from './utils/logger.js';
import { ConnectionManager, ConnectionState } from './connection.js';
import { SubscriptionManager } from './subscriptions.js';
import { createHealthRoutes } from './routes/health.js';
import { createApiRoutes } from './routes/api.js';

// ============================================
// Configuration
// ============================================

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://qianfu:password@localhost:5672';
const API_PORT = parseInt(process.env.API_PORT || '3001', 10);
const API_HOST = process.env.API_HOST || '0.0.0.0';

// ============================================
// Exchange Definitions
// ============================================

interface ExchangeConfig {
  name: string;
  type: 'topic' | 'fanout' | 'direct';
  durable: boolean;
}

const exchanges: ExchangeConfig[] = [
  { name: 'user.events', type: 'topic', durable: true },
  { name: 'server.events', type: 'topic', durable: true },
  { name: 'payment.events', type: 'topic', durable: true },
  { name: 'notification.events', type: 'topic', durable: true },
  { name: 'audit.events', type: 'fanout', durable: true },
];

// Queue bindings - which services consume which events
interface QueueBinding {
  queue: string;
  exchange: string;
  routingKeys: string[];
}

const queueBindings: QueueBinding[] = [
  // Notification Service consumes all user events
  { queue: 'notification-service.user', exchange: 'user.events', routingKeys: ['user.*'] },
  { queue: 'notification-service.auth', exchange: 'user.events', routingKeys: ['auth.*'] },
  { queue: 'notification-service.payment', exchange: 'payment.events', routingKeys: ['payment.*'] },

  // Audit Service consumes all events
  { queue: 'audit-service', exchange: 'user.events', routingKeys: ['#'] },
  { queue: 'audit-service', exchange: 'server.events', routingKeys: ['#'] },
  { queue: 'audit-service', exchange: 'payment.events', routingKeys: ['#'] },
  { queue: 'audit-service', exchange: 'audit.events', routingKeys: ['#'] },

  // Search Service consumes server events
  {
    queue: 'search-service',
    exchange: 'server.events',
    routingKeys: ['server.created', 'server.updated', 'server.deleted'],
  },

  // Analytics Service consumes all events
  { queue: 'analytics-service', exchange: 'user.events', routingKeys: ['#'] },
  { queue: 'analytics-service', exchange: 'server.events', routingKeys: ['#'] },
  { queue: 'analytics-service', exchange: 'payment.events', routingKeys: ['#'] },
];

// ============================================
// Global State
// ============================================

let app: Express;
let server: ReturnType<typeof app.listen> | null = null;
let connectionManager: ConnectionManager;
let subscriptionManager: SubscriptionManager;

// ============================================
// RabbitMQ Setup
// ============================================

async function setupRabbitMQ(): Promise<void> {
  // Initialize connection manager
  connectionManager = new ConnectionManager({
    url: RABBITMQ_URL,
    maxRetries: 10,
    initialRetryDelay: 1000,
    maxRetryDelay: 30000,
    heartbeatInterval: 60,
  });

  // Initialize subscription manager
  subscriptionManager = new SubscriptionManager();

  // Set up connection manager event handlers
  connectionManager.on('connected', async () => {
    logger.info('[EventBus] Connection established, setting up infrastructure...');
    await setupInfrastructure();
  });

  connectionManager.on('error', (err) => {
    logger.error('[EventBus] Connection error:', err);
  });

  connectionManager.on('failed', (err) => {
    logger.error('[EventBus] Connection failed permanently:', err);
    process.exit(1);
  });

  // Connect to RabbitMQ
  await connectionManager.connect();
}

async function setupInfrastructure(): Promise<void> {
  const channel = connectionManager.getChannel();
  if (!channel) {
    throw new Error('Channel not available');
  }

  // Set channel on subscription manager
  subscriptionManager.setChannel(channel);

  // Declare exchanges
  for (const exchange of exchanges) {
    await channel.assertExchange(exchange.name, exchange.type, { durable: exchange.durable });
    logger.info(`[EventBus] Exchange declared: ${exchange.name}`);
  }

  // Declare queues and bindings
  const declaredQueues = new Set<string>();

  for (const binding of queueBindings) {
    // Declare queue
    if (!declaredQueues.has(binding.queue)) {
      await channel.assertQueue(binding.queue, { durable: true });
      declaredQueues.add(binding.queue);
    }

    // Bind to exchange
    for (const routingKey of binding.routingKeys) {
      await channel.bindQueue(binding.queue, binding.exchange, routingKey);
      logger.info(`[EventBus] Bound ${binding.queue} to ${binding.exchange}:${routingKey}`);
    }
  }

  // Set up dead letter exchange
  await channel.assertExchange('dlx.events', 'topic', { durable: true });
  await channel.assertQueue('dead-letter', { durable: true });
  await channel.bindQueue('dead-letter', 'dlx.events', '#');

  // Start consuming dead-letter queue for monitoring
  await startDeadLetterMonitoring();

  // Start queue depth monitoring
  startQueueMonitoring();

  logger.info('[EventBus] Infrastructure setup complete');
}

async function startDeadLetterMonitoring(): Promise<void> {
  const channel = connectionManager.getChannel();
  if (!channel) return;

  await channel.consume('dead-letter', async (msg) => {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      logger.warn('[EventBus] Dead-letter received:', {
        routingKey: msg.fields.routingKey,
        content,
        headers: msg.properties.headers,
      });
      channel.ack(msg);
    } catch (error) {
      logger.error('[EventBus] Error processing dead-letter:', error);
      channel.nack(msg, false, false);
    }
  });
}

let monitoringInterval: NodeJS.Timeout | null = null;

function startQueueMonitoring(): void {
  monitoringInterval = setInterval(async () => {
    const channel = connectionManager.getChannel();
    if (!channel) return;

    try {
      for (const queue of [
        'notification-service.user',
        'audit-service',
        'search-service',
        'analytics-service',
      ]) {
        const info = await channel.checkQueue(queue);
        if (info.messageCount > 100) {
          logger.warn(`[EventBus] Queue ${queue} has ${info.messageCount} messages`);
        }
      }
    } catch {
      // Queue might not exist in all environments
    }
  }, 60000);
}

// ============================================
// Express API Server
// ============================================

function setupExpress(): void {
  app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`[API] ${req.method} ${req.path}`);
    next();
  });

  // CORS headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
  });

  // Health routes
  app.use(
    createHealthRoutes({
      getConnectionState: () => connectionManager.getState(),
      getConnectionStats: () => connectionManager.getStats(),
      getSubscriptionManager: () => subscriptionManager,
    })
  );

  // API routes
  app.use(
    '/api',
    createApiRoutes({
      getChannel: () => connectionManager.getChannel(),
      getSubscriptionManager: () => subscriptionManager,
    })
  );

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'event-bus',
      version: '1.0.0',
      status: connectionManager.getState() === ConnectionState.CONNECTED ? 'running' : 'connecting',
      endpoints: {
        health: '/health',
        ready: '/ready',
        healthDetailed: '/health/detailed',
        api: '/api',
      },
    });
  });

  // Error handling
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('[API] Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
    });
  });
}

async function startServer(): Promise<void> {
  setupExpress();

  return new Promise((resolve) => {
    server = app.listen(API_PORT, API_HOST, () => {
      logger.info(`[EventBus] API server listening on ${API_HOST}:${API_PORT}`);
      resolve();
    });
  });
}

// ============================================
// Publish Function (Exported API)
// ============================================

async function publishEvent(
  exchange: string,
  routingKey: string,
  event: object,
  options?: {
    correlationId?: string;
    headers?: Record<string, string>;
  }
): Promise<void> {
  const channel = connectionManager.getChannel();
  if (!channel) {
    throw new Error('EventBus not connected');
  }

  const message = {
    ...event,
    _meta: {
      publishedAt: new Date().toISOString(),
      exchange,
      routingKey,
      correlationId: options?.correlationId,
    },
  };

  const published = channel.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      contentType: 'application/json',
      headers: {
        ...options?.headers,
        'x-correlation-id': options?.correlationId,
      },
    }
  );

  if (!published) {
    logger.warn(`[EventBus] Buffer full, event may be delayed: ${exchange}:${routingKey}`);
  }

  logger.debug(`[EventBus] Published ${exchange}:${routingKey}`);
}

// ============================================
// Graceful Shutdown
// ============================================

async function shutdown(): Promise<void> {
  logger.info('[EventBus] Shutting down...');

  // Stop monitoring
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  // Close HTTP server
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        logger.info('[EventBus] HTTP server closed');
        resolve();
      });
    });
    server = null;
  }

  // Disconnect from RabbitMQ
  await connectionManager.disconnect();

  logger.info('[EventBus] Shutdown complete');
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  try {
    logger.info('[EventBus] Starting Event Bus Service...');

    // Connect to RabbitMQ
    await setupRabbitMQ();

    // Start HTTP API server
    await startServer();

    logger.info('[EventBus] Event Bus Service started successfully');
  } catch (error) {
    logger.error('[EventBus] Failed to start:', error);
    process.exit(1);
  }
}

main();

// Export for use by other services
export { publishEvent, shutdown };
export default { publishEvent, shutdown };

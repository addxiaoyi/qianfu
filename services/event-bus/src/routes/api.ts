/**
 * Event Bus API Routes
 * REST API for publishing events and managing subscriptions
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Channel } from 'amqplib';
import { logger } from '../utils/logger.js';
import { SubscriptionManager } from '../subscriptions.js';
import {
  USER_EVENT_TYPES,
  SERVER_EVENT_TYPES,
  PAYMENT_EVENT_TYPES,
  EVENT_VALIDATORS,
} from '../events/types.js';

// ============================================
// Request Schemas
// ============================================

const PublishEventSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
});

const CreateSubscriptionSchema = z.object({
  id: z.string().min(1),
  queue: z.string().min(1),
  exchange: z.string().min(1),
  routingKeys: z.array(z.string()).min(1),
  deadLetterExchange: z.string().optional(),
  deadLetterRoutingKey: z.string().optional(),
  messageTTL: z.number().int().positive().optional(),
});

// ============================================
// API Routes
// ============================================

export interface ApiRoutesOptions {
  getChannel: () => Channel | null;
  getSubscriptionManager: () => SubscriptionManager;
}

export function createApiRoutes(options: ApiRoutesOptions): Router {
  const router = Router();

  // ========================================
  // Event Publishing
  // ========================================

  /**
   * POST /api/events/publish
   * Publish an event to the event bus
   */
  router.post('/events/publish', async (req: Request, res: Response) => {
    try {
      const channel = options.getChannel();
      if (!channel) {
        return res.status(503).json({
          success: false,
          error: 'Event bus not connected',
        });
      }

      // Validate request body
      const parseResult = PublishEventSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.format(),
        });
      }

      const { type, payload, correlationId, causationId } = parseResult.data;

      // Validate event payload if we have a validator
      if (EVENT_VALIDATORS[type]) {
        const validator = EVENT_VALIDATORS[type];
        const result = validator.safeParse(payload);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid payload for event type: ${type}`,
            details: result.error.format(),
          });
        }
      }

      // Build message
      const message = {
        type,
        payload,
        metadata: {
          correlationId,
          causationId,
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'api',
        },
      };

      // Determine exchange from event type
      const exchange = getExchangeForEventType(type);
      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: `Unknown event type: ${type}`,
        });
      }

      // Publish message
      const published = channel.publish(
        exchange,
        type,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          contentType: 'application/json',
          headers: {
            'x-correlation-id': correlationId,
            'x-causation-id': causationId,
          },
        }
      );

      if (!published) {
        logger.warn(`[API] Buffer full for event: ${type}`);
      }

      logger.info(`[API] Published event: ${type}`);

      res.status(201).json({
        success: true,
        eventType: type,
        exchange,
        correlationId,
      });
    } catch (error) {
      logger.error('[API] Error publishing event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to publish event',
      });
    }
  });

  // ========================================
  // Event Types
  // ========================================

  /**
   * GET /api/events/types
   * List all available event types
   */
  router.get('/events/types', (_req: Request, res: Response) => {
    res.json({
      success: true,
      eventTypes: {
        user: USER_EVENT_TYPES,
        server: SERVER_EVENT_TYPES,
        payment: PAYMENT_EVENT_TYPES,
      },
      validators: Object.keys(EVENT_VALIDATORS),
    });
  });

  // ========================================
  // Subscriptions
  // ========================================

  /**
   * GET /api/subscriptions
   * List all active subscriptions
   */
  router.get('/subscriptions', (_req: Request, res: Response) => {
    const subManager = options.getSubscriptionManager();
    const stats = subManager.getStats();

    res.json({
      success: true,
      ...stats,
    });
  });

  /**
   * GET /api/subscriptions/:id
   * Get subscription details
   */
  router.get('/subscriptions/:id', (req: Request, res: Response) => {
    const subManager = options.getSubscriptionManager();
    const subscription = subManager.getSubscription(req.params.id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    res.json({
      success: true,
      subscription,
    });
  });

  /**
   * POST /api/subscriptions
   * Create a new subscription
   */
  router.post('/subscriptions', async (req: Request, res: Response) => {
    try {
      const channel = options.getChannel();
      if (!channel) {
        return res.status(503).json({
          success: false,
          error: 'Event bus not connected',
        });
      }

      // Validate request body
      const parseResult = CreateSubscriptionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.format(),
        });
      }

      const { id, queue, exchange, routingKeys, deadLetterExchange, deadLetterRoutingKey, messageTTL } =
        parseResult.data;

      const subManager = options.getSubscriptionManager();

      // Check if subscription already exists
      if (subManager.getSubscription(id)) {
        return res.status(409).json({
          success: false,
          error: 'Subscription already exists',
        });
      }

      // Create subscription with noop handler (just for API monitoring)
      const _subscription = await subManager.subscribe(id, {
        queue,
        exchange,
        routingKeys,
        deadLetterExchange,
        deadLetterRoutingKey,
        messageTTL,
        handler: async () => {},
      });

      // Override handler with noop after initial setup
      await subManager.unsubscribe(id);

      // Recreate with noop handler
      await subManager.subscribe(id, {
        queue,
        exchange,
        routingKeys,
        deadLetterExchange,
        deadLetterRoutingKey,
        messageTTL,
      }, async () => {});

      logger.info(`[API] Created subscription: ${id}`);

      res.status(201).json({
        success: true,
        subscription: subManager.getSubscription(id),
      });
    } catch (error) {
      logger.error('[API] Error creating subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create subscription',
      });
    }
  });

  /**
   * DELETE /api/subscriptions/:id
   * Remove a subscription
   */
  router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
    try {
      const subManager = options.getSubscriptionManager();
      const subscription = subManager.getSubscription(req.params.id);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
      }

      await subManager.unsubscribe(req.params.id);

      logger.info(`[API] Deleted subscription: ${req.params.id}`);

      res.json({
        success: true,
        message: 'Subscription deleted',
      });
    } catch (error) {
      logger.error('[API] Error deleting subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete subscription',
      });
    }
  });

  return router;
}

// ============================================
// Helper Functions
// ============================================

function getExchangeForEventType(type: string): string | null {
  if (type.startsWith('user.') || type.startsWith('auth.')) {
    return 'user.events';
  }
  if (type.startsWith('server.')) {
    return 'server.events';
  }
  if (type.startsWith('payment.') || type.startsWith('wallet.')) {
    return 'payment.events';
  }
  if (type.startsWith('notification.')) {
    return 'notification.events';
  }
  if (type.startsWith('audit.')) {
    return 'audit.events';
  }
  return null;
}

export default createApiRoutes;

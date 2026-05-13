/**
 * Subscription Manager
 * Handles event subscriptions with acknowledgment and retry logic
 */

import { Channel, ConsumeMessage } from 'amqplib';
import { logger } from '../utils/logger.js';
import { validateEvent } from '../events/types.js';
import { EventEmitter } from 'events';

export interface SubscriptionOptions {
  queue: string;
  exchange: string;
  routingKeys: string[];
  prefetch?: number;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  messageTTL?: number;
}

export interface SubscriptionHandler {
  (event: unknown, message: ConsumeMessage): Promise<void>;
}

export interface Subscription {
  id: string;
  queue: string;
  exchange: string;
  routingKeys: string[];
  consumerTag?: string;
  createdAt: Date;
  messageCount: number;
  errorCount: number;
}

export class SubscriptionManager extends EventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private handlers: Map<string, SubscriptionHandler> = new Map();
  private channel: Channel | null = null;

  constructor() {
    super();
  }

  setChannel(channel: Channel): void {
    this.channel = channel;
  }

  async subscribe(
    id: string,
    options: SubscriptionOptions,
    handler: SubscriptionHandler
  ): Promise<Subscription> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    logger.info(`[SubscriptionManager] Creating subscription: ${id}`);

    // Assert queue with options
    const queueOptions: Record<string, unknown> = {
      durable: true,
    };

    if (options.deadLetterExchange) {
      queueOptions.deadLetterExchange = options.deadLetterExchange;
    }

    if (options.deadLetterRoutingKey) {
      queueOptions.deadLetterRoutingKey = options.deadLetterRoutingKey;
    }

    if (options.messageTTL) {
      queueOptions.messageTtl = options.messageTTL;
    }

    await this.channel.assertQueue(options.queue, queueOptions);

    // Bind queue to exchange with routing keys
    for (const routingKey of options.routingKeys) {
      await this.channel.bindQueue(options.queue, options.exchange, routingKey);
      logger.debug(`[SubscriptionManager] Bound ${options.queue} to ${options.exchange}:${routingKey}`);
    }

    // Start consuming
    const { consumerTag } = await this.channel.consume(
      options.queue,
      async (msg) => {
        if (!msg) return;

        try {
          await this.handleMessage(id, msg);
        } catch (error) {
          logger.error(`[SubscriptionManager] Error handling message:`, error);
          // Reject and requeue once, then dead-letter
          this.channel?.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    // Store subscription
    const subscription: Subscription = {
      id,
      queue: options.queue,
      exchange: options.exchange,
      routingKeys: options.routingKeys,
      consumerTag,
      createdAt: new Date(),
      messageCount: 0,
      errorCount: 0,
    };

    this.subscriptions.set(id, subscription);
    this.handlers.set(id, handler);

    logger.info(`[SubscriptionManager] Subscription created: ${id} (${consumerTag})`);
    this.emit('subscriptionCreated', subscription);

    return subscription;
  }

  private async handleMessage(subscriptionId: string, message: ConsumeMessage): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    const handler = this.handlers.get(subscriptionId);

    if (!subscription || !handler) {
      logger.warn(`[SubscriptionManager] Unknown subscription: ${subscriptionId}`);
      this.channel?.ack(message);
      return;
    }

    try {
      // Parse message content
      const content = JSON.parse(message.content.toString());

      // Validate event structure
      const event = validateEvent(content);

      // Execute handler
      await handler(event, message);

      // Acknowledge successful processing
      this.channel?.ack(message);
      subscription.messageCount++;

      logger.debug(`[SubscriptionManager] Processed message: ${event.type}`);
    } catch (error) {
      subscription.errorCount++;
      logger.error(`[SubscriptionManager] Handler error for ${subscriptionId}:`, error);
      throw error;
    }
  }

  async unsubscribe(id: string): Promise<void> {
    const subscription = this.subscriptions.get(id);

    if (!subscription) {
      logger.warn(`[SubscriptionManager] Subscription not found: ${id}`);
      return;
    }

    if (this.channel && subscription.consumerTag) {
      await this.channel.cancel(subscription.consumerTag);
    }

    this.subscriptions.delete(id);
    this.handlers.delete(id);

    logger.info(`[SubscriptionManager] Unsubscribed: ${id}`);
    this.emit('subscriptionRemoved', id);
  }

  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  getAllSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  getStats(): {
    totalSubscriptions: number;
    totalMessages: number;
    totalErrors: number;
    subscriptions: Subscription[];
  } {
    const subscriptions = this.getAllSubscriptions();
    return {
      totalSubscriptions: subscriptions.length,
      totalMessages: subscriptions.reduce((sum, s) => sum + s.messageCount, 0),
      totalErrors: subscriptions.reduce((sum, s) => sum + s.errorCount, 0),
      subscriptions,
    };
  }
}

export default SubscriptionManager;

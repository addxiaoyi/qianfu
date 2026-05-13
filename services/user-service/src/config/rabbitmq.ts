/**
 * RabbitMQ Configuration
 */

import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { logger } from '../utils/logger.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://qianfu:password@localhost:5672';

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function setupRabbitMQ(): Promise<Channel> {
  if (channel) {
    return channel;
  }

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Setup exchanges
    await channel.assertExchange('user.events', 'topic', { durable: true });
    await channel.assertExchange('notification.events', 'topic', { durable: true });
    await channel.assertExchange('auth.events', 'topic', { durable: true });

    // Setup queues
    await channel.assertQueue('user-service.notifications', { durable: true });
    await channel.assertQueue('user-service.commands', { durable: true });

    // Bind queues to exchanges
    await channel.bindQueue('user-service.notifications', 'user.events', 'user.*');
    await channel.bindQueue('user-service.notifications', 'auth.events', 'auth.*');
    await channel.bindQueue('user-service.commands', 'notification.events', '#');

    // Handle connection errors
    connection.on('error', (err) => {
      logger.error('[RabbitMQ] Connection error:', err);
    });

    connection.on('close', () => {
      logger.warn('[RabbitMQ] Connection closed');
      channel = null;
      connection = null;
    });

    logger.info('[RabbitMQ] Setup complete');

    return channel;
  } catch (error) {
    logger.error('[RabbitMQ] Failed to connect:', error);
    throw error;
  }
}

export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('[RabbitMQ] Connection closed');
  } catch (error) {
    logger.error('[RabbitMQ] Error closing connection:', error);
  }
}

export function getChannel(): Channel {
  if (!channel) {
    throw new Error('RabbitMQ not connected. Call setupRabbitMQ() first.');
  }
  return channel;
}

export async function publishEvent(
  exchange: string,
  routingKey: string,
  event: object
): Promise<void> {
  const ch = getChannel();
  
  const message = Buffer.from(JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  }));

  ch.publish(exchange, routingKey, message, {
    persistent: true,
    contentType: 'application/json',
  });

  logger.debug(`[RabbitMQ] Published ${exchange}:${routingKey}`);
}

export async function consumeMessages(
  queue: string,
  handler: (msg: ConsumeMessage) => Promise<void>
): Promise<void> {
  const ch = getChannel();

  await ch.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      await handler(msg);
      ch.ack(msg);
    } catch (error) {
      logger.error(`[RabbitMQ] Error processing message from ${queue}:`, error);
      // Negative acknowledgment - requeue or dead-letter
      ch.nack(msg, false, false);
    }
  });

  logger.info(`[RabbitMQ] Started consuming from ${queue}`);
}

export async function isRabbitMQHealthy(): Promise<boolean> {
  try {
    return connection !== null && channel !== null;
  } catch {
    return false;
  }
}

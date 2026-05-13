/**
 * Event Consumers
 */

import { consumeMessages } from '../config/rabbitmq.js';
import { logger } from '../utils/logger.js';

export async function setupEventConsumers(): Promise<void> {
  // Notification consumer
  await consumeMessages('user-service.notifications', async (msg) => {
    const event = JSON.parse(msg.content.toString());
    
    logger.info(`[Event] Received: ${event.type}`, {
      payload: event.payload,
    });

    // Handle different event types
    switch (event.type) {
      case 'user.created':
        await handleUserCreated(event);
        break;
      case 'user.updated':
        await handleUserUpdated(event);
        break;
      case 'user.deleted':
        await handleUserDeleted(event);
        break;
      default:
        logger.warn(`[Event] Unknown event type: ${event.type}`);
    }
  });

  // Command consumer (for request-response patterns)
  await consumeMessages('user-service.commands', async (msg) => {
    const command = JSON.parse(msg.content.toString());
    logger.info(`[Command] Received: ${command.type}`, { payload: command.payload });
  });

  logger.info('[Events] All consumers registered');
}

async function handleUserCreated(event: any): Promise<void> {
  logger.info('[Event] Processing user.created', { userId: event.payload.id });
  // Could trigger welcome email, create default settings, etc.
}

async function handleUserUpdated(event: any): Promise<void> {
  logger.info('[Event] Processing user.updated', { userId: event.payload.id });
  // Could sync to search index, notify other services, etc.
}

async function handleUserDeleted(event: any): Promise<void> {
  logger.info('[Event] Processing user.deleted', { userId: event.payload.id });
  // Could cleanup related data, notify other services, etc.
}

import crypto from 'crypto';
import { redisService } from './redisService.js';
import { logger } from '../utils/logger.js';
import * as emailService from './emailService.js';
import { handleError } from '../utils/errors';

const QUEUE_KEY = 'notification_queue';
const MAX_RETRIES = 3;

export interface NotificationTask {
  type: 'VERIFICATION_EMAIL' | 'TICKET_NOTIFICATION' | 'RESET_PASSWORD_EMAIL';
  payload: any;
  userId?: string | number;
  retryCount?: number;
  id?: string;
}

export class NotificationQueue {
  private isProcessing = false;
  private interval: NodeJS.Timeout | null = null;

  /**
   * Push a notification task to the queue
   */
  async push(task: NotificationTask) {
    task.id = task.id || crypto.randomUUID();
    task.retryCount = task.retryCount || 0;
    
    // Check rate limit if userId is provided
    if (task.userId) {
      const rateLimitKey = `notification:rate:${task.userId}`;
      const count = await redisService.incr(rateLimitKey, 60); // 1 minute window
      if (count > 10) { // Max 10 notifications per minute per user
        logger.warn(`[Queue] Rate limit exceeded for user ${task.userId}`);
        throw handleError(new Error('Too many notification requests. Please try again later.'));
      }
    }
    
    logger.info(`[Queue] Pushing task ${task.id} (${task.type})`);
    await redisService.lpush(QUEUE_KEY, task);
    
    // Trigger processing if not already running
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  /**
   * Start the queue worker
   */
  startWorker(intervalMs: number = 5000) {
    if (this.interval) return;
    
    logger.info(`[Queue] Starting notification worker (interval: ${intervalMs}ms)`);
    this.interval = setInterval(() => {
      if (!this.isProcessing) {
        this.processNext();
      }
    }, intervalMs);
  }

  /**
   * Process the next task in the queue
   */
  private async processNext() {
    this.isProcessing = true;
    
    try {
      const task = await redisService.rpop<NotificationTask>(QUEUE_KEY);
      if (!task) {
        this.isProcessing = false;
        return;
      }

      logger.info(`[Queue] Processing task ${task.id} (${task.type}, attempt: ${task.retryCount! + 1})`);
      
      try {
        await this.handleTask(task);
        logger.info(`[Queue] Task ${task.id} completed successfully`);
      } catch (error: any) {
        logger.error(`[Queue] Task ${task.id} failed: ${error.message}`);
        
        if (task.retryCount! < MAX_RETRIES) {
          task.retryCount!++;
          // Push back to the queue for retry with delay (exponential backoff simulated by pushing to end)
          await redisService.lpush(QUEUE_KEY, task);
          logger.info(`[Queue] Task ${task.id} re-queued for retry (${task.retryCount}/${MAX_RETRIES})`);
        } else {
          logger.error(`[Queue] Task ${task.id} failed after maximum retries`);
        }
      }
      
      // Process next immediately if there was a task
      setImmediate(() => this.processNext());
    } catch (error: any) {
      logger.error(`[Queue] Worker error: ${error.message}`);
      this.isProcessing = false;
    }
  }

  /**
   * Route the task to the correct handler
   */
  private async handleTask(task: NotificationTask) {
    const { type, payload } = task;
    
    switch (type) {
      case 'VERIFICATION_EMAIL':
        await emailService.sendVerificationEmail(payload.email, payload.token);
        break;
      case 'RESET_PASSWORD_EMAIL':
        await emailService.sendPasswordResetEmail(payload.email, payload.token);
        break;
      case 'TICKET_NOTIFICATION':
        await emailService.sendTicketNotification(payload.ticket, payload.user, payload.adminEmails);
        break;
      default:
        logger.warn(`[Queue] Unknown task type: ${type}`);
        throw handleError(new Error(`Unknown notification task type: ${type}`));
    }
  }

  stopWorker() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export const notificationQueue = new NotificationQueue();
export default notificationQueue;

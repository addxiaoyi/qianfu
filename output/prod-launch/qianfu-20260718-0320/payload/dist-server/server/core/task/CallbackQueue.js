import { logger } from '../utils/logger.js';
import { redisService } from '../../services/redisService.js';
import { assertSafeOutboundCallbackUrl, assertSafeResolvedOutboundCallbackUrl } from './callbackOutboundPolicy.js';
import crypto from 'crypto';
const CALLBACK_QUEUE_KEY = 'qianfu:callback:queue';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAYS = [0, 30, 120, 600, 1800];
export class CallbackQueue {
    static instance;
    isProcessing = false;
    processorInterval = null;
    queue = new Map();
    retryQueue = new Map();
    constructor() {
        this.startProcessor();
    }
    static getInstance() {
        if (!CallbackQueue.instance) {
            CallbackQueue.instance = new CallbackQueue();
        }
        return CallbackQueue.instance;
    }
    async addTask(url, payload) {
        assertSafeOutboundCallbackUrl(url);
        await assertSafeResolvedOutboundCallbackUrl(url);
        const id = crypto.randomUUID();
        const task = {
            id,
            url,
            payload,
            attempts: 0,
            nextRetryTime: Date.now(),
            createdAt: Date.now(),
        };
        this.queue.set(id, task);
        await redisService.set(`${CALLBACK_QUEUE_KEY}:${id}`, JSON.stringify(task), 86400);
        logger.info(`[CallbackQueue] Task ${id} added to queue`);
        return id;
    }
    async retryTask(taskId) {
        const taskJson = await redisService.get(`${CALLBACK_QUEUE_KEY}:${taskId}`);
        if (!taskJson) {
            logger.warn(`[CallbackQueue] Task ${taskId} not found for retry`);
            return;
        }
        const task = JSON.parse(taskJson);
        task.attempts++;
        if (task.attempts > MAX_RETRY_ATTEMPTS) {
            await this.moveToDeadLetter(task);
            return;
        }
        const delay = RETRY_DELAYS[Math.min(task.attempts - 1, RETRY_DELAYS.length - 1)];
        task.nextRetryTime = Date.now() + delay * 1000;
        this.queue.delete(taskId);
        this.retryQueue.set(taskId, task);
        await redisService.set(`${CALLBACK_QUEUE_KEY}:${taskId}`, JSON.stringify(task), 86400);
        logger.info(`[CallbackQueue] Task ${taskId} scheduled for retry #${task.attempts} in ${delay}s`);
    }
    async moveToDeadLetter(task) {
        const deadLetterKey = `${CALLBACK_QUEUE_KEY}:deadletter:${task.id}`;
        await redisService.set(deadLetterKey, JSON.stringify(task), 86400 * 7);
        await redisService.del(`${CALLBACK_QUEUE_KEY}:${task.id}`);
        this.queue.delete(task.id);
        this.retryQueue.delete(task.id);
        logger.error(`[CallbackQueue] Task ${task.id} moved to dead letter after ${MAX_RETRY_ATTEMPTS} attempts`);
    }
    async executeCallback(task) {
        try {
            assertSafeOutboundCallbackUrl(task.url);
            await assertSafeResolvedOutboundCallbackUrl(task.url);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(task.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Callback-ID': task.id,
                    'X-Callback-Attempt': String(task.attempts + 1),
                },
                body: JSON.stringify(task.payload),
                signal: controller.signal,
                redirect: 'manual',
            }).finally(() => clearTimeout(timeoutId));
            if (response.ok) {
                await response.body?.cancel();
                return { success: true, shouldRetry: false };
            }
            const isRedirect = response.status >= 300 && response.status < 400;
            await response.body?.cancel();
            return {
                success: false,
                error: isRedirect ? `HTTP ${response.status}: redirect not allowed` : `HTTP ${response.status}`,
                shouldRetry: !isRedirect && task.attempts < MAX_RETRY_ATTEMPTS - 1,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Unknown error',
                shouldRetry: task.attempts < MAX_RETRY_ATTEMPTS - 1,
            };
        }
    }
    async processQueue() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            const now = Date.now();
            for (const [id, task] of this.queue.entries()) {
                if (task.nextRetryTime <= now) {
                    this.queue.delete(id);
                    logger.info(`[CallbackQueue] Processing task ${id} (attempt ${task.attempts + 1})`);
                    const result = await this.executeCallback(task);
                    if (result.success) {
                        await redisService.del(`${CALLBACK_QUEUE_KEY}:${id}`);
                        logger.info(`[CallbackQueue] Task ${id} completed successfully`);
                    }
                    else if (result.shouldRetry) {
                        await this.retryTask(id);
                    }
                    else {
                        await this.moveToDeadLetter(task);
                    }
                }
            }
            for (const [id, task] of this.retryQueue.entries()) {
                if (task.nextRetryTime <= now) {
                    this.retryQueue.delete(id);
                    logger.info(`[CallbackQueue] Processing retry task ${id} (attempt ${task.attempts})`);
                    const result = await this.executeCallback(task);
                    if (result.success) {
                        await redisService.del(`${CALLBACK_QUEUE_KEY}:${id}`);
                        logger.info(`[CallbackQueue] Task ${id} completed successfully`);
                    }
                    else if (result.shouldRetry) {
                        await this.retryTask(id);
                    }
                    else {
                        await this.moveToDeadLetter(task);
                    }
                }
            }
        }
        catch (error) {
            logger.error(`[CallbackQueue] Error processing queue:`, error);
        }
        finally {
            this.isProcessing = false;
        }
    }
    startProcessor() {
        if (this.processorInterval)
            return;
        this.processorInterval = setInterval(() => {
            this.processQueue().catch((err) => logger.error('CallbackQueue process failed', { error: err }));
        }, 30000);
        logger.info('[CallbackQueue] Callback processor started (every 30s)');
    }
    stopProcessor() {
        if (this.processorInterval) {
            clearInterval(this.processorInterval);
            this.processorInterval = null;
            logger.info('[CallbackQueue] Callback processor stopped');
        }
    }
    async getQueueStats() {
        const pending = this.queue.size + this.retryQueue.size;
        return { pending, processing: 0, deadLetter: 0 };
    }
}
export const callbackQueue = CallbackQueue.getInstance();
//# sourceMappingURL=CallbackQueue.js.map
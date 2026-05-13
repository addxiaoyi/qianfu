import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationQueue } from '../../server/services/notificationQueue.js';
import { redisService } from '../../server/services/redisService.js';
import * as emailServiceModule from '../../server/services/emailService.js';
import { logger } from '../../server/utils/logger.js';

describe('NotificationQueue', () => {
  let queue: NotificationQueue;
  let redisIncrSpy: any;
  let redisLpushSpy: any;
  let redisRpopSpy: any;
  let sendVerificationEmailSpy: any;
  let sendPasswordResetEmailSpy: any;
  let sendTicketNotificationSpy: any;
  let loggerInfoSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new NotificationQueue();

    redisIncrSpy = vi.spyOn(redisService, 'incr');
    redisIncrSpy.mockResolvedValue(1);

    redisLpushSpy = vi.spyOn(redisService, 'lpush');
    redisLpushSpy.mockResolvedValue(undefined);

    redisRpopSpy = vi.spyOn(redisService, 'rpop');
    redisRpopSpy.mockResolvedValue(null);

    sendVerificationEmailSpy = vi.spyOn(emailServiceModule, 'sendVerificationEmail');
    sendVerificationEmailSpy.mockResolvedValue(undefined);

    sendPasswordResetEmailSpy = vi.spyOn(emailServiceModule, 'sendPasswordResetEmail');
    sendPasswordResetEmailSpy.mockResolvedValue(undefined);

    sendTicketNotificationSpy = vi.spyOn(emailServiceModule, 'sendTicketNotification');
    sendTicketNotificationSpy.mockResolvedValue(undefined);

    loggerInfoSpy = vi.spyOn(logger, 'info');
    loggerInfoSpy.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    try { (queue as any).stopWorker(); } catch {}
  });

  describe('push', () => {
    it('should push a task to Redis list with auto-generated id', async () => {
      redisRpopSpy.mockResolvedValueOnce(null);

      await (queue as any).push({
        type: 'VERIFICATION_EMAIL',
        payload: { email: 'test@test.com', token: 'abc' },
      });

      expect(redisLpushSpy).toHaveBeenCalledWith('notification_queue', expect.objectContaining({
        type: 'VERIFICATION_EMAIL',
        id: expect.any(String),
        retryCount: 0,
      }));
    });

    it('should use provided id when given', async () => {
      redisRpopSpy.mockResolvedValueOnce(null);

      await (queue as any).push({
        type: 'RESET_PASSWORD_EMAIL',
        payload: { email: 'test@test.com', token: 'xyz' },
        id: 'my-custom-id',
      });

      expect(redisLpushSpy).toHaveBeenCalledWith('notification_queue', expect.objectContaining({
        id: 'my-custom-id',
      }));
    });

    it('should respect rate limit of 10 per minute per userId', async () => {
      redisRpopSpy.mockResolvedValueOnce(null);
      redisIncrSpy.mockResolvedValueOnce(11);

      await expect(
        (queue as any).push({
          type: 'VERIFICATION_EMAIL',
          payload: { email: 'test@test.com', token: 'abc' },
          userId: 'user-1',
        }),
      ).rejects.toThrow('Too many notification requests');
    });

    it('should still proceed when rate limit allows (count <= 10)', async () => {
      redisRpopSpy.mockResolvedValueOnce(null);
      redisIncrSpy.mockResolvedValueOnce(5);

      await (queue as any).push({
        type: 'VERIFICATION_EMAIL',
        payload: { email: 'test@test.com', token: 'abc' },
        userId: 'user-2',
      });

      expect(redisLpushSpy).toHaveBeenCalled();
    });

    it('should not call incr when userId is missing', async () => {
      redisRpopSpy.mockResolvedValueOnce(null);
      redisIncrSpy.mockResolvedValueOnce(999);

      await (queue as any).push({
        type: 'VERIFICATION_EMAIL',
        payload: { email: 'test@test.com', token: 'abc' },
      });

      expect(redisIncrSpy).not.toHaveBeenCalled();
      expect(redisLpushSpy).toHaveBeenCalled();
    });
  });

  describe('startWorker', () => {
    it('should process tasks periodically', async () => {
      redisRpopSpy.mockResolvedValueOnce({
        type: 'VERIFICATION_EMAIL',
        payload: { email: 'test@test.com', token: 'abc' },
        id: 'task-1',
        retryCount: 0,
      });

      (queue as any).startWorker(100);
      await vi.advanceTimersByTimeAsync(200);

      expect(sendVerificationEmailSpy).toHaveBeenCalledWith('test@test.com', 'abc');

      (queue as any).stopWorker();
    });

    it('should not start a second worker if one is already running', () => {
      (queue as any).startWorker(100);
      (queue as any).startWorker(100);

      expect((queue as any).interval).toBeDefined();

      (queue as any).stopWorker();
    });
  });

  describe('task handling', () => {
    it('should handle VERIFICATION_EMAIL task type', async () => {
      redisRpopSpy.mockResolvedValueOnce({
        type: 'VERIFICATION_EMAIL',
        payload: { email: 'user@example.com', token: 'tok123' },
        id: 'v-1',
        retryCount: 0,
      });

      (queue as any).startWorker(100);
      await vi.advanceTimersByTimeAsync(200);

      expect(sendVerificationEmailSpy).toHaveBeenCalledWith('user@example.com', 'tok123');
      (queue as any).stopWorker();
    });

    it('should handle RESET_PASSWORD_EMAIL task type', async () => {
      redisRpopSpy.mockResolvedValueOnce({
        type: 'RESET_PASSWORD_EMAIL',
        payload: { email: 'user@example.com', token: 'reset-abc' },
        id: 'r-1',
        retryCount: 0,
      });

      (queue as any).startWorker(100);
      await vi.advanceTimersByTimeAsync(200);

      expect(sendPasswordResetEmailSpy).toHaveBeenCalledWith('user@example.com', 'reset-abc');
      (queue as any).stopWorker();
    });

    it('should handle TICKET_NOTIFICATION task type', async () => {
      redisRpopSpy.mockResolvedValueOnce({
        type: 'TICKET_NOTIFICATION',
        payload: {
          ticket: { id: 'T-001', title: 'Login issue' },
          user: { id: 'u-1', name: 'Tester' },
          adminEmails: ['admin@example.com'],
        },
        id: 't-1',
        retryCount: 0,
      });

      (queue as any).startWorker(100);
      await vi.advanceTimersByTimeAsync(200);

      expect(sendTicketNotificationSpy).toHaveBeenCalledWith(
        { id: 'T-001', title: 'Login issue' },
        { id: 'u-1', name: 'Tester' },
        ['admin@example.com'],
      );
      (queue as any).stopWorker();
    });
  });

  describe('retry logic', () => {
    it('should re-queue task on failure if retryCount < MAX_RETRIES', async () => {
      redisRpopSpy
        .mockResolvedValueOnce({
          type: 'VERIFICATION_EMAIL',
          payload: { email: 'fail@test.com', token: 'tok' },
          id: 'retry-1',
          retryCount: 0,
        });

      sendVerificationEmailSpy.mockRejectedValueOnce(new Error('Email service down'));

      (queue as any).startWorker(100);
      await vi.advanceTimersByTimeAsync(200);

      // lpush from retry re-queue only (no initial push in this test)
      expect(redisLpushSpy).toHaveBeenCalledTimes(1);
      expect(sendVerificationEmailSpy).toHaveBeenCalledTimes(1);
      (queue as any).stopWorker();
    });

    it('should permanently fail after MAX_RETRIES (3) exceeded', async () => {
      redisRpopSpy
        .mockResolvedValueOnce({
          type: 'VERIFICATION_EMAIL',
          payload: { email: 'perm-fail@test.com', token: 'tok' },
          id: 'perm-1',
          retryCount: 0,
        })
        .mockResolvedValueOnce({
          type: 'VERIFICATION_EMAIL',
          payload: { email: 'perm-fail@test.com', token: 'tok' },
          id: 'perm-1',
          retryCount: 1,
        })
        .mockResolvedValueOnce({
          type: 'VERIFICATION_EMAIL',
          payload: { email: 'perm-fail@test.com', token: 'tok' },
          id: 'perm-1',
          retryCount: 2,
        })
        .mockResolvedValueOnce(null);

      sendVerificationEmailSpy.mockRejectedValue(new Error('Permanent failure'));

      (queue as any).startWorker(100);
      await vi.advanceTimersByTimeAsync(1000);

      expect(sendVerificationEmailSpy).toHaveBeenCalledTimes(3);
      (queue as any).stopWorker();
    });
  });

  describe('empty queue', () => {
    it('should do nothing when queue is empty', async () => {
      redisRpopSpy.mockResolvedValueOnce(null);

      (queue as any).startWorker(100);
      await vi.advanceTimersByTimeAsync(200);

      expect(redisLpushSpy).not.toHaveBeenCalled();
      expect(sendVerificationEmailSpy).not.toHaveBeenCalled();
      (queue as any).stopWorker();
    });
  });

  describe('stopWorker', () => {
    it('should clear the interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      (queue as any).startWorker(100);
      (queue as any).stopWorker();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      clearIntervalSpy.mockRestore();
    });

    it('should be safe to call when worker was never started', () => {
      expect(() => (queue as any).stopWorker()).not.toThrow();
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationQueue } from '../../server/services/notificationQueue.js';
import { redisService } from '../../server/services/redisService.js';
import * as emailService from '../../server/services/emailService.js';

describe('NotificationQueue reliability', () => {
  let queue: NotificationQueue;
  let incrSpy: ReturnType<typeof vi.spyOn>;
  let lpushSpy: ReturnType<typeof vi.spyOn>;
  let rpoplpushSpy: ReturnType<typeof vi.spyOn>;
  let lremSpy: ReturnType<typeof vi.spyOn>;
  let verificationSpy: ReturnType<typeof vi.spyOn>;
  let resetSpy: ReturnType<typeof vi.spyOn>;
  let ticketSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new NotificationQueue();
    incrSpy = vi.spyOn(redisService, 'incr').mockResolvedValue(1);
    lpushSpy = vi.spyOn(redisService, 'lpush').mockResolvedValue(true);
    rpoplpushSpy = vi.spyOn(redisService, 'rpoplpush').mockResolvedValue(null);
    lremSpy = vi.spyOn(redisService, 'lrem').mockResolvedValue(true);
    verificationSpy = vi.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue(undefined);
    resetSpy = vi.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(undefined);
    ticketSpy = vi.spyOn(emailService, 'sendTicketNotification').mockResolvedValue(undefined);
  });

  afterEach(() => {
    queue.stopWorker();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects enqueue when Redis did not persist the task', async () => {
    lpushSpy.mockResolvedValueOnce(false);

    await expect(queue.push({
      type: 'VERIFICATION_EMAIL',
      payload: { email: 'user@example.com', token: 'token' },
    })).rejects.toMatchObject({ statusCode: 503 });

    expect(rpoplpushSpy).not.toHaveBeenCalled();
  });

  it('persists a generated task id before processing', async () => {
    await queue.push({
      type: 'VERIFICATION_EMAIL',
      payload: { email: 'user@example.com', token: 'token' },
    });

    expect(lpushSpy).toHaveBeenCalledWith('notification_queue', expect.objectContaining({
      id: expect.any(String),
      retryCount: 0,
    }));
  });

  it('keeps the per-user notification rate limit', async () => {
    incrSpy.mockResolvedValueOnce(11);

    await expect(queue.push({
      type: 'VERIFICATION_EMAIL',
      payload: { email: 'user@example.com', token: 'token' },
      userId: 7,
    })).rejects.toMatchObject({ statusCode: 429 });

    expect(lpushSpy).not.toHaveBeenCalled();
  });

  it('claims a task atomically and acknowledges only after successful delivery', async () => {
    const task = {
      type: 'RESET_PASSWORD_EMAIL' as const,
      payload: { email: 'user@example.com', token: 'reset-token' },
      id: 'task-success',
      retryCount: 0,
    };
    rpoplpushSpy.mockResolvedValueOnce(task);

    await (queue as any).processNext();

    expect(rpoplpushSpy).toHaveBeenCalledWith('notification_queue', 'notification_queue:processing');
    expect(resetSpy).toHaveBeenCalledWith('user@example.com', 'reset-token');
    expect(lremSpy).toHaveBeenCalledWith('notification_queue:processing', task, 1);
  });

  it('uses real exponential delay before requeueing a failed task', async () => {
    const task = {
      type: 'VERIFICATION_EMAIL' as const,
      payload: { email: 'user@example.com', token: 'token' },
      id: 'task-retry',
      retryCount: 0,
    };
    rpoplpushSpy.mockResolvedValueOnce(task);
    verificationSpy.mockRejectedValueOnce(new Error('temporary SMTP failure'));

    const processing = (queue as any).processNext();
    await vi.advanceTimersByTimeAsync(999);
    expect(lpushSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await processing;

    expect(lpushSpy).toHaveBeenCalledWith('notification_queue', expect.objectContaining({
      id: 'task-retry',
      retryCount: 1,
    }));
    expect(lremSpy).toHaveBeenCalledWith('notification_queue:processing', task, 1);
  });

  it('moves the third failed attempt to the dead-letter queue', async () => {
    const task = {
      type: 'TICKET_NOTIFICATION' as const,
      payload: { ticket: {}, user: {}, adminEmails: [] },
      id: 'task-dead',
      retryCount: 2,
    };
    rpoplpushSpy.mockResolvedValueOnce(task);
    ticketSpy.mockRejectedValueOnce(new Error('permanent delivery failure'));

    await (queue as any).processNext();

    expect(lpushSpy).toHaveBeenCalledWith('notification_queue:dead', expect.objectContaining({
      id: 'task-dead',
      retryCount: 3,
      failedAt: expect.any(String),
      lastError: 'permanent delivery failure',
    }));
    expect(lremSpy).toHaveBeenCalledWith('notification_queue:processing', task, 1);
  });

  it('leaves an unacknowledged task recoverable when retry persistence fails', async () => {
    const task = {
      type: 'VERIFICATION_EMAIL' as const,
      payload: { email: 'user@example.com', token: 'token' },
      id: 'task-stays-processing',
      retryCount: 0,
    };
    rpoplpushSpy.mockResolvedValueOnce(task);
    verificationSpy.mockRejectedValueOnce(new Error('temporary failure'));
    lpushSpy.mockResolvedValueOnce(false);

    const processing = (queue as any).processNext();
    await vi.advanceTimersByTimeAsync(1000);
    await processing;

    expect(lremSpy).not.toHaveBeenCalled();
  });

  it('recovers tasks left in the processing queue after a crash', async () => {
    const task = {
      type: 'VERIFICATION_EMAIL' as const,
      payload: { email: 'user@example.com', token: 'token' },
      id: 'task-recover',
      retryCount: 0,
    };
    rpoplpushSpy.mockResolvedValueOnce(task).mockResolvedValueOnce(null);

    await expect(queue.recoverProcessingTasks()).resolves.toBe(1);

    expect(rpoplpushSpy).toHaveBeenNthCalledWith(1, 'notification_queue:processing', 'notification_queue');
  });

  it('does not continue pulling tasks after the worker is stopped', async () => {
    const task = {
      type: 'VERIFICATION_EMAIL' as const,
      payload: { email: 'user@example.com', token: 'token' },
      id: 'task-stop',
      retryCount: 0,
    };
    let resolveDelivery: (() => void) | undefined;
    verificationSpy.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveDelivery = resolve;
    }));
    rpoplpushSpy.mockResolvedValueOnce(task).mockResolvedValue(null);

    const processing = (queue as any).processNext();
    await Promise.resolve();
    queue.stopWorker();
    resolveDelivery?.();
    await processing;
    await vi.runAllTimersAsync();

    expect(rpoplpushSpy).toHaveBeenCalledTimes(1);
  });

  it('does not start processing after recovery finishes when the worker was stopped', async () => {
    let resolveRecovery: (() => void) | undefined;
    const processNextSpy = vi.spyOn(queue as any, 'processNext');
    rpoplpushSpy.mockImplementationOnce(() => new Promise<null>((resolve) => {
      resolveRecovery = () => resolve(null);
    }));

    queue.startWorker();
    queue.stopWorker();
    resolveRecovery?.();
    await vi.runAllTimersAsync();

    expect(rpoplpushSpy).toHaveBeenCalledTimes(1);
    expect(processNextSpy).not.toHaveBeenCalled();
  });
});

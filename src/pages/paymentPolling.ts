export type PaymentPollStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

type TimerApi = Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;

type PaymentPollerOptions = {
  initialDelayMs: number;
  maxDelayMs?: number;
  maxFailures?: number;
  onStatus: (status: PaymentPollStatus) => void;
  onError?: (error: unknown, failures: number) => void;
};

type PaymentPoll = (signal: AbortSignal) => Promise<PaymentPollStatus>;

const TERMINAL_STATUSES = new Set<PaymentPollStatus>(['COMPLETED', 'FAILED', 'EXPIRED']);

export const createPaymentPoller = (
  poll: PaymentPoll,
  options: PaymentPollerOptions,
  timer: TimerApi = globalThis,
) => {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let inFlight = false;
  let failures = 0;
  let delayMs = options.initialDelayMs;
  let requestController: AbortController | null = null;

  const clearTimer = () => {
    if (timerId === null) return;
    timer.clearTimeout(timerId);
    timerId = null;
  };

  const stop = () => {
    running = false;
    clearTimer();
    requestController?.abort();
    requestController = null;
  };

  const schedule = (nextDelayMs: number, tick: () => void) => {
    if (!running) return;
    clearTimer();
    timerId = timer.setTimeout(() => {
      timerId = null;
      tick();
    }, nextDelayMs);
  };

  const tick = async () => {
    if (!running || inFlight) return;
    inFlight = true;
    requestController = new AbortController();

    try {
      const status = await poll(requestController.signal);
      if (!running) return;

      failures = 0;
      delayMs = options.initialDelayMs;
      options.onStatus(status);
      if (TERMINAL_STATUSES.has(status)) {
        stop();
        return;
      }

      schedule(delayMs, () => { void tick(); });
    } catch (error) {
      if (!running) return;

      failures += 1;
      if (failures >= (options.maxFailures ?? 4)) {
        stop();
        options.onError?.(error, failures);
        return;
      }

      delayMs = Math.min(options.maxDelayMs ?? 15_000, options.initialDelayMs * (failures + 1));
      schedule(delayMs, () => { void tick(); });
    } finally {
      inFlight = false;
      requestController = null;
    }
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      failures = 0;
      delayMs = options.initialDelayMs;
      schedule(delayMs, () => { void tick(); });
    },
    stop,
    isRunning: () => running,
  };
};
